import type { ISODateString } from '../../../types/branded';
import { computeRowDateBounds } from '../helpers/rowDateBounds';
import { getDayBeforeIso, validateISODateRange } from '../../../utils/isoDateHelpers';
import { detectOverlappingPeriods } from '../engines/periodOverlapDetection';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse, getToday } from '../../../config/dateRanges';
import { DATE_ORDER_ERROR_MESSAGE, hasDateOrderError } from '../../../utils/dateOrderValidation';
import { buildTafCutoffErrorMessage, buildTafPeriodeCutoffErrorMessage } from './tafPeriodConstraints';
import { buildNoValidDateRangeMessage, isNonEmptyString } from './eoDateRangeMessages';
import { resolveSkadestypeDatoLabel } from '../../policies/stamdataCalculations';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import { assessPeriodeDatoMangler, buildPeriodeRaekkeNavn, TAF_OVERLAP_LINJE } from './tafRowRules';

/**
 * Ren (React-/kontrol-frit) blokerings-afgørelse for TAF-periode-rækker.
 *
 * AUTORITATIV kilde til om en TAF-periode blokerer (komplethed, dato-grænser, cutoff efter
 * differencekrav/EET-afgørelse, overlap, rækkefølge) og med hvilken besked – jf. B9. Tjekkene
 * findes IKKE i `erstatningsopgoerelseValidator` (kun komplethed/rækkefølge/overlap), så uden
 * denne udskillelse var dato-grænse- og cutoff-blokeringen kun håndhævet inde i en builders
 * display-formattering.
 *
 * Den autoritative række-evaluerings-motors TAF-periode-builder (`buildEoTaftRows`) delegerer
 * hertil, så blokerings-afgørelsen er ÉN sandhedskilde og dens `error`-rækker – der gater
 * produktions-PDF-download – ikke kan flyttes af display-formattering (adfærdsbevarende relokering).
 */

export type TafPeriodeRowInput = Readonly<{
  id: string;
  fra?: ISODateString;
  til?: ISODateString;
  loseFeriedage?: number | undefined;
}>;

/** En rækkes aktive feltissues pr. kolonne. En celle med et rødt issue er udfyldt, selv om readeren giver den tom. */
export type TafPeriodeCellIssues = Readonly<{
  fra?: FieldIssue | undefined;
  til?: FieldIssue | undefined;
  loseFeriedage?: FieldIssue | undefined;
}>;

export type TafPeriodeCellIssueLookup = (rowId: string) => TafPeriodeCellIssues;

const NO_CELL_ISSUES: TafPeriodeCellIssueLookup = () => ({});

const isRed = (issue: FieldIssue | undefined): issue is FieldIssue =>
  issue !== undefined && issue.severity === 'error' && issue.message.trim() !== '';

/**
 * En rød celles egen besked skal med i rækkens linje – undtagen overlappet (én linje pr. tabel) og
 * afskæringen, som periodens samlede besked allerede nævner én gang (BB-244).
 */
const isRowLineIssue = (issue: FieldIssue | undefined): issue is FieldIssue =>
  isRed(issue) && !issue.code.endsWith('.overlap') && !issue.code.endsWith('.tafCutoff');

export type TafPeriodeBoundsContext = Readonly<{
  skadedatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  differencekravDato: ISODateString | undefined;
  endeligEETBeregnetDato: ISODateString | undefined;
  midlertidigEETBeregnetDato: ISODateString | undefined;
  /** Den aktive midlertidige EET-beregnede dato (resolveMidlertidigEetDatoHvisAktiv). */
  aktivMidlertidigEETBeregnetDato: ISODateString | undefined;
  verserendeKlageEet: boolean;
}>;

export type TafPeriodeEvaluation =
  | Readonly<{ kind: 'skip' }>
  | Readonly<{ kind: 'ok' }>
  /**
   * Blokerende fejl. `field` angiver hvilket input fejlen er forankret til (fra-/til-dato), så
   * UI'et kan pege på den korrekte celle uden at gætte kolonnen ud fra beskedens ordlyd.
   */
  | Readonly<{ kind: 'error'; message: string; field?: 'fra' | 'til' | 'loseFeriedage' }>;

/**
 * Den kombinerede øvre til-dato-grænse fra differencekrav/EET-afgørelses-datoer (hver minus
 * én dag). Differencekrav gælder altid; EET-datoerne kun når der ikke er verserende klage.
 * Deles af TAF-periode- og ferieperiode-valideringen, så grænsen er ét sted.
 */
