import type { ISODateString } from '../../../types/branded';
import { computeRowDateBounds } from '../helpers/rowDateBounds';
import { validateISODateRange } from '../../../utils/isoDateHelpers';
import { detectOverlappingPeriods } from '../engines/periodOverlapDetection';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse } from '../../../config/dateRanges';
import { DATE_ORDER_ERROR_MESSAGE, hasDateOrderError } from '../../../utils/dateOrderValidation';
import { buildNoValidDateRangeMessage, isNonEmptyString } from './eoDateRangeMessages';
import { formatDanishList } from '../../../utils/danishListFormatting';
import { buildSvieSmerteCutoffErrorMessage, buildSvieSmertePeriodeCutoffErrorMessage } from './svieSmerteConstraints';
import { resolveSkadestypeDatoLabel } from '../../../domain/policies/stamdataCalculations';
import { isPeriodOverlapIssue } from '../periodOverlapIssues';
import type { FieldIssue } from '../../../inputCore/inputIssue';

/**
 * Ren (React-/kontrol-frit) blokerings-afgørelse for én svie/smerte-periode-række.
 *
 * Den delte kanoniske rækkevurdering ejer fuldstændighed, datoorden, ménafgørelses-cutoff og overlap;
 * `erstatningsopgoerelseValidator` bruger samme assessment til dokument-/downloadgaten. Denne evaluator føjer
 * afledte cellegrænser og allerede aktive field issues til, så visningen kan pege på konkrete felter.
 *
 * Den autoritative række-evaluerings-motors periode-builder (`buildEoSvieSmerteRows`)
 * delegerer hertil, så rækkens brugerfeedback og downloadgate deler de samme kerneregler. Beskeder er bevidst
 * de samme strenge som builderen producerede før udskillelsen (adfærdsbevarende).
 */

export type SvieSmertePeriodeRowInput = Readonly<{
  id: string;
  fra?: ISODateString;
  til?: ISODateString;
  tilstand?: string;
}>;

export type SvieSmertePeriodeBoundsContext = Readonly<{
  skadedatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  menAfgoerelseDatoForTabel: ISODateString | undefined;
  /** Den oprindelige afgørelsesdato til den brugerrettede cutoff-besked (ikke dagen før). */
  menAfgoerelseDato?: ISODateString | undefined;
  verserendeKlageMen: boolean;
}>;

/** Rækkens aktive røde issues, også når InputReader derfor har maskeret den canonical værdi. */
export type SvieSmertePeriodeCellIssues = Readonly<{
  fra?: FieldIssue | undefined;
  til?: FieldIssue | undefined;
  tilstand?: FieldIssue | undefined;
}>;

export type SvieSmertePeriodeCellIssueLookup = (rowId: string) => SvieSmertePeriodeCellIssues;

const NO_CELL_ISSUES: SvieSmertePeriodeCellIssueLookup = () => ({});

type SvieSmertePeriodeField = 'fra' | 'til' | 'tilstand';

export type SvieSmerteCanonicalPeriodeAssessment = Readonly<{
  kind: 'skip' | 'ok' | 'error';
  missingFields: readonly SvieSmertePeriodeField[];
  dateOrderError: boolean;
  fraCutoffError: string | undefined;
  tilCutoffError: string | undefined;
  preferredCutoffError: string | undefined;
  hasOverlap: boolean;
}>;

const isRed = (issue: FieldIssue | undefined): issue is FieldIssue =>
  issue !== undefined && issue.severity === 'error' && issue.message.trim() !== '';

const isRowLineIssue = (issue: FieldIssue | undefined): issue is FieldIssue =>
  isRed(issue) && !isPeriodOverlapIssue(issue) && !issue.code.endsWith('.menCutoff');

const isDateOrderIssue = (issue: FieldIssue | undefined): boolean =>
  isRed(issue) && issue.code.endsWith('.dateOrder');

/**
 * Fælles vurdering af S/S-rækkernes canonical input. Dokumentvalidatoren bruger den til sin downloadgate, og
 * række-evaluatoren bruger samme resultat til synlige fejl. Feltissues og kontekstuelle feltgrænser flettes først
 * ind i visningslaget, fordi rejected tekst og røde cellemarkeringer ikke findes i en parsed `.eo`-sag.
 */
