/**
 * Typer for EODebug domain layer
 */

import type { ISODateString } from '../../types/branded';

/**
 * Status for debug-rækker og integrity-checks
 *
 * - 'ok': Alt er konsistent og korrekt
 * - 'warning': Bør give anledning til overvejelse, men blokerer ikke beregning
 * - 'error': Åbenlyst forkert, blokerer beregning
 *
 * VIGTIGT: Denne type er canonical for hele MINEO.
 * Andre lag må IKKE definere egen status-type.
 *
 * @see eoDebugIntegrity.ts - Validering der producerer IntegrityIssue[]
 * @see eoDebugCommon.ts - Helper-funktioner der mapper issues til status
 */
export type DebugStatus = 'ok' | 'warning' | 'error';

/**
 * Severity for integrity-fejl
 */
export type IntegritySeverity = 'error' | 'warning';

/**
 * Invariant-typer for integrity checks
 */
export type IntegrityInvariant =
  | 'PERIOD_OVERLAP'
  | 'DATE_HOLES'
  | 'BASE_DATE_INCONSISTENT'
  | 'TAF_DAYS_MISMATCH'
  | 'SVIE_SMERTE_MISMATCH';

/**
 * Celle-værdi med både rå og formateret værdi
 */
export type CellValue<T> = {
  readonly rawValue: T;
  readonly displayValue: string;
};

/**
 * Debug-celle kan være enten structured (med raw+display) eller ren tekst
 */
export type DebugCellValue =
  | CellValue<number | ISODateString | string | boolean | null>
  | string;

/**
 * Integrity-problem fundet i debug-model
 */
export type IntegrityIssue = {
  readonly severity: IntegritySeverity;
  readonly invariant: IntegrityInvariant;
  readonly message: string;
  readonly affectedRows?: readonly number[];
  readonly expected?: number | string;
  readonly actual?: number | string;
};

/**
 * Dato-interval (inklusiv–inklusiv)
 */
export type DateRange = {
  readonly start: ISODateString;
  readonly end: ISODateString;
};

/**
 * Overlap-resultat mellem to dato-intervaller
 */
export type OverlapResult = {
  readonly overlaps: boolean;
  readonly start?: ISODateString;
  readonly end?: ISODateString;
  readonly kind?: 'partial' | 'contained' | 'contains' | 'touching';
};

/**
 * Svie/smerte niveau
 */
export type SvieSmerte = 'Ingen' | 'Delvis' | 'Fuld';

/**
 * Debug row model - Bruges af alle EODebug builders
 *
 * VIGTIGT: id skal være semantisk stabil (tied to field identity, ikke label eller array order).
 * Dette sikrer React key stability og gør debug output auditable.
 */
export type DebugRowGroup =
  | 'aes.varigeMen'
  | 'aes.midlertidigtEet'
  | 'aes.endeligtEet'
  | 'aes.oevrigt'
  | 'aes.differencekrav';

export type DebugRowModel = {
  id: string;
  label: string;
  displayValue: string;
  status: DebugStatus;
  group?: DebugRowGroup;
};

/**
 * Debug-dag – én dag i debug-tidslinjen
 *
 * FASE 2 SCOPE:
 * - Tidslinje-basis (dato, ugedag, weekend)
 * - Søgnehelligdage
 * - Arbejdsdag-klassifikation
 * - TAF-periode markering
 * - Svie/smerte-status
 *
 * IKKE i scope endnu:
 * - Løn-komponenter (kommer i senere fase)
 * - Offentlige ydelser (kommer i senere fase)
 */
export type DebugDay = {
  readonly iso: ISODateString;
  readonly weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=søndag, 1=mandag, ..., 6=lørdag
  readonly isWeekend: boolean;
  readonly isSognehelligdag: boolean;
  readonly isArbejdsdag: boolean;
  readonly tafFlags: ReadonlySet<string>; // Set af TAF-periode-IDs
  readonly svieSmerte: SvieSmerte;
};
