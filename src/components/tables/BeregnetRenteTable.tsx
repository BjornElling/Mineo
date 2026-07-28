import * as React from 'react';
import { Box, MenuItem, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import DownloadIconButton from '../inputs/DownloadIconButton';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton } from './RowDeleteButton';
import { useTableSort } from './useTableSort';
import { formatKr } from '../../utils/formatUtils';
import { APP_ROUTES, PAGE_DEFAULT_TAB } from '../../config/pageNavigation';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import type { RentekravRow } from '../../schemas/formSchemas';
import type { RentekravRowResult } from '../../domain/renteberegning/renteberegningEngine';
import {
  createEmptyRentekravCommittedRow,
  createRentekravRowId,
} from '../../domain/renteberegning/rentekravTableModel';
import { isRentekravRowEmpty } from '../../domain/renteberegning/rowEmpty';
import type { ProjectionResult } from '../../inputCore/projection';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import {
  DOWNLOAD_DISABLED_TOOLTIP,
  getDocumentFormatLabel,
  type DocumentDownloadFormat,
} from '../../document/documentFormat';
import { useCollectionRows } from '../../inputCore/react';
import type { CellSpec } from '../../inputCore/react/useCellEditor';
import {
  collectionLocationPrefix,
  useCollectionCellSpecBuilder,
  type CollectionRenderRow as RenderRow,
} from '../../inputCore/react/cellSpecBuilder';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import {
  GridAmountCell,
  GridDateCell,
} from '../../inputCore/react/fields/gridCells';
import GridTextCell from '../../inputCore/react/fields/GridTextCell';
import GridChoiceCell from '../../inputCore/react/fields/GridChoiceCell';
import { filterIntegerKeyDown } from '../inputs/inputKeyFilters';
import {
  rentekravRowsCollectionRef,
  rentekravBelobField,
  rentekravRenterFraField,
  rentekravTillaegstidField,
  rentekravEnhedField,
} from '../../inputCore/catalog/renteberegningDescriptors';
import type { TillaegstidEnhed } from '../../schemas/formSchemas/enumSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';

// Greenfield-migreret BeregnetRenteTable (§2.5 trin 2, Renteberegning-slice). Rækkeinfrastruktur, celleværdier og
// celleredigering går nu udelukkende gennem greenfield-inputCore, som StandardLoenTable:
//  - `useCollectionRows(rentekravRowsCollection)` ejer rækkernes id'er + insert/delete/reorder (§3.8) — ingen
//    `useSliceRowDrafts`, draftkopi, fingerprint eller persistence-effect.
//  - hver redigerbar celle er en `Grid*Cell`/`GridChoiceCell` over `useCellEditor`, bro-
//    forbundet til grid-core-navigationen. En trailing PLACEHOLDER-række promoverer atomisk ved første ikke-tomme
//    settle (§1.11).
//  - de committede rækker + rente-resultater kommer fra den reader-afledte projektion (forælderen ejer den, så
//    både tabellen og download-gaten deler præcis samme sandhed). Der er ingen konkurrerende celle-værdikopi (§3.8).

export type RentePdfContext = NonNullable<RentekravRowResult['pdfContext']>;
export type RentekravPdfContextMap = ReadonlyMap<string, RentePdfContext>;

const ENHED_OPTIONS: readonly { value: TillaegstidEnhed; label: string }[] = [
  { value: 'dage', label: 'Dage' },
  { value: 'uger', label: 'Uger' },
  { value: 'maaneder', label: 'Måneder' },
];

// Kolonneindeks (matcher grid-core-koordinaten `{ rowId, colIndex }`): belob=0, renterFra=1, tillaegstid=2, enhed=3.
const COL = { belob: 0, renterFra: 1, tillaegstid: 2, enhed: 3 } as const;