export const assessSvieSmertePerioder = (
  perioder: ReadonlyArray<SvieSmertePeriodeRowInput>,
  context: Pick<SvieSmertePeriodeBoundsContext, 'menAfgoerelseDato' | 'verserendeKlageMen'>,
): ReadonlyMap<string, SvieSmerteCanonicalPeriodeAssessment> => {
  const overlappingIds = detectOverlappingPeriods(perioder);
  const menAfgoerelseDato = context.verserendeKlageMen ? undefined : context.menAfgoerelseDato;
  const result = new Map<string, SvieSmerteCanonicalPeriodeAssessment>();

  for (const periode of perioder) {
    const hasFra = isNonEmptyString(periode.fra);
    const hasTil = isNonEmptyString(periode.til);
    const hasTilstand = isNonEmptyString(periode.tilstand);
    const missingFields: SvieSmertePeriodeField[] = [];
    if (!hasFra) missingFields.push('fra');
    if (!hasTil) missingFields.push('til');
    if (!hasTilstand) missingFields.push('tilstand');

    const dateOrderError = hasDateOrderError(periode.fra, periode.til);
    const fraCutoffError = buildSvieSmerteCutoffErrorMessage({ value: periode.fra, menAfgoerelseDato });
    const tilCutoffError = buildSvieSmerteCutoffErrorMessage({ value: periode.til, menAfgoerelseDato });
    const preferredCutoffError = buildSvieSmertePeriodeCutoffErrorMessage({
      fra: periode.fra,
      til: periode.til,
      menAfgoerelseDato,
    });
    const hasOverlap = overlappingIds.has(periode.id);
    const isCompletelyEmpty = periode.fra === undefined
      && periode.til === undefined
      && periode.tilstand === undefined;
    const kind = isCompletelyEmpty
      ? 'skip'
      : missingFields.length > 0 || dateOrderError || preferredCutoffError !== undefined || hasOverlap
        ? 'error'
        : 'ok';

    result.set(periode.id, {
      kind,
      missingFields,
      dateOrderError,
      fraCutoffError,
      tilCutoffError,
      preferredCutoffError,
      hasOverlap,
    });
  }

  return result;
};

export type SvieSmertePeriodeEvaluation =
  /** Helt tom række – springes over (ingen fejl, ingen visning). */
  | Readonly<{ kind: 'skip' }>
  /** Gyldig række. */
  | Readonly<{ kind: 'ok' }>
  /**
   * Blokerende fejl. `message` er den indre besked (uden "Fejl (...)"-indpakning). `field`
   * angiver hvilket input fejlen er forankret til (fra-/til-dato eller tilstand), så UI'et kan
   * pege på den korrekte celle uden at gætte kolonnen ud fra beskedens ordlyd.
   */
  | Readonly<{
    kind: 'error';
    message: string;
    field?: 'fra' | 'til' | 'tilstand';
    summaryDeduplicationGroup?: 'sviesmerte-overlap';
  }>;

const joinManglerFelter = (parts: ReadonlyArray<string>): string => {
  if (parts.length <= 1) return parts[0] ?? '';
  const head = parts.slice(0, -1).map((p, i) => (i === 0 ? p : p.toLocaleLowerCase('da-DK')));
  const tail = parts[parts.length - 1].toLocaleLowerCase('da-DK');
  return formatDanishList([...head, tail]);
};

