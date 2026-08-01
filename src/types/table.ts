export type StandardLoenTableColumnKey =
  | `col0_${'maaned' | 'uge' | 'dag'}`
  | `col1_${'maaned' | 'uge' | 'dag'}`
  | 'col2'
  | 'col3'
  | 'col4'
  | 'col5'
  // Redigerbare tillægsbeløbskolonner i Beløb-tilstand (visningsposition for "FP/FV/SH/SO/St.B."
  // og "Arb.g. Pension"). I Procent-tilstand er disse positioner beregnede, ikke-redigerbare.
  | 'fpFvShSoBeloeb'
  | 'pensionBeloeb';

/**
 * De fem satser (procent) StandardLoenTable bruger til at beregne tillæg pr. række. Datatypen bor i
 * type-laget (ikke i tabel-komponenten), så det React-frie view-model-/afledningslag kan referere den
 * uden at importere fra `components/` (domæne→UI-kobling). Jf. domain-boundary-contract.
 */
export type StandardLoenTableSatser = {
  ferie?: number;
  fritvalg?: number;
  shSo?: number;
  bededag?: number;
  pension?: number;
};

export type OffentligeYdelserTableColumnKey = 'fraDato' | 'tilDato' | 'ydelse' | 'tillaeg' | 'ydelsestype';

export type OffentligeYdelserTableCellErrorMap = Readonly<Record<string, true>>;

export type TableError =
  | {
      kind: 'cell';
      issue: 'invalid' | 'partial_period' | 'missing_amount';
      rowId: string;
      colKey: StandardLoenTableColumnKey;
    }
  | {
      kind: 'table';
      reason: 'no_valid_rows';
    };

export type StandardLoenTableRowIssueLevel = 'error' | 'warning';
export type TableRowIssueReason = 'input' | 'missing';

export type StandardLoenTableRowIssue = Readonly<{
  rowId: string;
  level: StandardLoenTableRowIssueLevel;
}>;

export type StandardLoenTableFirstErrorReason = TableRowIssueReason;

export type StandardLoenTableFirstErrorCell = Readonly<{
  rowId: string;
  colKey: StandardLoenTableColumnKey;
  reason: StandardLoenTableFirstErrorReason;
}>;

export type StandardLoenTableValidationSummary = Readonly<{
  rowIssues: StandardLoenTableRowIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  firstErrorCell?: StandardLoenTableFirstErrorCell;
}>;

export type OffentligeYdelserTableRowIssueLevel = 'error' | 'warning';

export type OffentligeYdelserTableRowIssueReason = TableRowIssueReason;

export type OffentligeYdelserTableRowIssue = Readonly<{
  rowId: string;
  level: OffentligeYdelserTableRowIssueLevel;
  reason: OffentligeYdelserTableRowIssueReason;
}>;

export type OffentligeYdelserTableFirstErrorReason = TableRowIssueReason;

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
