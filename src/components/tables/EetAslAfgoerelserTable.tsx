import * as React from 'react';
import { MenuItem, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton } from './RowDeleteButton';
import type { AslAfgoerelseRow, AfgoerelseType, JaNej } from '../../schemas/formSchemas';
import {
  EET_ASL_MIN_VISIBLE_ROWS,
  createAslAfgoerelseRowId,
  emptyAslAfgoerelseRowFields,
  isAslAfgoerelseRowPersistenceEmpty,
} from '../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { useTableSort } from './useTableSort';
import { APP_ROUTES, PAGE_DEFAULT_TAB } from '../../config/pageNavigation';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { useCollectionRows } from '../../inputCore/react';
import type { CellSpec } from '../../inputCore/react/useCellEditor';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import { activeFieldIssue, type FieldIssueSet } from '../../inputCore/inputIssue';
import {
  collectionLocationPrefix,
  useCollectionCellSpecBuilder,
  type CollectionRenderRow as RenderRow,
} from '../../inputCore/react/cellSpecBuilder';
import { usePlaceholderSlotIds } from '../../inputCore/react/placeholderSlots';
import {
  GridDateCell,
  GridPercentCell,
} from '../../inputCore/react/fields/gridCells';
import GridChoiceCell from '../../inputCore/react/fields/GridChoiceCell';
import {
  aslAfgoerelseAfgoerelseTypeField,
  aslAfgoerelseAfgoerelsesDatoField,
  aslAfgoerelseEetPctField,
  aslAfgoerelseFsTilbageholdtEetField,
  aslAfgoerelseKapDatoField,
  aslAfgoerelseKapPctField,
  aslAfgoerelseTidlKapDatoField,
  aslAfgoerelseVirkningsDatoField,
  erhvervsevnetabAslAfgoerelserCollectionRef,
} from '../../inputCore/catalog/erhvervsevnetabDescriptors';
import type { ISODateString } from '../../types/branded';

// EetAslAfgoerelserTable: Rækkeinfrastruktur, celleværdier
// og celleredigering går nu udelukkende gennem inputCore — som StandardLoenTable/BeregnetRenteTable:
//  - `useCollectionRows(aslAfgoerelser)` ejer rækkernes id'er + insert/delete/reorder (§3.8) — ingen
//    `useGridRowPersistenceCore`, `internalTableData`, `invalidDrafts`, fingerprint eller persistence-effect.
//  - hver redigerbar celle er en `Grid*Cell` over `useCellEditor`, bro-forbundet til grid-core-
//    navigationen. Descriptorernes codecs + bounds-validatorer ejer parse/format/paste + celle-bounds (§1.6);
//    kryds-række-domænereglerne (dublet-datoer, identiske afgørelser, virkningsdato efter tidl.kap.) kommer fra
//    forælderens reader-afledte `ruleIssues` som STRUKTURELLE feltissues og slås op på cellens egen feltadresse.
//  - de committede rækker (til sort + kryds-validering) er reader-afledte af forælderen, så tabellen og
//    projektionen deler præcis samme sandhed. Der er ingen konkurrerende celle-værdikopi (§3.8).
//  - trailing PLACEHOLDER-rækker (§1.11): tomme rækker persisteres ikke, så den viste tabel = de
//    committede rækker + `max(1, EET_ASL_MIN_VISIBLE_ROWS − antal committede)` tomme indtastnings-rækker (bevarer
//    legacy-looket med 2 synlige tomme rækker på en tom sag).

const AFGOERELSES_TYPE_OPTIONS: readonly { value: AfgoerelseType; label: string }[] = [
  { value: 'Midlertidig', label: 'Midlertidig' },
  { value: 'Delvist endelig', label: 'Delvist endelig' },
  { value: 'Endelig', label: 'Endelig' },
];

const JA_NEJ_OPTIONS: readonly { value: JaNej; label: string }[] = [
  { value: 'Ja', label: 'Ja' },
  { value: 'Nej', label: 'Nej' },
];

// Kolonneindeks (matcher grid-core-koordinaten `{ rowId, colIndex }`).
const COL = {
  afgoerelsesDato: 0,
  virkningsDato: 1,
  eetPct: 2,
  afgoerelseType: 3,
  kapDato: 4,
  kapPct: 5,
  tidlKapDato: 6,
  fsTilbageholdtEet: 7,
} as const;

