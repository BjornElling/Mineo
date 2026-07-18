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
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { useCollectionRows } from '../../inputCore/react';
import type { CellSpec } from '../../inputCore/react/useCellEditor';
import type { FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import {
  GreenfieldGridDateCell,
  GreenfieldGridPercentCell,
} from '../../inputCore/react/fields/greenfieldGridCells';
import GreenfieldGridChoiceCell from '../../inputCore/react/fields/GreenfieldGridChoiceCell';
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

// Greenfield-migreret EetAslAfgoerelserTable (§2.5 trin 4, Erhvervsevnetab-slice). Rækkeinfrastruktur, celleværdier
// og celleredigering går nu udelukkende gennem greenfield-inputCore — som StandardLoenTable/BeregnetRenteTable:
//  - `useCollectionRows(aslAfgoerelser)` ejer rækkernes id'er + insert/delete/reorder (§3.8) — ingen
//    `useGridRowPersistenceCore`, `internalTableData`, `invalidDrafts`, fingerprint eller persistence-effect.
//  - hver redigerbar celle er en `GreenfieldGrid*Cell` over `useCellEditor`, bro-forbundet til grid-core-
//    navigationen. Descriptorernes codecs + bounds-validatorer ejer parse/format/paste + celle-bounds (§1.6);
//    kryds-række-domænefejlene (dublet-datoer, identiske afgørelser, virkningsdato efter tidl.kap.) kommer fra
//    forælderens reader-afledte `validationMessageByCell` og vises inline via cellens `externalErrorMessage`.
//  - de committede rækker (til sort + kryds-validering) er reader-afledte af forælderen, så tabellen og
//    projektionen deler præcis samme sandhed. Der er ingen konkurrerende celle-værdikopi (§3.8).
//  - trailing PLACEHOLDER-rækker (§1.11): greenfield persisterer ikke tomme rækker, så den viste tabel = de
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

/** Per-celle kryds-række-domænefejl, nøglet `${rowId}|${field}` (afledt af forælderens reader-projektion). */
export type EetAslValidationMessageByCell = ReadonlyMap<string, string>;

export type EetAslAfgoerelserTableProps = Readonly<{
  /** De committede rækker (reader-afledt af forælderen), i afsluttet rækkefølge — til sort + kryds-validering. */
  committedRows: readonly AslAfgoerelseRow[];
  /** Kryds-række-domænefejl pr. celle (`${rowId}|${field}` → besked), reader-afledt af forælderen. */
  validationMessageByCell: EetAslValidationMessageByCell;
  saveOrderPath?: TableSaveOrderPath;
}>;

type RenderRow = Readonly<{ rowId: string; kind: 'existing' | 'placeholder' }>;

/** En tom ASL-række-entity til placeholder-promotion (row-factory; id er placeholderens stabile slot-id). */
const createEmptyAslRow = (rowId: string): AslAfgoerelseRow => ({ ...emptyAslAfgoerelseRowFields, id: rowId });

type EetAslAfgoerelserRowProps = Readonly<{
  renderRow: RenderRow;
  onDeleteRow: (rowId: string) => void;
  validationMessageByCell: EetAslValidationMessageByCell;
  buildCellSpec: <T>(renderRow: RenderRow, descriptor: FieldDescriptor<T>, colIdx: number) => CellSpec<T, AslAfgoerelseRow>;
}>;

const EetAslAfgoerelserRow = React.memo(
  ({ renderRow, onDeleteRow, validationMessageByCell, buildCellSpec }: EetAslAfgoerelserRowProps) => {
    const rowId = renderRow.rowId;
    const gc = (colIndex: number) => ({ rowId, colIndex });
    const cellError = (field: keyof AslAfgoerelseRow): string | undefined =>
      validationMessageByCell.get(`${rowId}|${field}`);

    const externalProp = (field: keyof AslAfgoerelseRow) => {
      const message = cellError(field);
      return message === undefined ? {} : { externalErrorMessage: message };
    };

    return (
      <TableRow data-mineo-row-id={rowId}>
        <TableCell>
          <GreenfieldGridDateCell
            gridCell={gc(COL.afgoerelsesDato)}
            cell={buildCellSpec<ISODateString | undefined>(renderRow, aslAfgoerelseAfgoerelsesDatoField, COL.afgoerelsesDato)}
            {...externalProp('afgoerelsesDato')}
          />
        </TableCell>
        <TableCell>
          <GreenfieldGridDateCell
            gridCell={gc(COL.virkningsDato)}
            cell={buildCellSpec<ISODateString | undefined>(renderRow, aslAfgoerelseVirkningsDatoField, COL.virkningsDato)}
            {...externalProp('virkningsDato')}
          />
        </TableCell>
        <TableCell>
          <GreenfieldGridPercentCell
            gridCell={gc(COL.eetPct)}
            cell={buildCellSpec<number | undefined>(renderRow, aslAfgoerelseEetPctField, COL.eetPct)}
            {...externalProp('eetPct')}
          />
        </TableCell>
        <TableCell>
          <GreenfieldGridChoiceCell<AfgoerelseType, AslAfgoerelseRow>
            gridCell={gc(COL.afgoerelseType)}
            cell={buildCellSpec<AfgoerelseType | undefined>(renderRow, aslAfgoerelseAfgoerelseTypeField, COL.afgoerelseType)}
            allowEmpty
            placeholder="Vælg..."
            ariaLabel="Afgørelsestype"
            {...externalProp('afgoerelseType')}
          >
            {AFGOERELSES_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </GreenfieldGridChoiceCell>
        </TableCell>
        <TableCell>
          <GreenfieldGridDateCell
            gridCell={gc(COL.kapDato)}
            cell={buildCellSpec<ISODateString | undefined>(renderRow, aslAfgoerelseKapDatoField, COL.kapDato)}
            {...externalProp('kapDato')}
          />
        </TableCell>
        <TableCell>
          <GreenfieldGridPercentCell
            gridCell={gc(COL.kapPct)}
            cell={buildCellSpec<number | undefined>(renderRow, aslAfgoerelseKapPctField, COL.kapPct)}
            {...externalProp('kapPct')}
          />
        </TableCell>
        <TableCell>
          <GreenfieldGridDateCell
            gridCell={gc(COL.tidlKapDato)}
            cell={buildCellSpec<ISODateString | undefined>(renderRow, aslAfgoerelseTidlKapDatoField, COL.tidlKapDato)}
            {...externalProp('tidlKapDato')}
          />
        </TableCell>
        <TableCell sx={{ position: 'relative', paddingRight: '28px' }}>
          <GreenfieldGridChoiceCell<JaNej, AslAfgoerelseRow, JaNej>
            gridCell={gc(COL.fsTilbageholdtEet)}
            cell={buildCellSpec<JaNej>(renderRow, aslAfgoerelseFsTilbageholdtEetField, COL.fsTilbageholdtEet)}
            allowEmpty={false}
            ariaLabel="FS tilbageholdt EET"
          >
            {JA_NEJ_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </GreenfieldGridChoiceCell>
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
  ({ committedRows, validationMessageByCell, saveOrderPath }: EetAslAfgoerelserTableProps) => {
    const rows = useCollectionRows<AslAfgoerelseRow>(erhvervsevnetabAslAfgoerelserCollectionRef);

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
    // Greenfield persisterer ikke tomme rækker. Legacy viste altid mindst EET_ASL_MIN_VISIBLE_ROWS (=2) rækker;
    // det bevares som `max(1, 2 − antal committede)` placeholder-rækker (altid ≥1 trailing indtastnings-række).
    // Placeholder-id'erne er stabile pr. slot (useRef), så en åben celleeditor ikke skifter identitet.
    const placeholderIdsRef = React.useRef<string[]>([]);
    const committedIdSet = React.useMemo(
      () => new Set(sortedCommittedRows.map((row) => row.id)),
      [sortedCommittedRows]
    );
    const placeholderCount = Math.max(1, EET_ASL_MIN_VISIBLE_ROWS - sortedCommittedRows.length);
    const placeholderIds = React.useMemo(() => {
      const next: string[] = [];
      let cursor = 0;
      for (let i = 0; i < placeholderCount; i += 1) {
        let id = placeholderIdsRef.current[cursor];
        while (id !== undefined && committedIdSet.has(id)) {
          cursor += 1;
          id = placeholderIdsRef.current[cursor];
        }
        if (id === undefined) {
          id = createAslAfgoerelseRowId();
          placeholderIdsRef.current[cursor] = id;
        }
        next.push(id);
        cursor += 1;
      }
      placeholderIdsRef.current = placeholderIdsRef.current.slice(0, cursor);
      return next;
    }, [committedIdSet, placeholderCount]);

    const renderRows: readonly RenderRow[] = React.useMemo(() => [
      ...sortedCommittedRows.map((row) => ({ rowId: row.id, kind: 'existing' as const })),
      ...placeholderIds.map((rowId) => ({ rowId, kind: 'placeholder' as const })),
    ], [sortedCommittedRows, placeholderIds]);

    const savedRowIds = React.useMemo(() => sortedCommittedRows.map((row) => row.id), [sortedCommittedRows]);
    useRegisterTableSaveOrder(saveOrderPath, savedRowIds);

    // Celle-spec-bygger: eksisterende-række-celle binder descriptor.bind(rowId); placeholder bærer descriptor +
    // collection + tom-række-entity + stabilt id, så første ikke-tomme settle promoverer rækken (§1.11).
    const buildCellSpec = React.useCallback(<T,>(
      renderRow: RenderRow,
      descriptor: FieldDescriptor<T>,
      colIdx: number
    ): CellSpec<T, AslAfgoerelseRow> => {
      const location = { locationId: `erhvervsevnetab.aslAfgoerelser:${renderRow.rowId}:${colIdx}` };
      if (renderRow.kind === 'existing') {
        const field: FieldRef<T> = descriptor.bind(renderRow.rowId);
        return { kind: 'existing', field, location };
      }
      return {
        kind: 'placeholder',
        descriptor,
        collection: erhvervsevnetabAslAfgoerelserCollectionRef,
        entity: createEmptyAslRow(renderRow.rowId),
        entityId: renderRow.rowId,
        location,
      };
    }, []);

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
              validationMessageByCell={validationMessageByCell}
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
