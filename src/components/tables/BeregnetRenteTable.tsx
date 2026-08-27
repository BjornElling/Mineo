import * as React from 'react';
import { Box, MenuItem, TableBody, TableCell, TableFooter, TableHead, TableRow, Typography } from '@mui/material';
import DownloadIconButton from '../inputs/DownloadIconButton';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton, RowDeleteLaneCell } from './RowDeleteButton';
import { useCollectionTable } from './useCollectionTable';
import { useSortedCollectionTable } from './useSortedCollectionTable';
import { formatKr } from '../../utils/formatUtils';
import { round2, sumRoundedValues } from '../../utils/roundingShortcuts';
import { APP_ROUTES, PAGE_DEFAULT_TAB } from '../../config/pageNavigation';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import type { RentekravRow } from '../../schemas/formSchemas';
import type { RentekravRowResult } from '../../domain/renteberegning/renteberegningEngine';
import {
  createEmptyRentekravCommittedRow,
  createRentekravRowId,
} from '../../domain/renteberegning/rentekravTableModel';
import type { ProjectionResult } from '../../inputCore/projection';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import {
  DOWNLOAD_DISABLED_TOOLTIP,
  getDocumentFormatLabel,
  type DocumentDownloadFormat,
} from '../../document/documentFormat';
import type { CellSpec } from '../../inputCore/react/useCellEditor';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import {
  collectionLocationPrefix,
  type CollectionRenderRow as RenderRow,
} from '../../inputCore/react/cellSpecBuilder';
import {
  GridAmountCell,
  GridDateCell,
} from '../../inputCore/react/fields/gridCells';
import GridTextCell from '../../inputCore/react/fields/GridTextCell';
import GridChoiceCell from '../../inputCore/react/fields/GridChoiceCell';
import { integerAdmission } from '../inputs/draftAdmission';
import { codecAllowsNegative } from '../../inputCore/react/fields/signPolicy';
import {
  rentekravRowsCollectionRef,
  rentekravBelobField,
  rentekravRenterFraField,
  rentekravTillaegstidField,
  rentekravEnhedField,
} from '../../inputCore/catalog/renteberegningDescriptors';
import type { TillaegstidEnhed } from '../../schemas/formSchemas/enumSchemas';
import type { AmountValue } from '../../schemas/amountExpressionSchema';

// BeregnetRenteTable: Rækkeinfrastruktur, celleværdier og
// celleredigering går nu udelukkende gennem inputCore, som StandardLoenTable:
//  - `useCollectionRows(rentekravRowsCollection)` ejer rækkernes id'er + insert/delete/reorder (§3.8) – ingen
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

/**
 * Tillægstidens fortegns-politik, læst af feltets EGET codec.
 *
 * Modulniveau, fordi politikken er en statisk egenskab ved descriptoren og ikke afhænger af rækken – så
 * opslaget ikke gentages pr. celle-render. Cellen bruger `GridTextCell` direkte (den er 50 px bred og
 * centreret) og får derfor ikke `GridIntegerCell`'s automatiske opslag.
 */
