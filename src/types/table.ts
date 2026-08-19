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
 * KOLONNENAVNENE – ét sandt sted (§3.2a).
 *
 * Standard-løn-tabellen vises af BÅDE Årsløn og EO-lønindkomst, som har hvert sit descriptor-katalog.
 * Navnene bor derfor her, i det neutrale type-lag, og forbruges tre steder: de to descriptor-kataloger
 * sætter dem som `label`, og `standardLoenTableColumns.ts` bygger gridoverskrifterne af dem. Ellers ville
 * samme kolonne kunne hedde én ting på skærmen og en anden i en fejlbesked om cellen – `col4` hed
 * «Ikke-pensionsgivende løn» i overskriften og «Løn (3)» i beskeden.
 *
 * Navnene står UDEN linjeskift. Overskriftens ombrydning er ren layout og tilføjes i
 * `standardLoenTableColumns.ts`.
 */
export const STANDARD_LOEN_COLUMN_LABELS: Readonly<Record<StandardLoenTableColumnKey, string>> =
  Object.freeze({
    col0_maaned: 'Måned',
    col1_maaned: 'År',
    col0_uge: 'Uge fra',
    col1_uge: 'Uge til',
    col0_dag: 'Dato fra',
    col1_dag: 'Dato til',
    col2: 'Løn',
    col3: 'Løn (2)',
    col4: 'Ikke-pensionsgivende løn',
    col5: 'ATP og anden løn u. tillæg',
    fpFvShSoBeloeb: 'FP/FV/SH/SO/St.B.',
    pensionBeloeb: 'Arb.g. Pension',
  });

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