export type EetAslAfgoerelserTableProps = Readonly<{
  /** De committede rækker (reader-afledt af forælderen), i afsluttet rækkefølge — til sort + kryds-validering. */
  committedRows: readonly AslAfgoerelseRow[];
  /**
   * Kryds-række-domænereglerne som STRUKTURELLE feltissues (GM-F06), reader-afledt af forælderen. Cellen slår
   * sit eget issue op på sin FELTADRESSE — ikke på en parallel `${rowId}|${field}`-strengnøgle — så rød
   * markering, tooltip og fokusnavigation deler repræsentation med alle andre røde felter.
   */
  ruleIssues: FieldIssueSet;
  saveOrderPath?: TableSaveOrderPath;
}>;


/** En tom ASL-række-entity til placeholder-promotion (row-factory; id er placeholderens stabile slot-id). */
const createEmptyAslRow = (rowId: string): AslAfgoerelseRow => ({ ...emptyAslAfgoerelseRowFields, id: rowId });

type EetAslAfgoerelserRowProps = Readonly<{
  renderRow: RenderRow;
  onDeleteRow: (rowId: string) => void;
  ruleIssues: FieldIssueSet;
  buildCellSpec: <T>(renderRow: RenderRow, descriptor: FieldDescriptor<T>, colIdx: number) => CellSpec<T, AslAfgoerelseRow>;
}>;