const evaluateOne = (
  periode: SvieSmertePeriodeRowInput,
  canonicalAssessment: SvieSmerteCanonicalPeriodeAssessment,
  cellIssues: SvieSmertePeriodeCellIssues,
  skadedatoMinRule: ReturnType<typeof computeSkadedatoMinRule>,
  context: SvieSmertePeriodeBoundsContext
): SvieSmertePeriodeEvaluation => {
  const missingFields = canonicalAssessment.missingFields.filter((field) => !isRed(cellIssues[field]));
  const hasFra = !missingFields.includes('fra');
  const hasTil = !missingFields.includes('til');
  const hasTilstand = !missingFields.includes('tilstand');
  const filledCount = 3 - missingFields.length;
  if (filledCount === 0) return { kind: 'skip' };
  const allFilled = filledCount === 3;
  const cellMessages = [cellIssues.fra, cellIssues.til, cellIssues.tilstand]
    .filter(isRowLineIssue)
    .map((issue) => issue.message.trim());

  const fraISO = periode.fra;
  const tilISO = periode.til;
  const dateOrderError = canonicalAssessment.dateOrderError;
  const hasDateOrderCellIssue = isDateOrderIssue(cellIssues.fra) || isDateOrderIssue(cellIssues.til);
  const hasOverlap = canonicalAssessment.hasOverlap || [cellIssues.fra, cellIssues.til].some(
    (issue) => issue !== undefined && isPeriodOverlapIssue(issue)
  );
  const stamdataDatoLabel = resolveSkadestypeDatoLabel(
    context.erErhvervssygdom ? 'Erhvervssygdom' : undefined
  );

  const bounds = computeRowDateBounds({
    skadedatoMinDate: skadedatoMinRule.minDate,
    rowFra: fraISO,
    rowTil: tilISO,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
    fallbackMax: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMax,
    tilFallbackMax: dateRanges_erstatningsopgoerelse.tabelSvieSmerteTil.max,
    tilExtraMaxDate: context.menAfgoerelseDatoForTabel,
    useTilExtraMaxDate: !context.verserendeKlageMen,
  });

  const fraNoValidRangeCause = (() => {
    const parts: string[] = [];
    if (skadedatoMinRule.minBoundKind) parts.push(stamdataDatoLabel);
    if (tilISO) parts.push('til-dato i samme række');
    return parts.length > 0 ? parts.join(', ') : undefined;
  })();

  const tilNoValidRangeCause = (() => {
    const parts: string[] = [];
    // Når Fra-datoen ligger før stamdata-datoens grænse, er stamdata-datoen stadig den aktive
    // årsag til Til-datoens min. Den tidligere `!fraISO`-betingelse skjulte den og efterlod brugeren
    // med en generisk «dags dato»-årsag ved et umuligt interval.
    if (skadedatoMinRule.minBoundKind && (!fraISO || fraISO <= skadedatoMinRule.minDate)) {
      parts.push(stamdataDatoLabel);
    }
    if (fraISO) parts.push('fra-dato i samme række');
    parts.push('dags dato');
    if (!context.verserendeKlageMen && context.menAfgoerelseDatoForTabel) parts.push('dato for ménafgørelse');
    return parts.join(', ');
  })();

  const fraRangeErrorMessage = (() => {
    if (!fraISO || dateOrderError) return undefined;
    if (bounds.fra.min > bounds.fra.max) {
      return buildNoValidDateRangeMessage({
        minDate: bounds.fra.min,
        maxDate: bounds.fra.max,
        noValidRangeCause: fraNoValidRangeCause,
      });
    }
    const result = validateISODateRange(fraISO, bounds.fra.min, bounds.fra.max);
    return result.isValid ? undefined : result.errorMessage;
  })();

  const tilRangeErrorMessage = (() => {
    if (!tilISO || dateOrderError) return undefined;
    if (bounds.til.min > bounds.til.max) {
      return buildNoValidDateRangeMessage({
        minDate: bounds.til.min,
        maxDate: bounds.til.max,
        noValidRangeCause: tilNoValidRangeCause,
      });
    }
    const result = validateISODateRange(tilISO, bounds.til.min, bounds.til.max);
    return result.isValid ? undefined : result.errorMessage;
  })();

  const fraCutoffError = canonicalAssessment.fraCutoffError;
  const tilCutoffError = canonicalAssessment.tilCutoffError;
  const preferredCutoffError = canonicalAssessment.preferredCutoffError;

  // Descriptorens bounds-issue har den konkrete tekst, feltet faktisk viser. Den parallelle intervaltest
  // giver samme grænse en generisk besked og må ikke lægges oven i rækkens ene, konkrete fejl.
  const hasBoundsCellIssue = [cellIssues.fra, cellIssues.til].some((issue) => issue?.reason === 'bounds');
  // En cutoff-besked beskriver allerede den ugyldige dato, der gør intervallet umuligt. Vis ikke også
  // den afledte «Ingen gyldige datoer»-tekst for samme ménafgørelsesgrænse; uafhængige bounds-issues
  // står fortsat i `cellMessages` og bevares sammen med overlap.
  const computedRangeMessages = (hasBoundsCellIssue || preferredCutoffError !== undefined
    ? []
    : [fraRangeErrorMessage, tilRangeErrorMessage]).filter(
    (m): m is string => typeof m === 'string' && m.trim() !== ''
  );

  const harFejl = preferredCutoffError !== undefined
    || computedRangeMessages.length > 0
    || cellMessages.length > 0
    || dateOrderError
    || hasOverlap;

  if (!allFilled) {
    const manglerFelter: string[] = [];
    if (!hasFra) manglerFelter.push('Fra-dato');
    if (!hasTil) manglerFelter.push('Til-dato');
    if (!hasTilstand) manglerFelter.push('Tilstand');
    const cellIssueField: 'fra' | 'til' | 'tilstand' | undefined = isRowLineIssue(cellIssues.fra)
      ? 'fra'
      : isRowLineIssue(cellIssues.til)
        ? 'til'
        : isRowLineIssue(cellIssues.tilstand)
          ? 'tilstand'
          : undefined;
    const cutoffField = fraCutoffError !== undefined ? 'fra' : tilCutoffError !== undefined ? 'til' : undefined;
    const field: 'fra' | 'til' | 'tilstand' = cellIssueField
      ?? cutoffField
      ?? (!hasFra ? 'fra' : !hasTil ? 'til' : 'tilstand');
    const messageParts = [
      ...cellMessages,
      ...(preferredCutoffError === undefined ? [] : [preferredCutoffError]),
      `${joinManglerFelter(manglerFelter)} er ikke angivet`,
      ...(hasOverlap ? ['Der er overlappende svie/smerte-perioder'] : []),
    ];
    return { kind: 'error', message: [...new Set(messageParts)].join('; '), field };
  }

  if (harFejl) {
    const fraFoerTilError = dateOrderError && !hasDateOrderCellIssue ? DATE_ORDER_ERROR_MESSAGE : undefined;
    const allMessages = [
      ...cellMessages,
      ...(preferredCutoffError === undefined ? [] : [preferredCutoffError]),
      ...computedRangeMessages.map((message) => message.trim()).filter((message) => message !== ''),
      ...(fraFoerTilError === undefined ? [] : [fraFoerTilError]),
      ...(hasOverlap ? ['Der er overlappende svie/smerte-perioder'] : []),
    ];
    const uniqueMessages = [...new Set(allMessages)];
    const errorMessages = uniqueMessages.join('; ');
    const cellIssueField: 'fra' | 'til' | 'tilstand' | undefined = isRowLineIssue(cellIssues.fra)
      ? 'fra'
      : isRowLineIssue(cellIssues.til)
        ? 'til'
        : isRowLineIssue(cellIssues.tilstand)
          ? 'tilstand'
          : undefined;
    const field: 'fra' | 'til' | undefined = hasOverlap
      ? cellIssueField === 'fra' || cellIssueField === 'til'
        ? cellIssueField
        : fraCutoffError
          ? 'fra'
          : tilCutoffError
            ? 'til'
            : undefined
      : cellIssueField === 'fra' || cellIssueField === 'til'
        ? cellIssueField
        : cellIssueField === 'tilstand'
          ? undefined
          : fraCutoffError
            ? 'fra'
            : tilCutoffError
              ? 'til'
              : fraFoerTilError
                ? 'til'
                : fraRangeErrorMessage
                  ? 'fra'
                  : 'til';
    const overlapIsOnlyRowIssue = hasOverlap && uniqueMessages.length === 1;
    return {
      kind: 'error',
      message: errorMessages,
      field,
      ...(overlapIsOnlyRowIssue ? { summaryDeduplicationGroup: 'sviesmerte-overlap' } : {}),
    };
  }

  return { kind: 'ok' };
};

/**
 * Evaluerer alle svie/smerte-periode-rækker. Overlap beregnes på tværs af alle rækker
 * (samme `detectOverlappingPeriods` som validator/engine, jf. periodisering-contract §7).
 */
export const evaluateSvieSmertePerioder = (
  perioder: ReadonlyArray<SvieSmertePeriodeRowInput>,
  context: SvieSmertePeriodeBoundsContext,
  cellIssues: SvieSmertePeriodeCellIssueLookup = NO_CELL_ISSUES,
): ReadonlyMap<string, SvieSmertePeriodeEvaluation> => {
  const canonicalAssessments = assessSvieSmertePerioder(perioder, context);
  const skadedatoMinRule = computeSkadedatoMinRule({
    skadedatoISO: context.skadedatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
  });

  const result = new Map<string, SvieSmertePeriodeEvaluation>();
  for (const periode of perioder) {
    const rowIssues = cellIssues(periode.id);
    const canonicalAssessment = canonicalAssessments.get(periode.id);
    if (canonicalAssessment === undefined) throw new Error(`Svie/smerte-række mangler vurdering: ${periode.id}`);
    result.set(periode.id, evaluateOne(periode, canonicalAssessment, rowIssues, skadedatoMinRule, context));
  }
  return result;
};
