export type StandardLoenTableColumnKey =
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
