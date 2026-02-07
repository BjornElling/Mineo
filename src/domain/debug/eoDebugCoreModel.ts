/**
 * Core debug model - bygger DebugDay[] tidslinje
 *
 * VIGTIGT: Dette er kalender-sandhed, ikke beregnings-sandhed.
 * Ingen løn, ingen beløb, ingen regulering.
 */

import type { ISODateString } from '../../types/branded';
import type {
  StamdataValues,
  ErstatningsopgoerelseValues,
  TafPeriodeRow,
  SvieSmertePeriodeRow,
} from '../../types/common';
import type { DebugDay, SvieSmerte } from './eoDebugTypes';
import { getIsoRange, minDate, maxDate } from './eoDebugDateUtils';
import { beregnHelligdage } from '../../utils/shDageBeregning';
import { subtractOneDay, toISODateString } from '../../types/branded';
import { clampTafRange, resolveTafConstraintBounds } from '../erstatningsopgoerelse/tafPeriodConstraints';

/**
 * Input til debug core model
 */
export type DebugModelInput = {
  readonly stamdataValues: StamdataValues;
  readonly erstatningsopgoerelseValues: ErstatningsopgoerelseValues;
};

/**
 * Konverterer dansk dato (dd-mm-åååå) til ISO (åååå-mm-dd)
 */
const _danishToIso = (danish: string): ISODateString | undefined => {
  if (!danish || typeof danish !== 'string') return undefined;
  const parts = danish.split('-');
  if (parts.length !== 3) return undefined;

  const day = parts[0]?.padStart(2, '0');
  const month = parts[1]?.padStart(2, '0');
  const year = parts[2];

  if (!day || !month || !year) return undefined;

  try {
    return toISODateString(`${year}-${month}-${day}`);
  } catch {
    return undefined;
  }
};

/**
 * Helper til at validere og konvertere til ISODateString
 *
 * VIGTIGT: Data kommer allerede i ISO-format fra persistence layer
 */
const tryParseIso = (value: unknown): ISODateString | undefined => {
  if (!value || typeof value !== 'string' || value.trim() === '') return undefined;
  try {
    return toISODateString(value);
  } catch {
    return undefined;
  }
};

/**
 * Udtræk alle relevante datoer fra input
 *
 * VIGTIGT: Data kommer allerede i ISO-format fra persistence layer
 */
const extractDateSources = (
  input: DebugModelInput
): { start: ISODateString; end: ISODateString } | undefined => {
  const dates: ISODateString[] = [];

  // Skadesdato (allerede ISO-format)
  const skadesdato = tryParseIso(input.stamdataValues.skadesdato);
  if (skadesdato) dates.push(skadesdato);

  // Erstatningsopgørelse periode (allerede ISO-format)
  const eoFra = tryParseIso(input.erstatningsopgoerelseValues.vedroererPeriodeFra);
  const eoTil = tryParseIso(input.erstatningsopgoerelseValues.vedroererPeriodeTil);
  if (eoFra) dates.push(eoFra);
  if (eoTil) dates.push(eoTil);

  const erstatningsRange = eoFra && eoTil && eoFra <= eoTil ? { fra: eoFra, til: eoTil } : undefined;

  const menStopDato =
    input.erstatningsopgoerelseValues.varigeMenAfgorelse === 'Ja' &&
    input.erstatningsopgoerelseValues.verserendeKlageMen !== 'Ja'
      ? subtractOneDay(tryParseIso(input.erstatningsopgoerelseValues.menAfgoerelseDato))
      : undefined;

  // TAF-perioder (allerede ISO-format, men afgrænses af erstatningsperioden)
  const tafPerioder = input.erstatningsopgoerelseValues.tafPerioder ?? [];
  const tafBounds = resolveTafConstraintBounds(input.erstatningsopgoerelseValues);
  for (const periode of tafPerioder) {
    const fra = tryParseIso(periode.fra);
    const til = tryParseIso(periode.til);
    if (!fra || !til || fra > til) continue;
    const clamped = clampTafRange({ fra, til }, tafBounds) ?? { fra, til };
    dates.push(clamped.fra);
    dates.push(clamped.til);
  }

  // Svie/smerte-perioder (allerede ISO-format, men afgrænses af erstatningsperioden)
  const ssPerioder = input.erstatningsopgoerelseValues.svieSmertePerioder ?? [];
  for (const periode of ssPerioder) {
    const fra = tryParseIso(periode.fra);
    const til = tryParseIso(periode.til);
    if (!fra || !til || fra > til) continue;
    let clampedFra = fra;
    let clampedTil = til;
    if (erstatningsRange) {
      if (clampedFra < erstatningsRange.fra) clampedFra = erstatningsRange.fra;
      if (clampedTil > erstatningsRange.til) clampedTil = erstatningsRange.til;
    }
    if (menStopDato && clampedTil > menStopDato) clampedTil = menStopDato;
    if (clampedFra > clampedTil) continue;
    dates.push(clampedFra);
    dates.push(clampedTil);
  }

  if (dates.length === 0) return undefined;

  const start = minDate(dates);
  const end = maxDate(dates);

  if (!start || !end) return undefined;

  return { start, end };
};

