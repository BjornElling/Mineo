import type { ISODateString } from '../../../../types/branded';
import type { IsoRange } from '../../helpers/indtaegtPerioder';
import { getDayBeforeIso } from '../../../../utils/isoDateHelpers';
import { findLatestByDateInSortedList } from '../reguleringSeriesLookup';
import {
  parseOffentligLoenSelection,
  type OffentligLoenSelection,
  type OffentligLoenSelectionFailure,
} from '../../helpers/offentligLoenSelection';
import type { OffentligOverenskomstType } from '../../../../data/offentligLoenTypes';
import { parseDanishToIso } from '../../helpers/eoSharedUtils';
import type { KildeReguleringsInterval, LoenreguleringsSegment, LoenudviklingAf } from './reguleringForm';

// Delte primitiver for reguleringsform-modulerne. Flyttet fra loenudviklingBeregning.ts uden
// ændring, så flere form-moduler kan dele dem uden en fjerde kopi (jf. R1/R7). Rører kun
// struktur/placering – matematik og fejl-semantik er byte-identisk.

export const buildSegmentsFromStartDates = (
  range: IsoRange,
  starts: ReadonlySet<ISODateString>
): ReadonlyArray<IsoRange> => {
  const segmentStarts = Array.from(starts)
    .filter((iso) => iso > range.fra && iso <= range.til)
    .sort((a, b) => a.localeCompare(b));
  segmentStarts.unshift(range.fra);

  const segments: IsoRange[] = [];
  for (let i = 0; i < segmentStarts.length; i += 1) {
    const fra = segmentStarts[i];
    const til = i < segmentStarts.length - 1 ? getDayBeforeIso(segmentStarts[i + 1]) : range.til;
    if (!fra || !til || fra > til) continue;
    segments.push({ fra, til });
  }
  return segments;
};

export const buildZeroDeltaSegment = (segment: IsoRange): LoenreguleringsSegment => ({
  ...segment,
  deltaPct: 0,
});

/**
 * Projicerer et dansk-dato kilde-interval til ISO. Delt af de fire interval-baserede formers
 * `coverageInterval` (overenskomst/statistik/KRL/KL). `undefined` interval → `undefined`.
 */
export const toKildeReguleringsIntervalIso = (
  interval: Readonly<{ fraDato: string; tilDato: string }> | undefined
): KildeReguleringsInterval | undefined =>
  interval
    ? { fraIso: parseDanishToIso(interval.fraDato), tilIso: parseDanishToIso(interval.tilDato) }
    : undefined;

export const ensurePositiveFiniteNumber = (
  value: number | undefined,
  errorMessage: string
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(errorMessage);
  }
  return value;
};

export const resolveEffectiveBaseEntry = <T extends { startIso: ISODateString }>(
  sortedItems: readonly T[],
  date: ISODateString,
  context: string,
  missingMessage: string
): T => {
  // Anker basis til seneste sats <= reguleringsdato. Ligger reguleringsdatoen før
  // første sats, ankres til ældste sats (fallback); denne "før første sats"-tilstand
  // er ikke en motorfejl, men gates synligt og blokerende i række-laget
  // (eoRowIndkomstRows: reguleringsvaerdi-error, aligned med tabellens fraDato).
  // Se reguleringSilentPathAlignment.test.ts, der pinner den alignment.
  const baseEntry = findLatestByDateInSortedList(sortedItems, date, `${context}:base`);
  if (baseEntry) return baseEntry;
  const firstEntry = sortedItems[0];
  if (!firstEntry) {
    throw new Error(missingMessage);
  }
  return firstEntry;
};

type UniformPrimitive = string | number | boolean | null;

export class InkonsistenteLoenudviklingsIndstillingerError extends Error {
  readonly fieldLabel: string;

  constructor(fieldLabel: string) {
    super(`Inkonsistente loenudviklingsindstillinger: ${fieldLabel}`);
    this.name = 'InkonsistenteLoenudviklingsIndstillingerError';
    this.fieldLabel = fieldLabel;
  }
}

export const assertUniform = (
  active: readonly LoenudviklingAf[],
  selector: (af: LoenudviklingAf) => UniformPrimitive,
  fieldLabel: string
): void => {
  if (active.length <= 1) return;
  const first = selector(active[0]);
  for (let i = 1; i < active.length; i += 1) {
    const current = selector(active[i]);
    if (current !== first) {
      throw new InkonsistenteLoenudviklingsIndstillingerError(fieldLabel); // invariant: dækket af validator
    }
  }
};

// Feltspecifikke throw-beskeder (fail-closed) – beregningsstien må aldrig degradere til
// zero-delta ved manglende/ugyldig indplacering. Mapper den delte parsers `reason` til de
// hidtidige beskeder, så adfærd og ordlyd er uændret.
const OFFENTLIG_LOEN_SELECTION_THROW_MESSAGE: Readonly<Record<OffentligLoenSelectionFailure, string>> = {
  'loentype-mangler': 'Loenudvikling kan ikke beregnes: ansættelse er ikke valgt',
  'trin-mangler': 'Loenudvikling kan ikke beregnes: løntrin mangler',
  'trin-ugyldig': 'Loenudvikling kan ikke beregnes: løntrin skal være mellem 1 og 55',
  'gruppe-mangler': 'Loenudvikling kan ikke beregnes: gruppe mangler',
  'gruppe-ugyldig': 'Loenudvikling kan ikke beregnes: gruppe skal være mellem 0 og 4',
};

export const resolveOffentligLoenSelection = (
  af: LoenudviklingAf,
  offentligType: OffentligOverenskomstType
): OffentligLoenSelection => {
  const result = parseOffentligLoenSelection({
    offentligType,
    offentligLoenType: af.offentligLoenType,
    offentligLoenTrin: af.offentligLoenTrin,
    offentligLoenGruppe: af.offentligLoenGruppe,
  });
  if (!result.ok) {
    throw new Error(OFFENTLIG_LOEN_SELECTION_THROW_MESSAGE[result.reason]);
  }
  return result.selection;
};
