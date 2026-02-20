/**
 * Centrale type definitions for MINEO
 *
 * Denne fil indeholder alle genbrugte TypeScript types og interfaces
 * der bruges på tværs af applikationen.
 */

import type { z } from 'zod';
import {
  loenperiodeSchema,
  loenPaaHelligdageSchema,
  type LoenindkomstAnsaettelsesforhold,
  type AarsloenTableRow as CanonicalAarsloenTableRow,
  type AarsloenValues as CanonicalAarsloenValues,
  type ErstatningsopgoerelseValues as CanonicalErstatningsopgoerelseValues,
  type FerieperiodeRow as CanonicalFerieperiodeRow,
  type OffentligeYdelserRow as CanonicalOffentligeYdelserRow,
  type OevrigeKravRow as CanonicalOevrigeKravRow,
  type RenteberegningValues as CanonicalRenteberegningValues,
  type SatserValues as CanonicalSatserValues,
  type StamdataValues as CanonicalStamdataValues,
  type SvieSmertePeriodeRow as CanonicalSvieSmertePeriodeRow,
  type TafPeriodeRow as CanonicalTafPeriodeRow,
  type VarigeMenValues as CanonicalVarigeMenValues,
} from '../schemas/formSchemas';
import type { EoFileData as SchemaEoFileData } from '../schemas/eoFileSchema';

// =============================================================================
// FORM VALUES TYPES
// =============================================================================

export type StamdataValues = CanonicalStamdataValues;
export type SatserValues = CanonicalSatserValues;

/**
 * Lønperiode type (bruges i årsløn og tabeller)
 * Inferret fra Zod schema
 */
export type Loenperiode = z.infer<typeof loenperiodeSchema>;

/**
 * Constants for Lønperiode
 */
export const LOENPERIODE = {
  MAANED: 'maaned' as const,
  UGE: 'uge' as const,
  DAG: 'dag' as const,
} satisfies Record<string, Loenperiode>;

/**
 * Løn på helligdage type
 * Inferret fra Zod schema
 */
export type LoenPaaHelligdage = z.infer<typeof loenPaaHelligdageSchema>;

/**
 * Constants for Løn på helligdage
 */
export const LOEN_PAA_HELLIGDAGE = {
  ALMINDELIG: 'Almindelig løn' as const,
  SH_UDBETALING: 'SH-udbetaling' as const,
  INGEN: 'Ingen' as const,
} satisfies Record<string, LoenPaaHelligdage>;

export type AarsloenTableRow = CanonicalAarsloenTableRow;
export type AarsloenValues = CanonicalAarsloenValues;

export type RenteberegningValues = CanonicalRenteberegningValues;

export type VarigeMenValues = CanonicalVarigeMenValues;
export type SvieSmertePeriodeRow = CanonicalSvieSmertePeriodeRow;
export type TafPeriodeRow = CanonicalTafPeriodeRow;
export type FerieperiodeRow = CanonicalFerieperiodeRow;
export type OevrigeKravRow = CanonicalOevrigeKravRow;
export type OffentligeYdelserRow = CanonicalOffentligeYdelserRow;
export type ErstatningsopgoerelseValues = CanonicalErstatningsopgoerelseValues;

// =============================================================================
// BEREGNINGS-RESULTATER
// =============================================================================

/**
 * Dato-set (interval) brugt i beregninger
 */
export interface DateInterval {
  start: Date;
  end: Date;
}

/**
 * Beregningsmetode for årsløn
 */
export type AarsloenMetode = 'A' | 'B' | 'C' | 'ingen';

/**
 * Resultat fra årsløn-beregning
 */