export const computeTafCombinedExtraMaxDate = (
  context: TafPeriodeBoundsContext
): ISODateString | undefined => {
  const endeligEETMinus1 = getDayBeforeIso(context.endeligEETBeregnetDato);
  const midlertidigEETMinus1 = getDayBeforeIso(context.aktivMidlertidigEETBeregnetDato);
  const differencekravMinus1 = getDayBeforeIso(context.differencekravDato);

  let combined: ISODateString | undefined = undefined;
  if (differencekravMinus1) {
    combined = differencekravMinus1;
  }
  if (!context.verserendeKlageEet && endeligEETMinus1) {
    if (!combined || endeligEETMinus1 < combined) combined = endeligEETMinus1;
  }
  if (!context.verserendeKlageEet && midlertidigEETMinus1) {
    if (!combined || midlertidigEETMinus1 < combined) combined = midlertidigEETMinus1;
  }
  return combined;
};

const validateRowDate = (args: {
  iso: ISODateString | undefined;
  minDate: ISODateString;
  maxDate: ISODateString;
  noValidRangeCause?: string | undefined;
}): string | undefined => {
  if (!args.iso) return undefined;
  if (args.minDate > args.maxDate) {
    return buildNoValidDateRangeMessage({
      minDate: args.minDate,
      maxDate: args.maxDate,
      noValidRangeCause: args.noValidRangeCause,
    });
  }
  const result = validateISODateRange(args.iso, args.minDate, args.maxDate);
  return result.isValid ? undefined : result.errorMessage;
};

const evaluateOne = (
  periode: TafPeriodeRowInput,
  cellIssues: TafPeriodeCellIssues,
  hasOverlap: boolean,
  skadedatoMinRule: ReturnType<typeof computeSkadedatoMinRule>,
  combinedExtraMaxDate: ISODateString | undefined,
  context: TafPeriodeBoundsContext
): TafPeriodeEvaluation => {
  const harFra = isNonEmptyString(periode.fra) || isRed(cellIssues.fra);
  const harTil = isNonEmptyString(periode.til) || isRed(cellIssues.til);
  const harLose = typeof periode.loseFeriedage === 'number' || isRed(cellIssues.loseFeriedage);
  // En række med kun løse feriedage er udfyldt: den spærrede før via validatoren med to linjer uden link,
  // mens rækkebyggeren så den som tom (BB-253).
  if (!harFra && !harTil && !harLose) return { kind: 'skip' };

  // Én linje pr. række med rækkens navn og ALLE dens mangler; linket går til den første (BB-253).
  const dele: Array<Readonly<{ message: string; field: 'fra' | 'til' | 'loseFeriedage' }>> = [];
  // Afskæringen nævnes af periodens samlede besked, men den dannes kun, når begge datoer er læsbare. Mangler
  // den ene, bærer cellens egen afskæringstekst linjen.
  const periodeBeskedDannes = isNonEmptyString(periode.fra) && isNonEmptyString(periode.til);
  const hoererTilLinjen = (issue: FieldIssue | undefined): issue is FieldIssue =>
    isRed(issue) && !issue.code.endsWith('.overlap') && (periodeBeskedDannes ? !issue.code.endsWith('.tafCutoff') : true);
  if (hoererTilLinjen(cellIssues.fra)) dele.push({ message: cellIssues.fra.message.trim(), field: 'fra' });
  if (hoererTilLinjen(cellIssues.til)) dele.push({ message: cellIssues.til.message.trim(), field: 'til' });
  const mangler = assessPeriodeDatoMangler(harFra, harTil);
  if (mangler) dele.push(mangler);

  const fraISO = periode.fra;
  const tilISO = periode.til;
  if (fraISO && tilISO) {
    const rangeOrCutoff = evaluateRangeAndCutoff(fraISO, tilISO, skadedatoMinRule, combinedExtraMaxDate, context);
    if (rangeOrCutoff) dele.push(rangeOrCutoff);
  }
  if (isRowLineIssue(cellIssues.loseFeriedage)) {
    dele.push({ message: cellIssues.loseFeriedage.message.trim(), field: 'loseFeriedage' });
  }

  if (dele.length === 0) {
    // Et rent overlap nævner ikke rækken: de overlappende rækkers linjer er ordret ens og foldes til én pr.
    // tabel, mens den røde celles tooltip navngiver modparten (BB-218, BB-251).
    return hasOverlap ? { kind: 'error', message: TAF_OVERLAP_LINJE, field: 'fra' } : { kind: 'ok' };
  }
  const beskeder = [...new Set(dele.map((del) => del.message))];
  if (hasOverlap) beskeder.push(TAF_OVERLAP_LINJE);
  return {
    kind: 'error',
    message: `${buildPeriodeRaekkeNavn('TAF-perioden', periode)}: ${beskeder.join('; ')}`,
    field: dele[0]!.field,
  };
};

/**
 * Datogrænserne og afskæringen for en række med begge datoer. Cellerne bærer hver sin afskæringsbesked;
 * periodens linje nævner hver afskæring én gang (BB-244).
 */
