import type { ErstatningsopgoerelseValues, StandardLoenTableRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { FieldAddress } from '../../inputCore/fieldAddress';
import { FIELD_ISSUE_GENERIC_TOOLTIP, resolveFieldIssueTooltip, type FieldIssue } from '../../inputCore/inputIssue';
import { bindCollectionCell } from '../../inputCore/collectionCellBinding';
import type { StandardLoenTableColumnKey, TableError } from '../../types/table';
import { getStandardLoenTableValidation } from '../standardLoen/standardLoenTableValidation';
import type { StandardLoenTableFieldSet } from '../standardLoen/standardLoenTableFieldSet';
import { formatStandardLoenRowName, type StandardLoenRowWarning } from '../standardLoen/standardLoenRowWarnings';
import { resolveStandardLoenColumnLabel } from '../aarsloen/standardLoenTableColumns';
import { createEoStandardLoenFieldSet } from '../erstatningsopgoerelse/eoStandardLoenFieldSet';
import { buildStandardLoenCellErrors } from '../erstatningsopgoerelse/validation/indkomstRowValidation';
import { resolveLoenindkomstRowWarnings } from '../erstatningsopgoerelse/validation/eoIncomeRowWarnings';
import type { EoRowStatus } from './eoRowTypes';

// Indtægtstabellens linjer i «Fejl og advarsler»: ÉN linje pr. lønrække med en fejl eller advarsel, der
// navngiver rækken, siger cellens egen tekst og linker til cellen (BB-291).
//
// Før stod der én linje for hele tabellen, bygget af den første fejlbehæftede række: «Måned er ikke angivet»
// – også om en måned, der STOD på skærmen, men var rød (readeren læser en rød celle som tom, M-19), uden at
// sige hvilken af tolv rækker, kun én fejl ad gangen, og linket blinkede hele kortet.

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

export type LoenindkomstTableLine = Readonly<{
  /** Stabil nøgle inden for ansættelsesforholdet: rækkens id og linjens art. */
  key: string;
  status: Exclude<EoRowStatus, 'ok'>;
  message: string;
  focusAddress: FieldAddress;
}>;

const cellAddress = (
  fieldSet: StandardLoenTableFieldSet,
  rowId: string,
  colKey: StandardLoenTableColumnKey
): FieldAddress => {
  // Én gren pr. kolonne, så hver celle bindes med sin egen værditype uden et cast over de heterogene descriptorer.
  switch (colKey) {
    case 'col0_maaned': return bindCollectionCell(fieldSet.collection, fieldSet.col0_maaned, rowId).address;
    case 'col1_maaned': return bindCollectionCell(fieldSet.collection, fieldSet.col1_maaned, rowId).address;
    case 'col0_uge': return bindCollectionCell(fieldSet.collection, fieldSet.col0_uge, rowId).address;
    case 'col1_uge': return bindCollectionCell(fieldSet.collection, fieldSet.col1_uge, rowId).address;
    case 'col0_dag': return bindCollectionCell(fieldSet.collection, fieldSet.col0_dag, rowId).address;
    case 'col1_dag': return bindCollectionCell(fieldSet.collection, fieldSet.col1_dag, rowId).address;
    case 'col2': return bindCollectionCell(fieldSet.collection, fieldSet.col2, rowId).address;
    case 'col3': return bindCollectionCell(fieldSet.collection, fieldSet.col3, rowId).address;
    case 'col4': return bindCollectionCell(fieldSet.collection, fieldSet.col4, rowId).address;
    case 'col5': return bindCollectionCell(fieldSet.collection, fieldSet.col5, rowId).address;
    case 'fpFvShSoBeloeb': return bindCollectionCell(fieldSet.collection, fieldSet.fpFvShSoBeloeb, rowId).address;
    case 'pensionBeloeb': return bindCollectionCell(fieldSet.collection, fieldSet.pensionBeloeb, rowId).address;
  }
};

const COLUMN_KEYS: ReadonlySet<string> = new Set<StandardLoenTableColumnKey>([
  'col0_maaned', 'col1_maaned', 'col0_uge', 'col1_uge', 'col0_dag', 'col1_dag',
  'col2', 'col3', 'col4', 'col5', 'fpFvShSoBeloeb', 'pensionBeloeb',
]);

/** Cellens egen tekst – tooltippens, eller «ugyldig værdi», når tooltippen kun ville sige «Fejl i indtastning». */
const cellIssueText = (issue: FieldIssue): string => {
  const tooltip = resolveFieldIssueTooltip(issue);
  return tooltip === FIELD_ISSUE_GENERIC_TOOLTIP ? 'ugyldig værdi' : tooltip;
};

const rowIdOfIssue = (issue: FieldIssue): string | undefined => {
  const segment = issue.field.address.path[1];
  return segment?.kind === 'entity' ? segment.entityId : undefined;
};

const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string): ReadonlyMap<string, readonly T[]> => {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
};

