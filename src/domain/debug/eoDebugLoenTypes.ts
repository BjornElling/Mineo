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

// LOCKED: Løn/TAF debug-clusteret er færdig‑porteret.
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

// Debug tabel loen/TAF helpers
export type DebugTabelWageColumnKey =
  | 'grundloen'
  | 'tillaeg'
  | 'ikkePensionsgivende'
  | 'atp'
  | 'loenPlusLoen2PlusIkkePensLoen'
  | 'fpFvShSoStb'
  | 'pension'
  | 'samlet';

export const debugTabelColumnId = {
  taf: 'base:taf_day',
  tafRegulering: (employmentIndex: number): `loen:${number}:taf_regulering` => `loen:${employmentIndex}:taf_regulering`,
  loenWage: (employmentIndex: number, wageKey: DebugTabelWageColumnKey): `loen:${number}:wage:${DebugTabelWageColumnKey}` =>
    `loen:${employmentIndex}:wage:${wageKey}`,
  offentlig: (ydelsestypeKey: string): `offentlig:${string}` => `offentlig:${ydelsestypeKey}`,
} as const;

export const WAGE_COLUMNS: ReadonlyArray<Readonly<{ key: DebugTabelWageColumnKey; header: string }>> = [
  { key: 'grundloen', header: 'Løn' },
  { key: 'tillaeg', header: 'Løn (2)' },
  { key: 'ikkePensionsgivende', header: 'Ikke-pens.\ngivende løn' },
  { key: 'atp', header: 'ATP og anden\nløn u. tillæg' },
  { key: 'loenPlusLoen2PlusIkkePensLoen', header: 'Løn+Løn2+\nløn u. tillæg' },
  { key: 'fpFvShSoStb', header: 'FP/FV/SH/\nSO/St.B.' },
  { key: 'pension', header: 'Pension' },
  { key: 'samlet', header: 'Samlet løn' },
];