const evaluateRangeAndCutoff = (
  fraISO: ISODateString,
  tilISO: ISODateString,
  skadedatoMinRule: ReturnType<typeof computeSkadedatoMinRule>,
  combinedExtraMaxDate: ISODateString | undefined,
  context: TafPeriodeBoundsContext
): Readonly<{ message: string; field: 'fra' | 'til' }> | undefined => {
  const bounds = computeRowDateBounds({
    skadedatoMinDate: skadedatoMinRule.minDate,
    rowFra: fraISO,
    rowTil: tilISO,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
    fallbackMax: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMax,
    tilFallbackMax: getToday(),
    tilExtraMaxDate: combinedExtraMaxDate,
    useTilExtraMaxDate: true,
  });

  const stamdataDatoLabel = resolveSkadestypeDatoLabel(
    context.erErhvervssygdom ? 'Erhvervssygdom' : undefined
  ).toLowerCase();
  const fraNoValidRangeCause = [
    ...(skadedatoMinRule.minBoundKind ? [stamdataDatoLabel] : []),
    'til-dato i samme række',
  ].join(', ');
  const tilNoValidRangeCause = [
    'fra-dato i samme række',
    'dags dato',
    ...(context.differencekravDato ? ['differencekrav-dato'] : []),
    ...(!context.verserendeKlageEet && context.endeligEETBeregnetDato ? ['beregnet dato for endeligt EET'] : []),
    ...(!context.verserendeKlageEet && context.aktivMidlertidigEETBeregnetDato
      ? ['beregnet dato for midlertidigt EET']
      : []),
  ].join(', ');

  const fraRangeErrorMessage = validateRowDate({
    iso: fraISO,
    minDate: bounds.fra.min,
    maxDate: bounds.fra.max,
    noValidRangeCause: fraNoValidRangeCause,
  });
  const tilRangeErrorMessage = validateRowDate({
    iso: tilISO,
    minDate: bounds.til.min,
    maxDate: bounds.til.max,
    noValidRangeCause: tilNoValidRangeCause,
  });
  const computedRangeMessages = [fraRangeErrorMessage, tilRangeErrorMessage].filter(
    (m): m is string => typeof m === 'string' && m.trim() !== ''
  );

  const endeligEetCutoff = !context.verserendeKlageEet ? context.endeligEETBeregnetDato : undefined;
  const midlertidigEetCutoff = !context.verserendeKlageEet ? context.midlertidigEETBeregnetDato : undefined;
  const fraCutoffError = buildTafCutoffErrorMessage({
    value: fraISO,
    differencekravDato: context.differencekravDato,
    endeligEETDato: endeligEetCutoff,
    midlertidigEETDato: midlertidigEetCutoff,
  });
  const periodeCutoffError = buildTafPeriodeCutoffErrorMessage({
    fra: fraISO,
    til: tilISO,
    differencekravDato: context.differencekravDato,
    endeligEETDato: endeligEetCutoff,
    midlertidigEETDato: midlertidigEetCutoff,
  });

  // Forankr fejlen til det konkrete felt: en afskærings-/intervalfejl på fra-datoen peger på fra-cellen, en
  // rækkefølgefejl på til-datoen.
  if (periodeCutoffError !== undefined) return { message: periodeCutoffError, field: fraCutoffError ? 'fra' : 'til' };
  if (hasDateOrderError(fraISO, tilISO)) return { message: DATE_ORDER_ERROR_MESSAGE, field: 'til' };
  if (computedRangeMessages.length > 0) {
    return { message: [...new Set(computedRangeMessages)].join('; '), field: fraRangeErrorMessage ? 'fra' : 'til' };
  }
  return undefined;
};

/**
 * Evaluerer alle TAF-periode-rækker. Overlap beregnes på tværs af alle rækker.
 */
export const evaluateTafPerioder = (
  perioder: ReadonlyArray<TafPeriodeRowInput>,
  context: TafPeriodeBoundsContext,
  cellIssues: TafPeriodeCellIssueLookup = NO_CELL_ISSUES
): ReadonlyMap<string, TafPeriodeEvaluation> => {
  const overlappingIds = detectOverlappingPeriods(perioder);
  const skadedatoMinRule = computeSkadedatoMinRule({
    skadedatoISO: context.skadedatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
  });
  const combinedExtraMaxDate = computeTafCombinedExtraMaxDate(context);

  const result = new Map<string, TafPeriodeEvaluation>();
  for (const periode of perioder) {
    result.set(
      periode.id,
      evaluateOne(
        periode,
        cellIssues(periode.id),
        overlappingIds.has(periode.id),
        skadedatoMinRule,
        combinedExtraMaxDate,
        context
      )
    );
  }
  return result;
};