/**
 * Linjerne for ét ansættelsesforholds indtægtstabel, i tabellens rækkefølge.
 *
 * `cellIssues` er readerens røde celler i netop denne tabel. Rækkerne i `values` er readerens værdier, hvor en
 * rød celle er tom; derfor er en celle med sit eget issue aldrig også «ikke angivet».
 */
export const buildLoenindkomstTableLines = (
  values: ErstatningsopgoerelseValues,
  ansaettelsesforhold: Ansaettelsesforhold,
  cellIssues: readonly FieldIssue[],
  skadedato: ISODateString | undefined,
  today: ISODateString
): readonly LoenindkomstTableLine[] => {
  const rows: readonly StandardLoenTableRow[] = ansaettelsesforhold.indtaegtsoplysningerTableData ?? [];
  const { loenperiode, tillaegAngivesSom } = ansaettelsesforhold;
  const fieldSet = createEoStandardLoenFieldSet(ansaettelsesforhold.id);

  const issuesByCellKey = new Map<string, FieldIssue>();
  for (const issue of cellIssues) {
    const rowId = rowIdOfIssue(issue);
    const field = issue.field.address.field;
    if (rowId === undefined || !COLUMN_KEYS.has(field)) continue;
    const key = `${rowId}:${field}`;
    if (!issuesByCellKey.has(key)) issuesByCellKey.set(key, issue);
  }
  // Readerens røde celler og – som værn, hvis en ugyldig råværdi alligevel når hertil – den værdibaserede
  // vurdering, som beregningen bruger til at udelade rækken (`getStandardLoenErrorRowIdSet`). En række, beregningen
  // udelader, må aldrig mangle sin linje.
  const cellErrorsByCellKey: Record<string, true> = { ...buildStandardLoenCellErrors(rows, loenperiode) };
  for (const key of issuesByCellKey.keys()) cellErrorsByCellKey[key] = true;

  const validation = getStandardLoenTableValidation({ rows, loenperiode, cellErrorsByCellKey, tillaegAngivesSom });
  const cellErrors = validation.errors.filter((error): error is Extract<TableError, { kind: 'cell' }> => error.kind === 'cell');
  const errorsByRowId = groupBy(cellErrors, (error) => error.rowId);
  const warningRowIds = new Set(validation.summary.rowIssues
    .filter((issue) => issue.level === 'warning')
    .map((issue) => issue.rowId));
  const rowWarningsByRowId: ReadonlyMap<string, readonly StandardLoenRowWarning[]> = groupBy(
    resolveLoenindkomstRowWarnings(values, ansaettelsesforhold, skadedato, today),
    (warning) => warning.rowId
  );

  const lines: LoenindkomstTableLine[] = [];
  rows.forEach((row, index) => {
    const rowName = formatStandardLoenRowName(row, loenperiode, index);
    const rowErrors = errorsByRowId.get(row.id) ?? [];
    if (rowErrors.length > 0) {
      const parts: string[] = [];
      let focusAddress: FieldAddress | undefined;
      const seen = new Set<StandardLoenTableColumnKey>();
      for (const error of rowErrors) {
        if (seen.has(error.colKey)) continue;
        seen.add(error.colKey);
        const label = resolveStandardLoenColumnLabel(error.colKey);
        const issue = issuesByCellKey.get(`${row.id}:${error.colKey}`);
        if (issue !== undefined) {
          parts.push(`${label} – ${cellIssueText(issue)}`);
          focusAddress ??= issue.field.address;
        } else if (error.issue === 'partial_period') {
          parts.push(`${label} er ikke angivet`);
          focusAddress ??= cellAddress(fieldSet, row.id, error.colKey);
        } else {
          parts.push(`${label} – ugyldig værdi`);
          focusAddress ??= cellAddress(fieldSet, row.id, error.colKey);
        }
      }
      if (focusAddress !== undefined) {
        lines.push({ key: `${row.id}.fejl`, status: 'error', message: `${rowName}: ${parts.join('; ')}`, focusAddress });
      }
      return;
    }

    if (warningRowIds.has(row.id)) {
      lines.push({
        key: `${row.id}.udenBeloeb`,
        status: 'warning',
        message: `${rowName} er udfyldt uden beløb`,
        focusAddress: cellAddress(fieldSet, row.id, 'col2'),
      });
    }
    // «Ingen arbejdsdage» kommer nu med rækkeadvarslerne nedenfor (ring på periodecellerne + linjen, BB-365).
    for (const warning of rowWarningsByRowId.get(row.id) ?? []) {
      const focus = warning.cells[0];
      if (focus === undefined) continue;
      lines.push({
        key: `${row.id}.${warning.kind}`,
        status: 'warning',
        message: warning.summaryMessage,
        focusAddress: focus.address,
      });
    }
  });
  return lines;
};
