/**
 * Loen Types
 *
 * SCOPE:
 * - Type definitions for per-day loenkomponenter
 * - Ingen beregninger
 * - Ingen UI-viden
 * - Kun domain-begreber
 */

import type { ISODateString } from '../../types/branded';

// LOCKED: Løn/TAF gennemsyns-/kontrol-clusteret er færdig‑porteret.
// Ændr kun ved parity‑brud og dokumentér årsag.
/**
 * Loenkomponent-type (grundloenspakke)
 *
 * Begreber:
 * - grundloen: Grundloen
 * - feriegodtgorelse: Feriegodtgoerelse
 * - fritvalg: Fritvalg
 * - shSo: SH/SO-tillaeg
 * - storeBededag: Store Bededag-tillaeg
 * - pension: Pension
 */
export type LoenComponentType =
  | 'grundloen'
  | 'feriegodtgorelse'
  | 'fritvalg'
  | 'shSo'
  | 'storeBededag'
  | 'pension';

/**
 * Loenkomponent-kilde
 *
 * - overenskomst: Baseret paa overenskomst
 * - manuel: Manuelt indtastet
 * - regel: Domæneregel (fx Store Bededag)
 */
export type LoenComponentSource = 'overenskomst' | 'manuel' | 'regel';

/**
 * Loenkomponent
 *
 * Repraesenterer en loenkomponent paa en dag.
 */
export type LoenComponent = Readonly<{
  type: LoenComponentType;
  amount: number;
  source: LoenComponentSource;
}>;

/**
 * Daglig loen (grundloenspakke)
 */
export type DailyLoen = Readonly<{
  iso: ISODateString;
  components: readonly LoenComponent[];
  dailyTotal: number;
}>;

/**
 * Svie/smerte pr. dag (separat ydelse)
 */
export type DailySvieSmerte = Readonly<{
  iso: ISODateString;
  niveau: 'Fuld' | 'Delvis';
  amount: number;
}>;

/**
 * Loen timeline
 */
export type LoenTimeline = Readonly<{
  loenDays: readonly DailyLoen[];
  svieSmerteDays: readonly DailySvieSmerte[];
}>;

// Kontroltabel loen/TAF helpers
export type KontrolTabelWageColumnKey =
  | 'grundloen'
  | 'tillaeg'
  | 'ikkePensionsgivende'
  | 'atp'
  | 'fpFvShSoStb'
  | 'pension'
  | 'samlet';

export const kontrolTabelColumnId = {
  taf: 'base:taf_day',
  tafRegulering: (employmentIndex: number): `loen:${number}:taf_regulering` => `loen:${employmentIndex}:taf_regulering`,
  loenWage: (employmentIndex: number, wageKey: KontrolTabelWageColumnKey): `loen:${number}:wage:${KontrolTabelWageColumnKey}` =>
    `loen:${employmentIndex}:wage:${wageKey}`,
  offentlig: (ydelsestypeKey: string): `offentlig:${string}` => `offentlig:${ydelsestypeKey}`,
} as const;

export const WAGE_COLUMNS: ReadonlyArray<Readonly<{ key: KontrolTabelWageColumnKey; header: string }>> = [
  { key: 'grundloen', header: 'Løn' },
  { key: 'tillaeg', header: 'Løn (2)' },
  { key: 'ikkePensionsgivende', header: 'Ikke-pens.\ngivende løn' },
  { key: 'atp', header: 'ATP og anden\nløn u. tillæg' },
  { key: 'fpFvShSoStb', header: 'FP/FV/SH/\nSO/St.B.' },
  { key: 'pension', header: 'Pension' },
  { key: 'samlet', header: 'Samlet løn' },
];

// Kanoniske predikater/parsere for kolonne-id-grammatikken produceret af `kontrolTabelColumnId`.
// Ligger her, så ingen callsite hand-roller `offentlig:`/`:wage:`/`loen:<index>:`-mønstrene parallelt.

/** Sand for beløbskolonner: offentlige ydelser (`offentlig:…`) og løn-wage-kolonner (`…:wage:…`). */
export const isAmountColumnId = (id: string): boolean => id.startsWith('offentlig:') || id.includes(':wage:');

/**
 * Udleder ansættelsesforhold-indekset fra en `loen:<index>:…`-kolonne-id
 * (`taf_regulering` eller `wage:<key>`). Returnerer null for andre kolonne-id'er.
 */
export const parseEmploymentIndexFromColumnId = (columnId: string): number | null => {
  const match = columnId.match(/^loen:(\d+):(taf_regulering|wage:[^:]+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
};