const EetAslAfgoerelserRow = React.memo(
  ({ renderRow, onDeleteRow, ruleIssues, buildCellSpec }: EetAslAfgoerelserRowProps) => {
    const rowId = renderRow.rowId;
    const gc = (colIndex: number) => ({ rowId, colIndex });

    // Opslaget sker på den FÆRDIGT BUNDNE cellereference, editoren selv driver (`CellSpec.field`) — ikke på en
    // ny lokal binding og ikke på en parallel `${rowId}|${field}`-strengnøgle (GM-F06). Dermed findes der kun
    // ÉN bindingsvej: kunne de to divergere, ville fejlen forsvinde lydløst fra cellen (jf. INC-F01, hvor
    // netop en lokal binding gav forkerte ejer-id'er i nestede collections).
    const ruleIssueFor = <T,>(cell: CellSpec<T, AslAfgoerelseRow>) => {
      const issue = activeFieldIssue(ruleIssues, serializeFieldAddress(cell.field.address));
      return issue === undefined ? {} : { collectionRuleIssue: issue };
    };

    // Hver cellespec bygges ÉN gang og bruges både af cellen og af issue-opslaget, så de ikke kan bindes
    // forskelligt.
    const afgoerelsesDatoCell = buildCellSpec<ISODateString | undefined>(renderRow, aslAfgoerelseAfgoerelsesDatoField, COL.afgoerelsesDato);
    const virkningsDatoCell = buildCellSpec<ISODateString | undefined>(renderRow, aslAfgoerelseVirkningsDatoField, COL.virkningsDato);
    const eetPctCell = buildCellSpec<number | undefined>(renderRow, aslAfgoerelseEetPctField, COL.eetPct);
    const afgoerelseTypeCell = buildCellSpec<AfgoerelseType | undefined>(renderRow, aslAfgoerelseAfgoerelseTypeField, COL.afgoerelseType);
    const kapDatoCell = buildCellSpec<ISODateString | undefined>(renderRow, aslAfgoerelseKapDatoField, COL.kapDato);
    const kapPctCell = buildCellSpec<number | undefined>(renderRow, aslAfgoerelseKapPctField, COL.kapPct);
    const tidlKapDatoCell = buildCellSpec<ISODateString | undefined>(renderRow, aslAfgoerelseTidlKapDatoField, COL.tidlKapDato);

    return (
      <TableRow data-mineo-row-id={rowId}>
        <TableCell>
          <GridDateCell
            gridCell={gc(COL.afgoerelsesDato)}
            cell={afgoerelsesDatoCell}
            {...ruleIssueFor(afgoerelsesDatoCell)}
          />
        </TableCell>
        <TableCell>
          <GridDateCell
            gridCell={gc(COL.virkningsDato)}
            cell={virkningsDatoCell}
            {...ruleIssueFor(virkningsDatoCell)}
          />
        </TableCell>
        <TableCell>
          <GridPercentCell
            gridCell={gc(COL.eetPct)}
            cell={eetPctCell}
            {...ruleIssueFor(eetPctCell)}
          />
        </TableCell>
        <TableCell>
          <GridChoiceCell<AfgoerelseType, AslAfgoerelseRow>
            gridCell={gc(COL.afgoerelseType)}
            cell={afgoerelseTypeCell}
            allowEmpty
            placeholder="Vælg..."
            ariaLabel="Afgørelsestype"
            {...ruleIssueFor(afgoerelseTypeCell)}
          >
            {AFGOERELSES_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </GridChoiceCell>
        </TableCell>
        <TableCell>
          <GridDateCell
            gridCell={gc(COL.kapDato)}
            cell={kapDatoCell}
            {...ruleIssueFor(kapDatoCell)}
          />
        </TableCell>
        <TableCell>
          <GridPercentCell
            gridCell={gc(COL.kapPct)}
            cell={kapPctCell}
            {...ruleIssueFor(kapPctCell)}
          />
        </TableCell>
        <TableCell>
          <GridDateCell
            gridCell={gc(COL.tidlKapDato)}
            cell={tidlKapDatoCell}
            {...ruleIssueFor(tidlKapDatoCell)}
          />
        </TableCell>
        <TableCell sx={{ position: 'relative', paddingRight: '28px' }}>
          <GridChoiceCell<JaNej, AslAfgoerelseRow, JaNej>
            gridCell={gc(COL.fsTilbageholdtEet)}
            cell={buildCellSpec<JaNej>(renderRow, aslAfgoerelseFsTilbageholdtEetField, COL.fsTilbageholdtEet)}
            allowEmpty={false}
            ariaLabel="FS tilbageholdt EET"
          >
            {JA_NEJ_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </GridChoiceCell>
          {renderRow.kind === 'existing' && (
            <RowDeleteButton onDelete={() => onDeleteRow(rowId)} />
          )}
        </TableCell>
      </TableRow>
    );
  }
);

EetAslAfgoerelserRow.displayName = 'EetAslAfgoerelserRow';

const EetAslAfgoerelserTable = React.memo(
  ({ committedRows, ruleIssues, saveOrderPath }: EetAslAfgoerelserTableProps) => {
    const rows = useCollectionRows<AslAfgoerelseRow>(erhvervsevnetabAslAfgoerelserCollectionRef, {
    locationId: 'erhvervsevnetab.aslAfgoerelser',
    route: APP_ROUTES.erhvervsevnetab,
    tabKey: PAGE_DEFAULT_TAB.erhvervsevnetab,
  });

    const sortColumns = React.useMemo(() => [
      { colId: 'afgoerelsesDato', getSortValue: (row: AslAfgoerelseRow) => row.afgoerelsesDato },
      { colId: 'virkningsDato', getSortValue: (row: AslAfgoerelseRow) => row.virkningsDato },
      { colId: 'eetPct', getSortValue: (row: AslAfgoerelseRow) => row.eetPct },
      { colId: 'afgoerelseType', getSortValue: (row: AslAfgoerelseRow) => row.afgoerelseType },
      { colId: 'kapDato', getSortValue: (row: AslAfgoerelseRow) => row.kapDato },
      { colId: 'kapPct', getSortValue: (row: AslAfgoerelseRow) => row.kapPct },
      { colId: 'tidlKapDato', getSortValue: (row: AslAfgoerelseRow) => row.tidlKapDato },
      { colId: 'fsTilbageholdtEet', getSortValue: (row: AslAfgoerelseRow) => row.fsTilbageholdtEet },
    ], []);

    const handleSortedRowsChange = React.useCallback((sortedRows: AslAfgoerelseRow[]) => {
      rows.reorder(sortedRows.map((row) => row.id));
    }, [rows]);

    const { sortedRows: sortedCommittedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows: committedRows,
      getRowId: (row) => row.id,
      isRowEmpty: isAslAfgoerelseRowPersistenceEmpty,
      columns: sortColumns,
      onSortedRowsChange: handleSortedRowsChange,
    });

    // ── Placeholder-rækker (§1.11) ──────────────────────────────────────────────
    // Tomme rækker persisteres ikke. Legacy viste altid mindst EET_ASL_MIN_VISIBLE_ROWS (=2) rækker;
    // det bevares som `max(1, 2 − antal committede)` placeholder-rækker (altid ≥1 trailing indtastnings-række).
    //
    // Identitets-livscyklussen er den DELTE `usePlaceholderSlotIds` (GM-F14) — tabellen havde tidligere sin egen
    // kopi. Ud over at fjerne duplikationen bevarer den delte pulje et promoveret id, så det kan genindtræde
    // efter et undo; ellers mister fokusrestoren sit mål (UT-F03).
    const committedIdSet = React.useMemo(
      () => new Set(sortedCommittedRows.map((row) => row.id)),
      [sortedCommittedRows]
    );
    const placeholderCount = Math.max(1, EET_ASL_MIN_VISIBLE_ROWS - sortedCommittedRows.length);
    const placeholderIds = usePlaceholderSlotIds(committedIdSet, placeholderCount, createAslAfgoerelseRowId);

    const renderRows: readonly RenderRow[] = React.useMemo(() => [
      ...sortedCommittedRows.map((row) => ({ rowId: row.id, kind: 'existing' as const })),
      ...placeholderIds.map((rowId) => ({ rowId, kind: 'placeholder' as const })),
    ], [sortedCommittedRows, placeholderIds]);

    const savedRowIds = React.useMemo(() => sortedCommittedRows.map((row) => row.id), [sortedCommittedRows]);
    useRegisterTableSaveOrder(saveOrderPath, savedRowIds);

    // Den fælles cellebinding (§3.2): begge cellearter får en fuldt bundet `FieldRef`, og ejer-id'erne udledes af
    // collectionens egen sti. route + tabKey er eksplicit navigation-metadata (§3.7).
    const buildCellSpec: <T>(
      renderRow: RenderRow,
      descriptor: FieldDescriptor<T>,
      colIdx: number
    ) => CellSpec<T, AslAfgoerelseRow> = useCollectionCellSpecBuilder<AslAfgoerelseRow>({
      collection: erhvervsevnetabAslAfgoerelserCollectionRef,
      createEmptyRow: createEmptyAslRow,
      locationPrefix: collectionLocationPrefix(erhvervsevnetabAslAfgoerelserCollectionRef),
      locationNav: { route: APP_ROUTES.erhvervsevnetab, tabKey: PAGE_DEFAULT_TAB.erhvervsevnetab },
    });

    return (
      <StandardLooseTable
        sx={{
          width: '1130px',
          tableLayout: 'fixed',
          '& .MuiTableCell-root': {
            textAlign: 'center',
            whiteSpace: 'nowrap',
          },
          '& thead th': {
            textAlign: 'center',
          },
        }}
      >
        <colgroup>
          <col style={{ width: '150px' }} />
          <col style={{ width: '150px' }} />
          <col style={{ width: '105px' }} />
          <col style={{ width: '180px' }} />
          <col style={{ width: '150px' }} />
          <col style={{ width: '105px' }} />
          <col style={{ width: '150px' }} />
          <col style={{ width: '140px' }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('afgoerelsesDato')} sortRole={getSortRole('afgoerelsesDato')} sortDirection={getSortDirection('afgoerelsesDato')}>Afgørelsesdato</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('virkningsDato')} sortRole={getSortRole('virkningsDato')} sortDirection={getSortDirection('virkningsDato')}>Virkningsdato</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('eetPct')} sortRole={getSortRole('eetPct')} sortDirection={getSortDirection('eetPct')}>EET %</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('afgoerelseType')} sortRole={getSortRole('afgoerelseType')} sortDirection={getSortDirection('afgoerelseType')}>Afgørelsestype</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('kapDato')} sortRole={getSortRole('kapDato')} sortDirection={getSortDirection('kapDato')}>Kap.dato</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('kapPct')} sortRole={getSortRole('kapPct')} sortDirection={getSortDirection('kapPct')}>Kap. %</StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('tidlKapDato')} sortRole={getSortRole('tidlKapDato')} sortDirection={getSortDirection('tidlKapDato')}>
              Hvis genopt. -
              <br />
              tidl. kap.dato
            </StandardLooseHeaderCell>
            <StandardLooseHeaderCell onClick={() => handleHeaderClick('fsTilbageholdtEet')} sortRole={getSortRole('fsTilbageholdtEet')} sortDirection={getSortDirection('fsTilbageholdtEet')}>
              FS tilbage-
              <br />
              holdt EET
            </StandardLooseHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {renderRows.map((renderRow) => (
            <EetAslAfgoerelserRow
              key={renderRow.rowId}
              renderRow={renderRow}
              onDeleteRow={rows.remove}
              ruleIssues={ruleIssues}
              buildCellSpec={buildCellSpec}
            />
          ))}
        </TableBody>
      </StandardLooseTable>
    );
  }
);

EetAslAfgoerelserTable.displayName = 'EetAslAfgoerelserTable';

export default EetAslAfgoerelserTable;