export interface AarsloenBeregningResult {
  metode: AarsloenMetode;
  erEtAar: boolean;
  hverdageIPeriode?: number;
  feriedageFraInput?: number;
  arbejdsdageIPeriode?: number;
  feriedagePaaAar?: number;
  arbejdsdagePaaAar?: number;
  hverdagePaaAar?: number;
  omregnetAarsloen?: number;
  antalMaaneder?: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Event type for form field changes
 */
export interface FormFieldChangeEvent {
  target: {
    value: unknown;
  };
}

/**
 * Generic change handler type
 */
export type ChangeHandler = (event: FormFieldChangeEvent) => void;

/**
 * Generic form values type
 */
export type FormValues = Record<string, unknown>;

export type AarsloenTableColumnKey =
  | `col0_${'maaned' | 'uge' | 'dag'}`
  | `col1_${'maaned' | 'uge' | 'dag'}`
  | 'col2'
  | 'col3'
  | 'col4'
  | 'col5';

export type OffentligeYdelserTableColumnKey = 'fraDato' | 'tilDato' | 'ydelse' | 'tillaeg' | 'ydelsestype';

export type OffentligeYdelserTableCellErrorMap = Readonly<Record<string, true>>;

/**
 * Tabel-fejl type (trust-critical):
 * - Cellefejl bindes til `rowId` (ikke row-index), så sortering ikke kan forveksle rækker.
 * - Tabel-fejl har ingen celle-position.
 */
export type TableError =
  | {
      kind: 'cell';
      issue: 'invalid' | 'partial_period';
      rowId: string;
      colKey: AarsloenTableColumnKey;
    }
  | {
      kind: 'table';
      reason: 'no_valid_rows';
    };

export type AarsloenTableRowIssueLevel = 'error' | 'warning';

export type AarsloenTableRowIssue = Readonly<{
  rowId: string;
  level: AarsloenTableRowIssueLevel;
}>;

export type AarsloenTableFirstErrorReason = 'input' | 'missing';

export type AarsloenTableFirstErrorCell = Readonly<{
  rowId: string;
  colKey: AarsloenTableColumnKey;
  reason: AarsloenTableFirstErrorReason;
}>;

export type AarsloenTableValidationSummary = Readonly<{
  rowIssues: AarsloenTableRowIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  firstErrorCell?: AarsloenTableFirstErrorCell;
}>;

export type OffentligeYdelserTableRowIssueLevel = 'error' | 'warning';

export type OffentligeYdelserTableRowIssueReason = 'input' | 'missing';

export type OffentligeYdelserTableRowIssue = Readonly<{
  rowId: string;
  level: OffentligeYdelserTableRowIssueLevel;
  reason: OffentligeYdelserTableRowIssueReason;
}>;

export type OffentligeYdelserTableFirstErrorReason = 'input' | 'missing';

export type OffentligeYdelserTableFirstErrorCell = Readonly<{
  rowId: string;
  colKey: OffentligeYdelserTableColumnKey;
  reason: OffentligeYdelserTableFirstErrorReason;
}>;

export type OffentligeYdelserTableValidationSummary = Readonly<{
  rowIssues: OffentligeYdelserTableRowIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  firstErrorCell?: OffentligeYdelserTableFirstErrorCell;
}>;

// =============================================================================
// COMPONENT REF HANDLES
// =============================================================================

/**
 * Imperative handle for AarsloenTable component
 */
export interface AarsloenTableHandle {
  getErrors: () => TableError[];
  getValidationSummary: () => AarsloenTableValidationSummary;
  showMissingEntryError: (cell: AarsloenTableFirstErrorCell) => void;
  flashError: (error: Extract<TableError, { kind: 'cell' }>) => void;
}

export interface OffentligeYdelserTableHandle {
  getValidationSummary: () => OffentligeYdelserTableValidationSummary;
  showMissingEntryError: (cell: OffentligeYdelserTableFirstErrorCell) => void;
}

/**
 * Imperative handle for StyledToggleSwitch component
 */
export interface StyledToggleSwitchHandle {
  shake: () => void;
}

// =============================================================================
// PERSISTENCE TYPES
// =============================================================================

/**
 * Versioneret persisted data wrapper
 *
 * Al data gemt i sessionStorage wrappes i denne struktur
 * for at understøtte fremtidig versionering og migration.
 */
export interface PersistedData<T = unknown> {
  /** Data format version (semantic versioning) */
  version: string;
  /** Tidspunkt for gemning (Unix timestamp) */
  timestamp: number;
  /** Faktisk data fra formularen */
  data: T;
}

// =============================================================================
// FILE SYSTEM TYPES
// =============================================================================

export type EoFileData = SchemaEoFileData;

/**
 * File handle med metadata
 */
export interface FileHandleWithMetadata {
  handle: FileSystemFileHandle;
  name: string;
  lastModified: number;
}
