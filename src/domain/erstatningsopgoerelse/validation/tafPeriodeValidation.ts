import type { ISODateString } from '../../../types/branded';
import { computeRowDateBounds } from '../helpers/rowDateBounds';
import { getDayBeforeIso, validateISODateRange } from '../../../utils/isoDateHelpers';
import { detectOverlappingPeriods } from '../engines/periodOverlapDetection';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse, getToday } from '../../../config/dateRanges';
import { DATE_ORDER_ERROR_MESSAGE, hasDateOrderError } from '../../../utils/dateOrderValidation';
import { buildTafCutoffErrorMessage } from './tafPeriodConstraints';
import { buildNoValidDateRangeMessage, isNonEmptyString } from './eoDateRangeMessages';

/**
 * Ren (React-/kontrol-frit) blokerings-afgørelse for TAF-periode-rækker.
 *
 * AUTORITATIV kilde til om en TAF-periode blokerer (komplethed, dato-grænser, cutoff efter
 * differencekrav/EET-afgørelse, overlap, rækkefølge) og med hvilken besked — jf. B9. Tjekkene
 * findes IKKE i `erstatningsopgoerelseValidator` (kun komplethed/rækkefølge/overlap), så uden
 * denne udskillelse var dato-grænse- og cutoff-blokeringen kun håndhævet inde i en builders
 * display-formattering.
 *
 * Den autoritative række-evaluerings-motors TAF-periode-builder (`buildEoTaftRows`) delegerer
 * hertil, så blokerings-afgørelsen er ÉN sandhedskilde og dens `error`-rækker — der gater
 * produktions-PDF-download — ikke kan flyttes af display-formattering (adfærdsbevarende relokering).
 */

export type TafPeriodeRowInput = Readonly<{
  id: string;
  fra?: ISODateString;
  til?: ISODateString;
}>;

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
  | Readonly<{ kind: 'error'; message: string; field?: 'fra' | 'til' }>;

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
  hasOverlap: boolean,
  skadedatoMinRule: ReturnType<typeof computeSkadedatoMinRule>,
  combinedExtraMaxDate: ISODateString | undefined,
  context: TafPeriodeBoundsContext
): TafPeriodeEvaluation => {
  const hasFra = isNonEmptyString(periode.fra);
  const hasTil = isNonEmptyString(periode.til);
  const filledCount = [hasFra, hasTil].filter(Boolean).length;
  if (filledCount === 0) return { kind: 'skip' };
  if (filledCount !== 2) {
    return hasFra
      ? { kind: 'error', message: 'Til-dato er ikke angivet', field: 'til' }
      : { kind: 'error', message: 'Fra-dato er ikke angivet', field: 'fra' };
  }

  const fraISO = periode.fra;
  const tilISO = periode.til;
  if (!fraISO || !tilISO) return { kind: 'error', message: 'Ugyldig dato' };

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

  const fraNoValidRangeCause = (() => {
    const parts: string[] = [];
    if (skadedatoMinRule.minBoundKind) parts.push('skadedato');
    if (tilISO) parts.push('til-dato i samme række');
    return parts.length > 0 ? parts.join(', ') : undefined;
  })();

  const tilNoValidRangeCause = (() => {
    const parts: string[] = [];
    if (!fraISO && skadedatoMinRule.minBoundKind) parts.push('skadedato');
    if (fraISO) parts.push('fra-dato i samme række');
    parts.push('dags dato');
    if (context.differencekravDato) parts.push('differencekrav-dato');
    if (!context.verserendeKlageEet && context.endeligEETBeregnetDato) parts.push('beregnet dato for endeligt EET');
    if (!context.verserendeKlageEet && context.aktivMidlertidigEETBeregnetDato) parts.push('beregnet dato for midlertidigt EET');
    return parts.join(', ');
  })();

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
  const tilCutoffError = buildTafCutoffErrorMessage({
    value: tilISO,
    differencekravDato: context.differencekravDato,
    endeligEETDato: endeligEetCutoff,
    midlertidigEETDato: midlertidigEetCutoff,
  });
  const preferredFieldErrorMessages = [fraCutoffError, tilCutoffError].filter(
    (message): message is string => typeof message === 'string' && message.trim() !== ''
  );

  if (hasOverlap || preferredFieldErrorMessages.length > 0 || computedRangeMessages.length > 0) {
    const fraFoerTilError = hasDateOrderError(fraISO, tilISO) ? DATE_ORDER_ERROR_MESSAGE : undefined;
    const rangeOrCutoffErrorMessage =
      preferredFieldErrorMessages.length > 0
        ? preferredFieldErrorMessages.join('; ')
        : (fraFoerTilError ?? computedRangeMessages.join('; '));
    const errorMessages =
      hasOverlap && rangeOrCutoffErrorMessage
        ? `${rangeOrCutoffErrorMessage}; Der er overlappende perioder`
        : (rangeOrCutoffErrorMessage || 'Der er overlappende perioder');
    // Forankr fejlen til det konkrete felt: en cutoff-/interval-fejl på fra-datoen peger på
    // fra-cellen (ikke til-cellen, som en ordlyd-baseret gæt ville gøre), rækkefølgefejl peger på
    // til-datoen, og en ren overlap-fejl har intet entydigt felt (kataloget falder da til fra).
    const field: 'fra' | 'til' | undefined =
      preferredFieldErrorMessages.length > 0
        ? (fraCutoffError ? 'fra' : 'til')
        : fraFoerTilError
          ? 'til'
          : computedRangeMessages.length > 0
            ? (fraRangeErrorMessage ? 'fra' : 'til')
            : undefined;
    return { kind: 'error', message: errorMessages, field };
  }

  return { kind: 'ok' };
};

/**
 * Evaluerer alle TAF-periode-rækker. Overlap beregnes på tværs af alle rækker.
 */
export const evaluateTafPerioder = (
  perioder: ReadonlyArray<TafPeriodeRowInput>,
  context: TafPeriodeBoundsContext
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
      evaluateOne(periode, overlappingIds.has(periode.id), skadedatoMinRule, combinedExtraMaxDate, context)
    );
  }
  return result;
};
