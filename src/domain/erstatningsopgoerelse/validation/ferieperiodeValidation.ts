import type { ISODateString } from '../../../types/branded';
import { computeRowDateBounds } from '../helpers/rowDateBounds';
import { validateISODateRange } from '../../../utils/isoDateHelpers';
import { detectOverlappingPeriods } from '../engines/periodOverlapDetection';
import { computeSkadedatoMinRule, dateRanges_erstatningsopgoerelse, TODAY } from '../../../config/dateRanges';
import { buildNoValidDateRangeMessage, isNonEmptyString } from './eoDateRangeMessages';
import {
  computeTafCombinedExtraMaxDate,
  type TafPeriodeBoundsContext,
  type TafPeriodeEvaluation,
} from './tafPeriodeValidation';

/**
 * Ren (React-/kontrol-frit) blokerings-afgørelse for TAF-ferieperiode-rækker (`taf.ferie.*`).
 *
 * AUTORITATIV kilde til om en ferieperiode blokerer (komplethed, dato-grænser, overlap) — disse
 * tjek findes IKKE i `erstatningsopgoerelseValidator` (som slet ikke validerer ferieperioder), så
 * de var hidtil kun håndhævet inde i DEV-kontrol-builderens display-formattering (jf. B9).
 *
 * Deler dato-grænserne (`computeTafCombinedExtraMaxDate`, skadedato-min) med TAF-periode-
 * valideringen. Bemærk de bevidste forskelle fra TAF-perioder, der bevares 1:1:
 *  - ingen cutoff-efter-differencekrav/EET-fejl (kun selve dato-intervallet),
 *  - ingen eksplicit rækkefølge-besked (fra>til fanges via interval-grænsen),
 *  - til-dato-årsagsteksten nævner ikke midlertidigt EET (selv om grænsen indeholder det).
 */

export type FerieperiodeRowInput = Readonly<{
  id: string;
  fra?: ISODateString;
  til?: ISODateString;
}>;

const evaluateOne = (
  periode: FerieperiodeRowInput,
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
    tilFallbackMax: TODAY,
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
    return parts.join(', ');
  })();

  const validateRowDate = (
    iso: ISODateString,
    minDate: ISODateString,
    maxDate: ISODateString,
    noValidRangeCause: string | undefined
  ): string | undefined => {
    if (minDate > maxDate) {
      return buildNoValidDateRangeMessage({ minDate, maxDate, noValidRangeCause });
    }
    const result = validateISODateRange(iso, minDate, maxDate);
    return result.isValid ? undefined : result.errorMessage;
  };

  const fraRangeMessage = validateRowDate(fraISO, bounds.fra.min, bounds.fra.max, fraNoValidRangeCause);
  const tilRangeMessage = validateRowDate(tilISO, bounds.til.min, bounds.til.max, tilNoValidRangeCause);
  const computedRangeMessages = [fraRangeMessage, tilRangeMessage].filter(
    (m): m is string => typeof m === 'string' && m.trim() !== ''
  );

  if (hasOverlap || computedRangeMessages.length > 0) {
    const message = hasOverlap ? 'Der er overlappende perioder' : computedRangeMessages.join('; ');
    const field: 'fra' | 'til' | undefined = hasOverlap
      ? undefined
      : fraRangeMessage
        ? 'fra'
        : 'til';
    return { kind: 'error', message, field };
  }

  return { kind: 'ok' };
};

export const evaluateFerieperioder = (
  ferieperioder: ReadonlyArray<FerieperiodeRowInput>,
  context: TafPeriodeBoundsContext
): ReadonlyMap<string, TafPeriodeEvaluation> => {
  const overlappingIds = detectOverlappingPeriods(ferieperioder);
  const skadedatoMinRule = computeSkadedatoMinRule({
    skadedatoISO: context.skadedatoISO,
    erErhvervssygdom: context.erErhvervssygdom,
    fallbackMin: dateRanges_erstatningsopgoerelse.tabelTAFFra.fallbackMin,
  });
  const combinedExtraMaxDate = computeTafCombinedExtraMaxDate(context);

  const result = new Map<string, TafPeriodeEvaluation>();
  for (const periode of ferieperioder) {
    result.set(
      periode.id,
      evaluateOne(periode, overlappingIds.has(periode.id), skadedatoMinRule, combinedExtraMaxDate, context)
    );
  }
  return result;
};
