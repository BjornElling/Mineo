import * as React from 'react';

import { CURRENT_YEAR } from '../../config/dateRanges';
import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import { formatKr } from '../../utils/formatUtils';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type {
  StandardLoenTableColumnKey,
  StandardLoenTableFirstErrorCell,
  StandardLoenTableSatser,
} from '../../types/table';
import type { StandardLoenTableHandle } from '../../types/handles';
import { createRowId } from '../../utils/rowId';
import { scrollTargetIntoView } from '../../utils/scrollTargetIntoView';
import {
  calculateStandardLoenRowDerived,
  isStandardLoenRowEffectivelyEmpty,
  roundStandardLoenAmountToTwoDecimals,
  type StandardLoenRowDerived,
} from '../../domain/aarsloen/standardLoenRowCalculations';
import {
  getStandardLoenPeriodKeys,
} from '../../domain/aarsloen/standardLoenTableValidation';
import { getStandardLoenTableHeaderNodes } from '../../domain/aarsloen/standardLoenTableColumns';
import type { StandardLoenTableFieldSet } from './standardLoenTableFieldSet';
import { readStandardLoenTableRows } from './standardLoenTableFieldSet';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import { useInputEvaluation, useCollectionRows } from '../../inputCore/react';
import type { CellSpec } from '../../inputCore/react/useCellEditor';
import type { FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';
import {
  GridAmountCell,
  GridDateCell,
  GridIntegerCell,
  GridWeekCell,
  GridYearCell,
} from '../../inputCore/react/fields/gridCells';
import type { ISODateString } from '../../types/branded';
import type { AmountValue } from '../../schemas/amountExpressionSchema';

import { StandardGridHeaderCell, StandardGridTable } from './StandardGridTable';
import { RowDeleteButton } from './RowDeleteButton';
import { getStandardGridBodyRowStyle, getStandardGridCellStyle } from './gridCore/standardGridStyles';
import { useTableSort } from './useTableSort';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';

// Greenfield-migreret StandardLoenTable (§2.4 trin 3 / §2.5, Pass 2). Rækkeinfrastruktur, celleværdier og
// celleredigering går nu udelukkende gennem greenfield-inputCore:
//  - `useCollectionRows(aarsloenTableDataCollectionRef)` ejer rækkernes id'er + insert/delete/reorder (§3.8) —
//    ingen `useGridRowPersistenceCore`, `internalTableData`, fingerprint eller persistence-effect.
//  - hver celle er en `Grid*Cell` over `useCellEditor` (draft/commit) bro-forbundet til grid-core-
//    navigationen (§2.5). En EKSISTERENDE-række-celle binder `descriptor.bind(rowId)`; en trailing PLACEHOLDER-
//    række promoverer atomisk ved første ikke-tomme settle (§1.11).
//  - de committede rækker læses read-only via `readAarsloenTableRows(reader)` — KUN til sortering, afledte
//    kolonner (col6/7/8) og tomheds-vurdering. Der findes ingen konkurrerende celle-værdikopi (§3.8).
//  - valideringssummaryen er REN og reader-afledt (`resolveStandardLoenTableValidation`) — ikke et imperativt
//    celle-fejl-handle. Det imperative handle beholder KUN visuel feedback (flash/scroll/missing-hint, §2.5).

export type StandardLoenTableProps = {
  /** Feltsættet, der binder tabellen til en konkret collection + celle-descriptors (§2.5-parametrisering). */
  fieldSet: StandardLoenTableFieldSet;
  loenperiode: Loenperiode;
  satser: StandardLoenTableSatser;
  // Beløb-tilstand: kolonnerne "FP/FV/SH/SO/St.B." og "Arb.g. Pension" bliver redigerbare beløbsfelter i stedet
  // for beregnede visningsfelter. Default 'procent' (nuværende adfærd).
  tillaegAngivesSom?: TillaegAngivesSom;
  useSmallFont?: boolean;
  saveOrderPath?: TableSaveOrderPath;
  calculateDerivedRow?: (row: StandardLoenTableRow) => StandardLoenRowDerived;
  /**
   * Eksplicit navigation-metadata for cellernes editorlokationer (§3.7): route + fane for den side/fane, tabellen
   * bor på. Tabellen renderes i flere kontekster (Årsløn vs. EO-lønindkomst), så route/fane kan ikke udledes af
   * `collection` — kalderen leverer den. Udeladt route = ikke-navigerbar lokation (restoren navigerer da ikke).
   */
  locationNav?: Readonly<{ route?: string; tabKey?: string | null }>;
};

const MIN_VISIBLE_ROWS = 2;

// Kolonneindeks (matcher legacy) — grid-core-koordinaten `{ rowId, colIndex }`.
const COL = {
  period0: 0,
  period1: 1,
  col2: 2,
  col3: 3,
  col4: 4,
  col5: 5,
  beloeb0: 6,
  beloeb1: 7,
} as const;

const StandardLoenTable = React.memo(React.forwardRef<StandardLoenTableHandle, StandardLoenTableProps>(
  ({ fieldSet, loenperiode, satser, tillaegAngivesSom = 'procent', useSmallFont = false, saveOrderPath, calculateDerivedRow, locationNav }, ref) => {
    const beloebMode = tillaegAngivesSom === 'beloeb';
    const evaluation = useInputEvaluation();
    const collection: CollectionRef = fieldSet.collection;
    const rows = useCollectionRows<StandardLoenTableRow>(collection);

    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const cellRefsByCellKeyRef = React.useRef<Record<string, HTMLInputElement | null>>({});
    const registerCellRef = React.useCallback(
      (rowId: string, colIdx: number) => (el: HTMLInputElement | null) => {
        cellRefsByCellKeyRef.current[`${rowId}:${colIdx}`] = el;
      },
      []
    );

    // Committede rækker læses read-only fra readeren — til sortering, afledte kolonner og tomheds-vurdering.
    // Celleværdien bor kun i inputaggregaten; dette er ingen konkurrerende værdikopi (§3.8).
    const committedRows = React.useMemo(
      () => readStandardLoenTableRows(fieldSet, evaluation.reader),
      [evaluation, fieldSet]
    );
    const committedById = React.useMemo(
      () => new Map(committedRows.map((row) => [row.id, row])),
      [committedRows]
    );

    const isRowEmpty = React.useCallback(
      (row: StandardLoenTableRow): boolean => isStandardLoenRowEffectivelyEmpty(row, loenperiode, tillaegAngivesSom),
      [loenperiode, tillaegAngivesSom]
    );

    const getSatserInput = React.useCallback(() => ({
      feriePct: satser?.ferie,
      fritvalgPct: satser?.fritvalg,
      shSoPct: satser?.shSo,
      storeBededagPct: satser?.bededag,
      pensionPct: satser?.pension,
    }), [satser?.bededag, satser?.ferie, satser?.fritvalg, satser?.pension, satser?.shSo]);

    const calculateRow = React.useCallback(
      (row: StandardLoenTableRow): { col6: number; col7: number; col8: number } => {
        const derived = calculateDerivedRow ? calculateDerivedRow(row) : calculateStandardLoenRowDerived(row, getSatserInput(), { mode: tillaegAngivesSom });
        return {
          col6: derived.fpFvShSo,
          col7: derived.pension,
          col8: roundStandardLoenAmountToTwoDecimals(derived.samlet),
        };
      },
      [calculateDerivedRow, getSatserInput, tillaegAngivesSom]
    );

    // ── Sortering ──────────────────────────────────────────────────────────────
    const resolveCommittedRow = React.useCallback(
      (row: StandardLoenTableRow) => committedById.get(row.id) ?? row,
      [committedById]
    );
    const parseSortableInteger = React.useCallback((value: string | undefined): number | undefined => {
      const trimmed = value?.trim() ?? '';
      if (trimmed === '') return undefined;
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }, []);
    const parseSortableWeekKey = React.useCallback((value: string | undefined): string | undefined => {
      const trimmed = value?.trim() ?? '';
      if (trimmed === '') return undefined;
      const parts = trimmed.split('/');
      if (parts.length !== 2) return undefined;
      const week = Number.parseInt(parts[0] ?? '', 10);
      const year = Number.parseInt(parts[1] ?? '', 10);
      if (!Number.isFinite(week) || !Number.isFinite(year)) return undefined;
      if (week < 1 || week > 53) return undefined;
      return `${year.toString().padStart(4, '0')}-${week.toString().padStart(2, '0')}`;
    }, []);
    const sortColumns = React.useMemo(() => [
      {
        colId: 'col-0',
        getSortValue: (row: StandardLoenTableRow) => {
          const committed = resolveCommittedRow(row);
          if (loenperiode === 'maaned') return parseSortableInteger(committed.col0_maaned);
          if (loenperiode === 'uge') return parseSortableWeekKey(committed.col0_uge);
          return committed.col0_dag ?? '';
        },
      },
      {
        colId: 'col-1',
        getSortValue: (row: StandardLoenTableRow) => {
          const committed = resolveCommittedRow(row);
          if (loenperiode === 'maaned') return parseSortableInteger(committed.col1_maaned);
          if (loenperiode === 'uge') return parseSortableWeekKey(committed.col1_uge);
          return committed.col1_dag ?? '';
        },
      },
      { colId: 'col-2', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col2) },
      { colId: 'col-3', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col3) },
      { colId: 'col-4', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col4) },
      { colId: 'col-5', getSortValue: (row: StandardLoenTableRow) => amountValueToNumber(resolveCommittedRow(row).col5) },
      {
        colId: 'col-6',
        getSortValue: (row: StandardLoenTableRow) => beloebMode
          ? amountValueToNumber(resolveCommittedRow(row).fpFvShSoBeloeb)
          : calculateRow(resolveCommittedRow(row)).col6,
      },
      {
        colId: 'col-7',
        getSortValue: (row: StandardLoenTableRow) => beloebMode
          ? amountValueToNumber(resolveCommittedRow(row).pensionBeloeb)
          : calculateRow(resolveCommittedRow(row)).col7,
      },
      { colId: 'col-8', getSortValue: (row: StandardLoenTableRow) => calculateRow(resolveCommittedRow(row)).col8 },
    ], [beloebMode, calculateRow, loenperiode, parseSortableInteger, parseSortableWeekKey, resolveCommittedRow]);

    const handleSortedRowsChange = React.useCallback((sortedRows: StandardLoenTableRow[]) => {
      rows.reorder(sortedRows.map((row) => row.id));
    }, [rows]);

    const { sortedRows: sortedCommittedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows: committedRows,
      getRowId: (row) => row.id,
      isRowEmpty,
      columns: sortColumns,
      onSortedRowsChange: handleSortedRowsChange,
    });

    // ── Placeholder-rækker (§1.11) ──────────────────────────────────────────────
    // Greenfield persisterer ikke tomme rækker. Den viste tabel = de committede rækker + en trailing placeholder-
    // række til næste indtastning + evt. flere placeholders op til MIN_VISIBLE_ROWS. Hver placeholder-rækkes
    // celler oprettes atomisk ved første ikke-tomme settle. Placeholder-id'erne er stabile pr. slot (useRef), så
    // en åben celleeditor ikke skifter identitet under redigering; efter en promotion (rækken dukker op i
    // committede rækker) nulstilles slottens id, så den næste tomme placeholder får et nyt stabilt id.
    const placeholderIdsRef = React.useRef<string[]>([]);
    const committedIdSet = React.useMemo(() => new Set(committedRows.map((row) => row.id)), [committedRows]);
    // Antal placeholder-slots: altid mindst én trailing tom, og nok til at nå MIN_VISIBLE_ROWS.
    const placeholderCount = Math.max(1, MIN_VISIBLE_ROWS - committedRows.length);
    // Genbrug stabile placeholder-id'er; ryd et id, hvis det er blevet promoveret (findes nu committed).
    const placeholderIds = React.useMemo(() => {
      const next: string[] = [];
      let cursor = 0;
      for (let i = 0; i < placeholderCount; i += 1) {
        // Find næste ubrugte (endnu ikke committede) placeholder-id, ellers generér et nyt.
        let id = placeholderIdsRef.current[cursor];
        while (id !== undefined && committedIdSet.has(id)) {
          cursor += 1;
          id = placeholderIdsRef.current[cursor];
        }
        if (id === undefined) {
          id = createRowId('row');
          placeholderIdsRef.current[cursor] = id;
        }
        next.push(id);
        cursor += 1;
      }
      // Trim overskydende gemte id'er (undgå ubegrænset vækst).
      placeholderIdsRef.current = placeholderIdsRef.current.slice(0, cursor);
      return next;
      // committedIdSet driver re-evalueringen (efter en promotion); placeholderCount er afledt af committedRows.
    }, [committedIdSet, placeholderCount]);

    type RenderRow = Readonly<{ rowId: string; kind: 'existing' | 'placeholder' }>;
    const renderRows: readonly RenderRow[] = React.useMemo(() => [
      ...sortedCommittedRows.map((row) => ({ rowId: row.id, kind: 'existing' as const })),
      ...placeholderIds.map((rowId) => ({ rowId, kind: 'placeholder' as const })),
    ], [sortedCommittedRows, placeholderIds]);

    // Save-order = de committede rækker i sorteret rækkefølge (placeholder-rækker persisteres ikke).
    const savedRowIds = React.useMemo(() => sortedCommittedRows.map((row) => row.id), [sortedCommittedRows]);
    useRegisterTableSaveOrder(saveOrderPath, savedRowIds);

    // ── Flash-fejl (visuel peg-mekanisme, surface-lokal) ────────────────────────
    const [flashCell, setFlashCell] = React.useState<{ rowId: string; colIdx: number } | null>(null);
    const [missingCell, setMissingCell] = React.useState<{ rowId: string; colKey: StandardLoenTableColumnKey } | null>(null);

    const isVisibleColKey = React.useCallback(
      (colKey: StandardLoenTableColumnKey): boolean => {
        if (colKey === 'col0_maaned' || colKey === 'col1_maaned') return loenperiode === 'maaned';
        if (colKey === 'col0_uge' || colKey === 'col1_uge') return loenperiode === 'uge';
        if (colKey === 'col0_dag' || colKey === 'col1_dag') return loenperiode === 'dag';
        return true;
      },
      [loenperiode]
    );

    const resolveColIdxFromKey = React.useCallback((colKey: StandardLoenTableColumnKey): number => {
      if (colKey === 'fpFvShSoBeloeb') return COL.beloeb0;
      if (colKey === 'pensionBeloeb') return COL.beloeb1;
      if (colKey === 'col0_maaned' || colKey === 'col0_uge' || colKey === 'col0_dag') return COL.period0;
      if (colKey === 'col1_maaned' || colKey === 'col1_uge' || colKey === 'col1_dag') return COL.period1;
      return Number.parseInt(colKey.slice(3), 10);
    }, []);

    const getCellStyle = React.useCallback((rowId: string, colIdx: number, baseStyle: React.CSSProperties = {}): React.CSSProperties => ({
      ...baseStyle,
      animation: flashCell?.rowId === rowId && flashCell?.colIdx === colIdx ? 'errorFlash 0.5s ease-in-out 3' : 'none',
    }), [flashCell]);

    // Missing-hint peger på en tom celle uden at gøre den rød (§1.7): en visuel "Indtastning mangler"-markør.
    const getMissingHint = React.useCallback((rowId: string, colKey: StandardLoenTableColumnKey): string | undefined => {
      if (!missingCell) return undefined;
      if (missingCell.rowId !== rowId || missingCell.colKey !== colKey) return undefined;
      if (!isVisibleColKey(colKey)) return undefined;
      return 'Indtastning mangler';
    }, [isVisibleColKey, missingCell]);

    // Ryd missing-hint, når den pegede celle ikke længere er tom eller ikke længere er synlig.
    React.useEffect(() => {
      if (!missingCell) return;
      if (!isVisibleColKey(missingCell.colKey)) { setMissingCell(null); return; }
      const row = committedById.get(missingCell.rowId);
      const value = row ? row[missingCell.colKey] : undefined;
      const isEmpty = value === undefined || (typeof value === 'string' && value.trim() === '');
      if (!isEmpty) setMissingCell(null);
    }, [committedById, isVisibleColKey, missingCell]);

    React.useImperativeHandle(
      ref,
      () => ({
        showMissingEntryError: (cell: StandardLoenTableFirstErrorCell) => {
          if (cell.reason !== 'missing') return;
          if (!isVisibleColKey(cell.colKey)) return;
          setMissingCell({ rowId: cell.rowId, colKey: cell.colKey });
          const el = cellRefsByCellKeyRef.current[`${cell.rowId}:${resolveColIdxFromKey(cell.colKey)}`];
          if (el) scrollTargetIntoView(el, { force: true });
        },
        flashError: (error) => {
          const colIdx = resolveColIdxFromKey(error.colKey);
          const el = cellRefsByCellKeyRef.current[`${error.rowId}:${colIdx}`];
          if (!el) return;
          setFlashCell({ rowId: error.rowId, colIdx });
          scrollTargetIntoView(el, { force: true });
          window.setTimeout(() => setFlashCell(null), 2000);
        },
        showNeedsPeriodHint: () => {
          const firstRow = sortedCommittedRows[0] ?? { id: placeholderIds[0] };
          if (!firstRow) return;
          const [periodStartKey] = getStandardLoenPeriodKeys(loenperiode);
          if (!isVisibleColKey(periodStartKey)) return;
          setMissingCell({ rowId: firstRow.id, colKey: periodStartKey });
          const el = cellRefsByCellKeyRef.current[`${firstRow.id}:${resolveColIdxFromKey(periodStartKey)}`];
          if (el) scrollTargetIntoView(el, { force: true });
        },
      }),
      [isVisibleColKey, loenperiode, placeholderIds, resolveColIdxFromKey, sortedCommittedRows]
    );

    const headers = React.useMemo(() => getStandardLoenTableHeaderNodes(loenperiode), [loenperiode]);

    // ── Celle-spec-byggere ─────────────────────────────────────────────────────
    // En eksisterende-række-celle binder cellens descriptor til rækkens id. En placeholder-celle bærer
    // descriptor + collection + tom-række-entity + stabilt id, så første ikke-tomme settle promoverer rækken.
    const buildCellSpec = React.useCallback(<T,>(
      renderRow: RenderRow,
      descriptor: FieldDescriptor<T>,
      colIdx: number
    ): CellSpec<T, StandardLoenTableRow> => {
      // route/tabKey er eksplicit navigation-metadata (§3.7) leveret af kalderen (Årsløn vs. EO-lønindkomst).
      const location = {
        locationId: `${collection.section}.${collection.collection}:${renderRow.rowId}:${colIdx}`,
        ...(locationNav?.route === undefined ? {} : { route: locationNav.route }),
        ...(locationNav?.tabKey === undefined ? {} : { tabKey: locationNav.tabKey }),
      };
      if (renderRow.kind === 'existing') {
        const field: FieldRef<T> = descriptor.bind(renderRow.rowId);
        return { kind: 'existing', field, location };
      }
      return {
        kind: 'placeholder',
        descriptor,
        collection,
        entity: fieldSet.createRow(renderRow.rowId),
        entityId: renderRow.rowId,
        location,
      };
    }, [collection, fieldSet, locationNav]);

    return (
      <StandardGridTable
        tableWidth="1130px"
        tableRef={tableRef}
        useSmallFont={useSmallFont}
        beforeTable={
          <style>
            {`
              @keyframes errorFlash {
                0%, 100% { background-color: transparent; }
                50% { background-color: color-mix(in srgb, var(--color-status-error) 20%, transparent); }
              }
            `}
          </style>
        }
      >
        <colgroup>
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '125px' }} />
          <col style={{ width: '130px' }} />
        </colgroup>

        <thead>
          <tr>
            {headers.map((header, idx) => {
              const colId = `col-${idx}`;
              return (
                <StandardGridHeaderCell
                  key={colId}
                  onClick={() => handleHeaderClick(colId)}
                  sortRole={getSortRole(colId)}
                  sortDirection={getSortDirection(colId)}
                >
                  <span style={{ whiteSpace: 'pre-line' }}>{header}</span>
                </StandardGridHeaderCell>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {renderRows.map((renderRow, rowIndex) => {
            const rowId = renderRow.rowId;
            const committedRow = committedById.get(rowId) ?? fieldSet.createRow(rowId);
            const calculated = calculateRow(committedRow);
            const gc = (colIndex: number) => ({ rowId, colIndex });

            return (
              <tr key={rowId} data-mineo-row-id={rowId} style={getStandardGridBodyRowStyle(rowIndex)}>
                {/* Periode fra */}
                <td style={getCellStyle(rowId, COL.period0, { ...getStandardGridCellStyle({ align: 'center' }) })}>
                  {loenperiode === 'maaned' ? (
                    <GridIntegerCell
                      gridCell={gc(COL.period0)}
                      cell={buildCellSpec<string | undefined>(renderRow, fieldSet.col0_maaned, COL.period0)}
                      placeholder={getMissingHint(rowId, 'col0_maaned') ?? 'mm'}
                      inputRef={registerCellRef(rowId, COL.period0)}
                    />
                  ) : loenperiode === 'uge' ? (
                    <GridWeekCell
                      gridCell={gc(COL.period0)}
                      cell={buildCellSpec<string | undefined>(renderRow, fieldSet.col0_uge, COL.period0)}
                      {...(getMissingHint(rowId, 'col0_uge') ? { placeholder: getMissingHint(rowId, 'col0_uge') } : {})}
                      inputRef={registerCellRef(rowId, COL.period0)}
                    />
                  ) : (
                    <GridDateCell
                      gridCell={gc(COL.period0)}
                      cell={buildCellSpec<ISODateString | undefined>(renderRow, fieldSet.col0_dag, COL.period0)}
                      {...(getMissingHint(rowId, 'col0_dag') ? { placeholder: getMissingHint(rowId, 'col0_dag') } : {})}
                      inputRef={registerCellRef(rowId, COL.period0)}
                    />
                  )}
                </td>

                {/* Periode til */}
                <td style={getCellStyle(rowId, COL.period1, { ...getStandardGridCellStyle({ align: 'center' }) })}>
                  {loenperiode === 'maaned' ? (
                    <GridYearCell
                      gridCell={gc(COL.period1)}
                      cell={buildCellSpec<string | undefined>(renderRow, fieldSet.col1_maaned, COL.period1)}
                      {...(getMissingHint(rowId, 'col1_maaned') ? { placeholder: getMissingHint(rowId, 'col1_maaned') } : { placeholder: `åååå (≤${CURRENT_YEAR})` })}
                      inputRef={registerCellRef(rowId, COL.period1)}
                    />
                  ) : loenperiode === 'uge' ? (
                    <GridWeekCell
                      gridCell={gc(COL.period1)}
                      cell={buildCellSpec<string | undefined>(renderRow, fieldSet.col1_uge, COL.period1)}
                      {...(getMissingHint(rowId, 'col1_uge') ? { placeholder: getMissingHint(rowId, 'col1_uge') } : {})}
                      inputRef={registerCellRef(rowId, COL.period1)}
                    />
                  ) : (
                    <GridDateCell
                      gridCell={gc(COL.period1)}
                      cell={buildCellSpec<ISODateString | undefined>(renderRow, fieldSet.col1_dag, COL.period1)}
                      {...(getMissingHint(rowId, 'col1_dag') ? { placeholder: getMissingHint(rowId, 'col1_dag') } : {})}
                      inputRef={registerCellRef(rowId, COL.period1)}
                    />
                  )}
                </td>

                {/* Beløbskolonner col2..col5 */}
                {([
                  [COL.col2, fieldSet.col2] as const,
                  [COL.col3, fieldSet.col3] as const,
                  [COL.col4, fieldSet.col4] as const,
                  [COL.col5, fieldSet.col5] as const,
                ]).map(([colIdx, descriptor]) => (
                  <td key={colIdx} style={getCellStyle(rowId, colIdx, { ...getStandardGridCellStyle({ align: 'right' }) })}>
                    <GridAmountCell
                      gridCell={gc(colIdx)}
                      cell={buildCellSpec<AmountValue | undefined>(renderRow, descriptor, colIdx)}
                      inputRef={registerCellRef(rowId, colIdx)}
                    />
                  </td>
                ))}

                {/* FP/FV/SH/SO/St.B. — redigerbar i Beløb, afledt i Procent */}
                {beloebMode ? (
                  <td style={getCellStyle(rowId, COL.beloeb0, { ...getStandardGridCellStyle({ align: 'right' }) })}>
                    <GridAmountCell
                      gridCell={gc(COL.beloeb0)}
                      cell={buildCellSpec<AmountValue | undefined>(renderRow, fieldSet.fpFvShSoBeloeb, COL.beloeb0)}
                      inputRef={registerCellRef(rowId, COL.beloeb0)}
                    />
                  </td>
                ) : (
                  <td style={{ ...getStandardGridCellStyle({ align: 'right' }), padding: '4px', color: calculated.col6 === 0 ? 'var(--mineo-color-grid-derived)' : 'inherit' }}>
                    {formatKr(calculated.col6, 2)}
                  </td>
                )}

                {/* Arb.g. Pension — redigerbar i Beløb, afledt i Procent */}
                {beloebMode ? (
                  <td style={getCellStyle(rowId, COL.beloeb1, { ...getStandardGridCellStyle({ align: 'right' }) })}>
                    <GridAmountCell
                      gridCell={gc(COL.beloeb1)}
                      cell={buildCellSpec<AmountValue | undefined>(renderRow, fieldSet.pensionBeloeb, COL.beloeb1)}
                      inputRef={registerCellRef(rowId, COL.beloeb1)}
                    />
                  </td>
                ) : (
                  <td style={{ ...getStandardGridCellStyle({ align: 'right' }), padding: '4px', color: calculated.col7 === 0 ? 'var(--mineo-color-grid-derived)' : 'inherit' }}>
                    {formatKr(calculated.col7, 2)}
                  </td>
                )}

                {/* Samlet løn (altid afledt) + slet-række-knap */}
                <td
                  style={{
                    ...getStandardGridCellStyle({ align: 'right' }),
                    padding: '4px',
                    paddingRight: '28px',
                    position: 'relative',
                    color: calculated.col8 === 0 ? 'var(--mineo-color-grid-derived)' : 'inherit',
                  }}
                >
                  {formatKr(calculated.col8, 2)}
                  {renderRow.kind === 'existing' && (
                    <RowDeleteButton onDelete={() => rows.remove(rowId)} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </StandardGridTable>
    );
  }
));

StandardLoenTable.displayName = 'StandardLoenTable';

export default StandardLoenTable;
