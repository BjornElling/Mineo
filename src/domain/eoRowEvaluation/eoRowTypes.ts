/**
 * Typer for EO-række-evaluering og den nedstrøms EODebug-visning.
 */

import type { ISODateString } from '../../types/branded';

/**
 * Status for EO-rækker og integrity-checks
 *
 * - 'ok': Alt er konsistent og korrekt
 * - 'warning': Bør give anledning til overvejelse, men blokerer ikke beregning
 * - 'error': Åbenlyst forkert, blokerer beregning
 *
 * VIGTIGT: Denne type er canonical for hele Mineo.
 * Andre lag må IKKE definere egen status-type.
 *
 * @see eoDebugIntegrity.ts - Validering der producerer IntegrityIssue[]
 * @see eoRowCommon.ts - Helper-funktioner der mapper issues til status
 */
export type EoRowStatus = 'ok' | 'warning' | 'error';

/**
 * Severity for integrity-fejl
 */
export type IntegritySeverity = Exclude<EoRowStatus, 'ok'>;

/**
 * Invariant-typer for integrity checks
 */
export const IntegrityInvariant = {
  PERIOD_OVERLAP: 'PERIOD_OVERLAP',
  DATE_HOLES: 'DATE_HOLES',
  BASE_DATE_INCONSISTENT: 'BASE_DATE_INCONSISTENT',
  TAF_DAYS_MISMATCH: 'TAF_DAYS_MISMATCH',
  SVIE_SMERTE_MISMATCH: 'SVIE_SMERTE_MISMATCH',
} as const;

export type IntegrityInvariantValue =
  typeof IntegrityInvariant[keyof typeof IntegrityInvariant];

export type PrimitiveCell =
  number | ISODateString | string | boolean | null;

/**
 * Celle-værdi med både rå og formateret værdi
 */
export type CellValue<T extends PrimitiveCell> = {
  readonly rawValue: T;
  readonly displayValue: string;
};

/**
 * Debug-celle kan være enten structured (med raw+display) eller ren tekst
 */
export type DebugCellValue =
  | CellValue<PrimitiveCell>
  | string;

/**
 * Integrity-problem fundet i debug-model
 */
export type IntegrityIssue = {
  readonly severity: IntegritySeverity;
  readonly invariant: IntegrityInvariantValue;
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
 * EO row model - bruges af både download-gaten og EODebug.
 *
 * VIGTIGT: id skal være semantisk stabil (tied to field identity, ikke label eller array order).
 * Dette sikrer React key stability og gør række-output auditérbart.
 */
export type EoRowGroup =
  | 'aes.varigeMen'
  | 'aes.midlertidigtEet'
  | 'aes.endeligtEet'
  | 'aes.oevrigt'
  | 'aes.differencekrav';

export type DependencySpec =
  | Readonly<{ kind: 'id'; id: string }>
  | Readonly<{ kind: 'prefix'; prefix: string }>;

export type EoIssueFocusTarget =
  | Readonly<{ kind: 'fieldPath'; fieldPath: string }>
  | Readonly<{ kind: 'rowId'; rowId: string }>;

export type EoRowModel = {
  id: string;
  label: string;
  displayValue: string;
  // Status er rækkens max-severity for UI (ikke issue-niveau).
  status: EoRowStatus;
  // Optional domænemeddelelse (uden "Fejl (...)" / "Advarsel (...)").
  message?: string;
  // Optional præsentationshint til Beregning-fanen.
  summaryDisplay?: 'default' | 'messageOnly';
  // Optional færdig fejl-/advarselslinje til "Fejl og advarsler".
  summaryText?: string;
  // Optional primært DOM-mål for fejl-/advarselslink. Bruges før række-/sektionsfallback.
  focusTarget?: EoIssueFocusTarget;
  group?: EoRowGroup;
  dependsOn?: ReadonlyArray<DependencySpec>;
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
