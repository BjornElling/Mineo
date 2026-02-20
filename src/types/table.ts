export type AarsloenTableColumnKey =
  | `col0_${'maaned' | 'uge' | 'dag'}`
  | `col1_${'maaned' | 'uge' | 'dag'}`
  | 'col2'
  | 'col3'
  | 'col4'
  | 'col5';

export type OffentligeYdelserTableColumnKey = 'fraDato' | 'tilDato' | 'ydelse' | 'tillaeg' | 'ydelsestype';

export type OffentligeYdelserTableCellErrorMap = Readonly<Record<string, true>>;

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
export type TableRowIssueReason = 'input' | 'missing';

export type AarsloenTableRowIssue = Readonly<{
  rowId: string;
  level: AarsloenTableRowIssueLevel;
}>;

export type AarsloenTableFirstErrorReason = TableRowIssueReason;

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