export type BeregnetRenteTableProps = Readonly<{
  /** De committede rækker (læst reader-afledt af forælderen), i den afsluttede rækkefølge. */
  committedRows: readonly RentekravRow[];
  /** Per-række rente-projektion (reader-afledt af forælderen). */
  rowProjections: ReadonlyMap<string, ProjectionResult<RentekravRowResult>>;
  onDownloadSpecifikation: (rowId: string) => Promise<void>;
  saveOrderPath?: TableSaveOrderPath;
  isMobile?: boolean;
  documentDownloadFormat: DocumentDownloadFormat;
  /**
   * Rækkens download-gate, spurgt hos SAMME definition som klikket aktiverer (§A2: samme definition
   * OG samme request). Tabellen udleder ikke selv knaptilstanden — gjorde den det, ville den reaktive
   * gate og click-preflighten være to udtryk for samme regel og kunne drifte.
   */
  resolveDownloadGate: (rowId: string) => Readonly<{ canDownload: boolean; disabledReason?: string }>;
}>;


type BeregnetRenteRowProps = Readonly<{
  renderRow: RenderRow;
  rowIndex: number;
  onDownloadSpecifikation: (rowId: string) => Promise<void>;
  onDeleteRow: (rowId: string) => void;
  projection: ProjectionResult<RentekravRowResult> | undefined;
  isMobile: boolean;
  documentDownloadFormat: DocumentDownloadFormat;
  resolveDownloadGate: (rowId: string) => Readonly<{ canDownload: boolean; disabledReason?: string }>;
  buildCellSpec: <T>(renderRow: RenderRow, descriptor: FieldDescriptor<T>, colIdx: number) => CellSpec<T, RentekravRow>;
}>;

const BeregnetRenteRow = React.memo(
  ({
    renderRow,
    rowIndex,
    onDownloadSpecifikation,
    onDeleteRow,
    projection,
    isMobile,
    documentDownloadFormat,
    resolveDownloadGate,
    buildCellSpec,
  }: BeregnetRenteRowProps) => {
    const rowId = renderRow.rowId;
    const formatLabel = getDocumentFormatLabel(documentDownloadFormat);

    const { actualInterestDate, calculatedInterest, pdfContext } = projection?.status === 'ready'
      ? projection.value
      : { actualInterestDate: null, calculatedInterest: null, pdfContext: null };

    const actualInterestDateDanish = isoToDanish(actualInterestDate ?? undefined) ?? null;
    // Ikonet vises kun for en række, der HAR et resultat (som før); om det er aktivt, afgør
    // definitionens gate for netop denne række.
    const showDownloadButton = pdfContext !== null;
    const rowGate = resolveDownloadGate(rowId);

    const gc = (colIndex: number) => ({ rowId, colIndex });

    return (
      <TableRow data-mineo-row-id={rowId}>
        <TableCell sx={isMobile ? undefined : { textAlign: 'center' }}>
          <GridAmountCell
            gridCell={gc(COL.belob)}
            cell={buildCellSpec<AmountValue | undefined>(renderRow, rentekravBelobField, COL.belob)}
            placeholder="0,00"
          />
        </TableCell>

        <TableCell>
          <GridDateCell
            gridCell={gc(COL.renterFra)}
            cell={buildCellSpec<ISODateString | undefined>(renderRow, rentekravRenterFraField, COL.renterFra)}
          />
        </TableCell>

        {!isMobile && (
          <TableCell>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5 }}>
              <Typography className="row--text">+</Typography>
              <Box sx={{ width: 50 }}>
                <GridTextCell<number | undefined>
                  gridCell={gc(COL.tillaegstid)}
                  cell={buildCellSpec<number | undefined>(renderRow, rentekravTillaegstidField, COL.tillaegstid)}
                  keyFilter={(e) => filterIntegerKeyDown(e, { allowNegative: true })}
                  placeholder="0"
                  textAlign="center"
                  inputMode="numeric"
                />
              </Box>
            </Box>
          </TableCell>
        )}

        {!isMobile && (
          <TableCell>
            <GridChoiceCell<TillaegstidEnhed, RentekravRow>
              gridCell={gc(COL.enhed)}
              cell={buildCellSpec<TillaegstidEnhed | undefined>(
                renderRow,
                rentekravEnhedField as unknown as FieldDescriptor<TillaegstidEnhed | undefined>,
                COL.enhed
              )}
              allowEmpty={false}
              ariaLabel="Enhed for tillægstid"
              sx={{ '& .MuiInputBase-input': { textAlign: 'left' } }}
            >
              {ENHED_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </GridChoiceCell>
          </TableCell>
        )}

        {!isMobile && (
          <TableCell align="center" sx={{ paddingTop: 0, paddingBottom: 0 }}>
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography className="row--text" sx={{ color: 'var(--mineo-color-grid-derived)', textAlign: 'center' }}>
                {actualInterestDateDanish || '-'}
              </Typography>
            </Box>
          </TableCell>
        )}

        <TableCell align="right" sx={{ paddingTop: 0, paddingBottom: 0, ...(isMobile && { paddingRight: '10px' }) }}>
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Typography className="row--text" sx={{ color: 'var(--mineo-color-grid-derived)', textAlign: 'right' }}>
              {calculatedInterest !== null ? formatKr(calculatedInterest, 2) : '-'}
            </Typography>
          </Box>
        </TableCell>

        {!isMobile && (
          <TableCell sx={{ position: 'relative', paddingRight: '28px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {showDownloadButton ? (
                <DownloadIconButton
                  onClick={() => { void onDownloadSpecifikation(rowId); }}
                  disabled={!rowGate.canDownload}
                  tooltip={rowGate.canDownload
                    ? `Download som ${formatLabel}`
                    : rowGate.disabledReason ?? DOWNLOAD_DISABLED_TOOLTIP}
                  ariaLabel={`Download ${formatLabel}-specifikation for række ${rowIndex + 1}`}
                />
              ) : (
                <Typography className="row--text" sx={{ color: 'var(--mineo-color-grid-derived)' }}>
                  -
                </Typography>
              )}
            </Box>
            {renderRow.kind === 'existing' && (
              <RowDeleteButton onDelete={() => onDeleteRow(rowId)} />
            )}
          </TableCell>
        )}
      </TableRow>
    );
  }
);

