import type { ISODateString } from '../../../types/branded';
import { computeRowDateBounds } from '../helpers/rowDateBounds';
import { validateISODateRange } from '../../../utils/isoDateHelpers';
import { detectOverlappingPeriods } from '../engines/periodOverlapDetection';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse } from '../../../config/dateRanges';
import { DATE_ORDER_ERROR_MESSAGE } from '../../../utils/dateOrderValidation';
import { buildNoValidDateRangeMessage, isNonEmptyString } from './eoDateRangeMessages';

/**
 * Ren (React-/kontrol-frit) blokerings-afgørelse for én svie/smerte-periode-række.
 *
 * Dette er den AUTORITATIVE kilde til, om en periode-række blokerer (komplethed,
 * dato-grænser, overlap, rækkefølge) og med hvilken besked. Tjekkene findes IKKE i
 * `erstatningsopgoerelseValidator` (kun rækkefølge + ménafgørelse-bound), så uden denne
 * udskillelse var de kun håndhævet inde i en builders display-formattering.
 *
 * Den autoritative række-evaluerings-motors periode-builder (`buildEoSvieSmerteRows`)
 * delegerer hertil, så blokerings-afgørelsen er ÉN sandhedskilde og dens `error`-rækker — der
 * gater produktions-PDF-download — ikke kan flyttes af display-formattering. Beskeder er bevidst
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
  verserendeKlageMen: boolean;
}>;

export type SvieSmertePeriodeEvaluation =
  /** Helt tom række — springes over (ingen fejl, ingen visning). */
  | Readonly<{ kind: 'skip' }>
  /** Gyldig række. */
  | Readonly<{ kind: 'ok' }>
  /**
   * Blokerende fejl. `message` er den indre besked (uden "Fejl (...)"-indpakning). `field`
   * angiver hvilket input fejlen er forankret til (fra-/til-dato eller tilstand), så UI'et kan
   * pege på den korrekte celle uden at gætte kolonnen ud fra beskedens ordlyd.
   */
  | Readonly<{ kind: 'error'; message: string; field?: 'fra' | 'til' | 'tilstand' }>;

const joinManglerFelter = (parts: ReadonlyArray<string>): string => {
  if (parts.length <= 1) return parts[0] ?? '';
  const head = parts.slice(0, -1).map((p, i) => (i === 0 ? p : p.toLocaleLowerCase('da-DK')));
  const tail = parts[parts.length - 1].toLocaleLowerCase('da-DK');
  return `${head.join(', ')} og ${tail}`;
};

const evaluateOne = (
  periode: SvieSmertePeriodeRowInput,
  hasOverlap: boolean,
  skadedatoMinRule: ReturnType<typeof computeSkadedatoMinRule>,
  context: SvieSmertePeriodeBoundsContext
): SvieSmertePeriodeEvaluation => {
  const hasFra = isNonEmptyString(periode.fra);
  const hasTil = isNonEmptyString(periode.til);
  const hasTilstand = isNonEmptyString(periode.tilstand);

  const filledCount = [hasFra, hasTil, hasTilstand].filter(Boolean).length;
  if (filledCount === 0) return { kind: 'skip' };
  const allFilled = filledCount === 3;

  const fraISO = periode.fra;
  const tilISO = periode.til;

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
    if (skadedatoMinRule.minBoundKind) parts.push('skadedato');
    if (tilISO) parts.push('til-dato i samme række');
    return parts.length > 0 ? parts.join(', ') : undefined;
  })();

  const tilNoValidRangeCause = (() => {
    const parts: string[] = [];
    if (!fraISO && skadedatoMinRule.minBoundKind) parts.push('skadedato');
    if (fraISO) parts.push('fra-dato i samme række');
    parts.push('dags dato');
    if (!context.verserendeKlageMen && context.menAfgoerelseDatoForTabel) parts.push('dato for ménafgørelse');
    return parts.join(', ');
  })();

  const fraRangeErrorMessage = (() => {
    if (!fraISO) return undefined;
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
    if (!tilISO) return undefined;
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

  const computedRangeMessages = [fraRangeErrorMessage, tilRangeErrorMessage].filter(
    (m): m is string => typeof m === 'string' && m.trim() !== ''
  );

  const harFejl = computedRangeMessages.length > 0 || hasOverlap;

  if (!allFilled) {
    const manglerFelter: string[] = [];
    if (!hasFra) manglerFelter.push('Fra-dato');
    if (!hasTil) manglerFelter.push('Til-dato');
    if (!hasTilstand) manglerFelter.push('Tilstand');
    const field: 'fra' | 'til' | 'tilstand' = !hasFra ? 'fra' : !hasTil ? 'til' : 'tilstand';
    return { kind: 'error', message: `${joinManglerFelter(manglerFelter)} er ikke angivet`, field };
  }

  if (harFejl) {
    const fraFoerTilError = fraISO && tilISO && fraISO > tilISO ? DATE_ORDER_ERROR_MESSAGE : undefined;
    const allMessages = computedRangeMessages.map((m) => m.trim()).filter((m) => m !== '');
    const errorMessages = hasOverlap ? 'Der er overlappende perioder' : (fraFoerTilError ?? allMessages.join('; '));
    const field: 'fra' | 'til' | undefined = hasOverlap
      ? undefined
      : fraFoerTilError
        ? 'til'
        : fraRangeErrorMessage
          ? 'fra'
          : 'til';
    return { kind: 'error', message: errorMessages, field };
  }

  return { kind: 'ok' };
};

/**
 * Evaluerer alle svie/smerte-periode-rækker. Overlap beregnes på tværs af alle rækker
 * (samme `detectOverlappingPeriods` som validator/engine, jf. periodisering-contract §7).
 */
export const evaluateSvieSmertePerioder = (
  perioder: ReadonlyArray<SvieSmertePeriodeRowInput>,
  context: SvieSmertePeriodeBoundsContext
): ReadonlyMap<string, SvieSmertePeriodeEvaluation> => {
  const overlappingIds = detectOverlappingPeriods(perioder);
  const skadedatoMinRule = computeSkadedatoMinRule({
    skadedatoISO: context.skadedatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
  });

  const result = new Map<string, SvieSmertePeriodeEvaluation>();
  for (const periode of perioder) {
    result.set(periode.id, evaluateOne(periode, overlappingIds.has(periode.id), skadedatoMinRule, context));
  }
  return result;
};