/**
 * Byg Set af søgnehelligdage (ISO format) for relevante år
 */
const buildSognehelligdageSet = (
  startIso: ISODateString,
  endIso: ISODateString
): ReadonlySet<ISODateString> => {
  const [startYear] = startIso.split('-').map(Number);
  const [endYear] = endIso.split('-').map(Number);

  const shSet = new Set<ISODateString>();

  for (let year = startYear; year <= endYear; year++) {
    const helligdage = beregnHelligdage(year);

    for (const helligdag of helligdage) {
      // Kun hverdage (mandag-fredag)
      const dayOfWeek = helligdag.getUTCDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const isoStr = `${helligdag.getUTCFullYear()}-${String(
          helligdag.getUTCMonth() + 1
        ).padStart(2, '0')}-${String(helligdag.getUTCDate()).padStart(2, '0')}`;

        try {
          const iso = toISODateString(isoStr);
          shSet.add(iso);
        } catch {
          // Ignorer ugyldige datoer
        }
      }
    }
  }

  return shSet;
};

/**
 * Byg TAF-periode map: ISO → Set<periode-ID>
 *
 * VIGTIGT: Data kommer allerede i ISO-format fra persistence layer
 */
const buildTafPeriodeMap = (
  tafPerioder: readonly TafPeriodeRow[],
  tafBounds: Readonly<{ minStart?: ISODateString; maxEnd?: ISODateString }>
): ReadonlyMap<ISODateString, Set<string>> => {
  const map = new Map<ISODateString, Set<string>>();

  for (const periode of tafPerioder) {
    const fra = tryParseIso(periode.fra);
    const til = tryParseIso(periode.til);

    if (!fra || !til) continue;
    if (fra > til) continue;

    const clamped = clampTafRange({ fra, til }, tafBounds);
    if (!clamped) continue;
    const isoRange = getIsoRange(clamped.fra, clamped.til);

    for (const iso of isoRange) {
      if (!map.has(iso)) {
        map.set(iso, new Set());
      }
      map.get(iso)!.add(periode.id);
    }
  }

  return map;
};

/**
 * Byg svie/smerte map: ISO → niveau
 *
 * VIGTIGT: Data kommer allerede i ISO-format fra persistence layer
 */
const buildSvieSmerte = (
  ssPerioder: readonly SvieSmertePeriodeRow[],
  bounds: Readonly<{ erstatningsRange?: Readonly<{ fra: ISODateString; til: ISODateString }>; menStopDato?: ISODateString }>
): ReadonlyMap<ISODateString, SvieSmerte> => {
  const map = new Map<ISODateString, SvieSmerte>();

  for (const periode of ssPerioder) {
    const fra = tryParseIso(periode.fra);
    const til = tryParseIso(periode.til);

    if (!fra || !til) continue;
    if (fra > til) continue;

    let clampedFra = fra;
    let clampedTil = til;
    if (bounds.erstatningsRange) {
      if (clampedFra < bounds.erstatningsRange.fra) clampedFra = bounds.erstatningsRange.fra;
      if (clampedTil > bounds.erstatningsRange.til) clampedTil = bounds.erstatningsRange.til;
    }
    if (bounds.menStopDato && clampedTil > bounds.menStopDato) clampedTil = bounds.menStopDato;
    if (clampedFra > clampedTil) continue;

    let niveau: SvieSmerte;
    switch (periode.tilstand) {
      case 'sygemeldt':
        niveau = 'Fuld';
        break;
      case 'delvist-sygemeldt':
        niveau = 'Delvis';
        break;
      default:
        niveau = 'Ingen';
    }

    const isoRange = getIsoRange(clampedFra, clampedTil);

    for (const iso of isoRange) {
      // Højeste niveau vinder ved overlap
      const existing = map.get(iso);
      if (!existing || niveau === 'Fuld' || (niveau === 'Delvis' && existing === 'Ingen')) {
        map.set(iso, niveau);
      }
    }
  }

  return map;
};