const TILLAEGSTID_ALLOWS_NEGATIVE = codecAllowsNegative(rentekravTillaegstidField.codec);
const TILLAEGSTID_MAX_DIGITS = rentekravTillaegstidField.codec.maxDigits;
const TILLAEGSTID_ADMISSION = integerAdmission({
  allowNegative: TILLAEGSTID_ALLOWS_NEGATIVE,
  ...(TILLAEGSTID_MAX_DIGITS === undefined ? {} : { maxDigits: TILLAEGSTID_MAX_DIGITS }),
});

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
   * OG samme request). Tabellen udleder ikke selv knaptilstanden – gjorde den det, ville den reaktive
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
  rowIsSemanticallyEmpty: boolean;
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
    rowIsSemanticallyEmpty,
    isMobile,
    documentDownloadFormat,
    resolveDownloadGate,
    buildCellSpec,
  }: BeregnetRenteRowProps) => {
    const rowId = renderRow.rowId;
    const formatLabel = getDocumentFormatLabel(documentDownloadFormat);

    const { actualInterestDate, calculatedInterest } = projection?.status === 'ready'
      ? projection.value
      : { actualInterestDate: null, calculatedInterest: null };

    const actualInterestDateDanish = isoToDanish(actualInterestDate ?? undefined) ?? null;
    // En række med indhold har altid sin handling synlig. Gaten bestemmer alene, om den er aktiv,
    // så manglende fælles input kan forklares i tooltippen i stedet for at skjule kontrollen.
    const showDownloadButton = !rowIsSemanticallyEmpty;
    const rowGate = showDownloadButton
      ? resolveDownloadGate(rowId)
      : { canDownload: false as const };

    const gc = (colIndex: number) => ({ rowId, colIndex });

    return (
      <TableRow data-mineo-row-id={rowId}>
        <TableCell sx={isMobile ? undefined : { textAlign: 'center' }}>
          <GridAmountCell
            gridCell={gc(COL.belob)}
            cell={buildCellSpec<AmountValue | undefined>(renderRow, rentekravBelobField, COL.belob)}
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
                  // Politikken læses af descriptoren; `tillaegstid` er 0..99 og altså ikke-negativ.
                  // Callsitet hardkodede før `true` i strid med feltets egen erklæring.
                  admission={TILLAEGSTID_ADMISSION}
                  placeholder="0"
                  textAlign="center"
                  inputMode="numeric"
                  maxDraftLength={TILLAEGSTID_MAX_DIGITS}
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
              <Box component="span" sx={{ color: 'var(--mineo-color-active-grid-derived)', textAlign: 'center' }}>
                {actualInterestDateDanish || '-'}
              </Box>
            </Box>
          </TableCell>
        )}

        <TableCell align="right" sx={{ paddingTop: 0, paddingBottom: 0, ...(isMobile && { paddingRight: '10px' }) }}>
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Box component="span" sx={{ color: 'var(--mineo-color-active-grid-derived)', textAlign: 'right' }}>
              {calculatedInterest !== null ? formatKr(calculatedInterest, 2) : '-'}
            </Box>
          </Box>
        </TableCell>

        {!isMobile && (
          <RowDeleteLaneCell>
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
                <Box component="span" sx={{ color: 'var(--mineo-color-active-grid-derived)' }}>
                  -
                </Box>
              )}
            </Box>
            {renderRow.kind === 'existing' && !rowIsSemanticallyEmpty && (
              <RowDeleteButton onDelete={() => onDeleteRow(rowId)} />
            )}
          </RowDeleteLaneCell>
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
    // Kataloget ejer, om en række er tom. Det inkluderer både default-valget og afvist råtekst,
    // så alle dynamiske tabeller får samme trailing-, slette- og sorteringsadfærd.
    const table = useCollectionTable<RentekravRow>({
      collection: rentekravRowsCollectionRef,
      committedRows,
      createRowId: createRentekravRowId,
      createEmptyRow: createEmptyRentekravCommittedRow,
      locationPrefix: collectionLocationPrefix(rentekravRowsCollectionRef),
      locationNav: { route: APP_ROUTES.renteberegning, tabKey: PAGE_DEFAULT_TAB.renteberegning },
    });

    const sortColumns = React.useMemo(() => [
      { colId: 'belob', getSortValue: (row: RentekravRow) => amountValueToNumber(row.belob) },
      { colId: 'renterFra', getSortValue: (row: RentekravRow) => row.renterFra },
    ], []);

    const { sortedRows, sortableHeader } = useSortedCollectionTable({
      committedRows,
      getRowId: (row) => row.id,
      isRowEmpty: (row) => table.isRowEmpty(row.id),
      columns: sortColumns,
      reorderRows: table.reorderRows,
      saveOrderPath,
    });

    const renderRows = table.buildRenderRows(sortedRows);
    const { committedById, buildCellSpec } = table;
    const totalInterest = React.useMemo(() => {
      const values: number[] = [];
      for (const row of committedRows) {
        // En canonical tom trailing række er kun en strukturel placeholder og skal ikke skjule en
        // gyldig samlet sum. Alle rækker med faktisk afsluttet input skal derimod være beregningsklare,
        // før totalen vises – en delsum ville være mere misvisende end ingen sum.
        if (table.isRowEmpty(row.id)) continue;
        const projection = rowProjections.get(row.id);
        if (projection?.status !== 'ready' || projection.value.pdfContext === null) return null;
        values.push(projection.value.pdfContext.calculatedInterest);
      }
      return values.length > 1 ? sumRoundedValues(values, round2) : null;
    }, [committedRows, rowProjections, table]);

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
              {...sortableHeader('belob')}
            >
              Beløb
            </StandardLooseHeaderCell>
            <StandardLooseHeaderCell
              sx={{ width: isMobile ? '33%' : '163px' }}
              {...sortableHeader('renterFra')}
            >
              Forfaldsdato
            </StandardLooseHeaderCell>
            {!isMobile && <TableCell colSpan={2} sx={{ width: '314px' }}>Evt. tillægstid</TableCell>}
            {!isMobile && <TableCell align="center" sx={{ width: '163px' }}>Rentedato</TableCell>}
            <TableCell align="center" sx={{ width: isMobile ? '32%' : '151px' }}>Beregnet rente</TableCell>
            {!isMobile && <TableCell sx={{ width: '163px' }}>Specifikation</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {renderRows.map((renderRow, rowIndex) => {
            const committedRow = committedById.get(renderRow.rowId);
            return (
              <BeregnetRenteRow
                key={renderRow.rowId}
                renderRow={renderRow}
                rowIndex={rowIndex}
                onDownloadSpecifikation={onDownloadSpecifikation}
                onDeleteRow={table.removeRow}
                projection={rowProjections.get(renderRow.rowId)}
                rowIsSemanticallyEmpty={committedRow === undefined || table.isRowEmpty(renderRow.rowId)}
                isMobile={isMobile}
                documentDownloadFormat={documentDownloadFormat}
                resolveDownloadGate={resolveDownloadGate}
                buildCellSpec={buildCellSpec}
              />
            );
          })}
        </TableBody>
        {totalInterest !== null && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={isMobile ? 2 : 5} align="right">
                <Typography>Samlet rentebeløb</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography>{formatKr(totalInterest, 2)}</Typography>
              </TableCell>
              {!isMobile && <TableCell />}
            </TableRow>
          </TableFooter>
        )}
      </StandardLooseTable>
    );
  }
);

BeregnetRenteTable.displayName = 'BeregnetRenteTable';

export default BeregnetRenteTable;