BeregnetRenteRow.displayName = 'BeregnetRenteRow';

const BeregnetRenteTable = React.memo(
  ({
    committedRows,
    rowProjections,
    onDownloadSpecifikation,
    saveOrderPath,
    isMobile = false,
    documentDownloadFormat,
    resolveDownloadGate,
  }: BeregnetRenteTableProps) => {
    const rows = useCollectionRows<RentekravRow>(rentekravRowsCollectionRef, {
    locationId: 'renteberegning.rentekravRows',
    route: APP_ROUTES.renteberegning,
    tabKey: PAGE_DEFAULT_TAB.renteberegning,
  });


    const sortColumns = React.useMemo(() => [
      { colId: 'belob', getSortValue: (row: RentekravRow) => amountValueToNumber(row.belob) },
      { colId: 'renterFra', getSortValue: (row: RentekravRow) => row.renterFra },
    ], []);

    const handleSortedRowsChange = React.useCallback((sortedRows: RentekravRow[]) => {
      rows.reorder(sortedRows.map((row) => row.id));
    }, [rows]);

    const { sortedRows: sortedCommittedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows: committedRows,
      getRowId: (row) => row.id,
      isRowEmpty: isRentekravRowEmpty,
      columns: sortColumns,
      onSortedRowsChange: handleSortedRowsChange,
    });

    // ── Placeholder-rækker (§1.11) ──────────────────────────────────────────────
    // Greenfield persisterer ikke tomme rækker. Den viste tabel = de committede rækker + en trailing placeholder.
    // Placeholder-id'et er stabilt pr. slot (useRef), så en åben celleeditor ikke skifter identitet under redigering.
    const placeholderIdsRef = React.useRef<string[]>([]);
    const committedIdSet = React.useMemo(() => new Set(sortedCommittedRows.map((row) => row.id)), [sortedCommittedRows]);
    // Legacy viste altid præcis én trailing tom række (ensureRowsWithTrailingEmpty). Greenfield persisterer ikke
    // tomme rækker, så den trailing placeholder er den ene indtastningsklare række.
    const placeholderCount = 1;
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
          id = createRentekravRowId();
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

    // Den fælles cellebinding (§3.2): begge cellearter får en fuldt bundet `FieldRef`, og ejer-id'erne udledes af
    // collectionens egen sti. route + tabKey er eksplicit navigation-metadata (§3.7).
    const buildCellSpec: <T>(
      renderRow: RenderRow,
      descriptor: FieldDescriptor<T>,
      colIdx: number
    ) => CellSpec<T, RentekravRow> = useCollectionCellSpecBuilder<RentekravRow>({
      collection: rentekravRowsCollectionRef,
      createEmptyRow: createEmptyRentekravCommittedRow,
      locationPrefix: collectionLocationPrefix(rentekravRowsCollectionRef),
      locationNav: { route: APP_ROUTES.renteberegning, tabKey: PAGE_DEFAULT_TAB.renteberegning },
    });

    return (
      <StandardLooseTable
        immediateEditing={isMobile}
        sx={{
          tableLayout: 'fixed',
          width: isMobile ? '100%' : '1130px',
          '& .MuiTableCell-root': {
            whiteSpace: 'nowrap',
            verticalAlign: 'middle',
            ...(isMobile && {
              paddingLeft: '6px',
              paddingRight: '6px',
              paddingTop: '4px',
              paddingBottom: '4px',
              fontSize: 'var(--minprocesrente-mobile-content-font-size)',
            }),
            ...(isMobile && {
              '& .MuiInputBase-root, & .MuiInputBase-input': {
                fontSize: 'var(--minprocesrente-mobile-content-font-size)',
              },
            }),
          },
          '& thead th': {
            textAlign: 'center',
          },
          '& .MuiTableRow-root': {
            '@media (hover: hover)': {
              '&:hover': { backgroundColor: isMobile ? 'transparent' : (theme) => theme.palette.action.hover },
            },
            '@media (hover: none)': {
              '&:hover': { backgroundColor: 'transparent' },
            },
          },
        }}
      >
        {isMobile ? (
          <colgroup>
            <col style={{ width: '35%' }} />
            <col style={{ width: '33%' }} />
            <col style={{ width: '32%' }} />
          </colgroup>
        ) : (
          <colgroup>
            <col style={{ width: '176px' }} />
            <col style={{ width: '163px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '224px' }} />
            <col style={{ width: '163px' }} />
            <col style={{ width: '151px' }} />
            <col style={{ width: '163px' }} />
          </colgroup>
        )}
        <TableHead>
          <TableRow>
            <StandardLooseHeaderCell
              sx={{ width: isMobile ? '35%' : '176px' }}
              onClick={() => handleHeaderClick('belob')}
              sortRole={getSortRole('belob')}
              sortDirection={getSortDirection('belob')}
            >
              Beløb
            </StandardLooseHeaderCell>
            <StandardLooseHeaderCell
              sx={{ width: isMobile ? '33%' : '163px' }}
              onClick={() => handleHeaderClick('renterFra')}
              sortRole={getSortRole('renterFra')}
              sortDirection={getSortDirection('renterFra')}
            >
              Renter fra
            </StandardLooseHeaderCell>
            {!isMobile && <TableCell colSpan={2} sx={{ width: '314px' }}>Evt. tillægstid</TableCell>}
            {!isMobile && <TableCell align="center" sx={{ width: '163px' }}>Rentedato</TableCell>}
            <TableCell align="center" sx={{ width: isMobile ? '32%' : '151px' }}>Beregnet rente</TableCell>
            {!isMobile && <TableCell sx={{ width: '163px' }}>Specifikation</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {renderRows.map((renderRow, rowIndex) => {
            return (
              <BeregnetRenteRow
                key={renderRow.rowId}
                renderRow={renderRow}
                rowIndex={rowIndex}
                onDownloadSpecifikation={onDownloadSpecifikation}
                onDeleteRow={rows.remove}
                projection={rowProjections.get(renderRow.rowId)}
                isMobile={isMobile}
                documentDownloadFormat={documentDownloadFormat}
                resolveDownloadGate={resolveDownloadGate}
                buildCellSpec={buildCellSpec}
              />
            );
          })}
        </TableBody>
      </StandardLooseTable>
    );
  }
);

BeregnetRenteTable.displayName = 'BeregnetRenteTable';

export default BeregnetRenteTable;