/**
 * Byg DebugDay[] tidslinje
 *
 * FASE 2 SCOPE:
 * - Tidslinje (alle dage)
 * - Weekday, weekend
 * - Søgnehelligdage
 * - Arbejdsdag-klassifikation
 * - TAF-perioder (markering)
 * - Svie/smerte-status
 *
 * IKKE i scope:
 * - Løn, beløb, regulering
 * - Offentlige ydelser
 * - Integrity checks (kommer i Fase 3)
 *
 * @param input - Form values
 * @returns Array af DebugDay (tom hvis ingen gyldige datoer)
 */
export function buildDebugCoreModel(input: DebugModelInput): readonly DebugDay[] {
  // Udtræk dato-interval
  const dateRange = extractDateSources(input);

  if (!dateRange) {
    return [];
  }

  const { start, end } = dateRange;

  // Byg søgnehelligdage-set
  const sognehelligdageSet = buildSognehelligdageSet(start, end);

  // Byg TAF-periode map
  const tafPerioder = input.erstatningsopgoerelseValues.tafPerioder ?? [];
  const tafBounds = resolveTafConstraintBounds(input.erstatningsopgoerelseValues);
  const tafMap = buildTafPeriodeMap(tafPerioder, tafBounds);

  // Byg svie/smerte map
  const ssPerioder = input.erstatningsopgoerelseValues.svieSmertePerioder ?? [];
  const erstatningsFra = tryParseIso(input.erstatningsopgoerelseValues.vedroererPeriodeFra);
  const erstatningsTil = tryParseIso(input.erstatningsopgoerelseValues.vedroererPeriodeTil);
  const erstatningsRange =
    erstatningsFra && erstatningsTil && erstatningsFra <= erstatningsTil ? { fra: erstatningsFra, til: erstatningsTil } : undefined;
  const menStopDato =
    input.erstatningsopgoerelseValues.varigeMenAfgorelse === 'Ja' &&
    input.erstatningsopgoerelseValues.verserendeKlageMen !== 'Ja'
      ? subtractOneDay(tryParseIso(input.erstatningsopgoerelseValues.menAfgoerelseDato))
      : undefined;
  const ssMap = buildSvieSmerte(ssPerioder, { erstatningsRange, menStopDato });

  // Generer alle dage i intervallet
  const isoRange = getIsoRange(start, end);
  const debugDays: DebugDay[] = [];

  for (const iso of isoRange) {
    // Parse til Date for weekday-beregning
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const weekday = date.getUTCDay(); // 0=søndag, 1=mandag, ..., 6=lørdag

    // Weekend-check
    const isWeekend = weekday === 0 || weekday === 6;

    // Søgnehelligdag-check
    const isSognehelligdag = sognehelligdageSet.has(iso);

    // Arbejdsdag = hverdag (man-fre) OG ikke søgnehelligdag
    const isArbejdsdag = !isWeekend && !isSognehelligdag;

    // TAF-flags
    const tafFlags = tafMap.get(iso) ?? new Set<string>();

    // Svie/smerte
    const svieSmerte = ssMap.get(iso) ?? 'Ingen';

    debugDays.push({
      iso,
      weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      isWeekend,
      isSognehelligdag,
      isArbejdsdag,
      tafFlags,
      svieSmerte,
    });
  }

  return debugDays;
}
