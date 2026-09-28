import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import InfoTooltipIcon from '../common/InfoTooltipIcon';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton, RowDeleteLaneCell } from './RowDeleteButton';
import { GridDateCell } from '../../inputCore/react/fields/gridCells';
import {
  eoFerieperiodeFraField,
  eoFerieperiodeTilField,
  eoFerieperioderCollection,
  eoFravaerPeriodeFraField,
  eoFravaerPeriodeTilField,
  eoFravaerPerioderCollection,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { serializeFieldAddress, type CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldIssueSet } from '../../inputCore/inputIssue';
import type { FerieperiodeRow } from '../../schemas/formSchemas';
import { createEmptyFerieCommittedRow, createFravaerRowId, createTafFerieRowId } from '../../domain/erstatningsopgoerelse/tables/ferieTableModel';
import { useCollectionTable } from './useCollectionTable';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { useSortedCollectionTable } from './useSortedCollectionTable';
import { APP_ROUTES } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';

export type FerieperiodeTableProps = Readonly<{
  kind: 'taf' | 'beregningsperiode';
  committedRows: readonly FerieperiodeRow[];
  feriedageById: Readonly<Record<string, number | null>>;
  saveOrderPath?: TableSaveOrderPath;
  /**
   * Rækkereglerne, der ikke kan ligge på descriptoren – overlap og feriens vindue (projekteret fra domænet,
   * se `tafRowCellIssues.ts`). Leveres pr. celle på feltets EGEN adresse (BB-248, BB-251).
   */
  cellIssues?: FieldIssueSet;
}>;

/**
 * Kolonnen tæller de feriedage, beregningen fradrager. Ikonets tooltip siger rammen (BB-249).
 */
const FERIEDAGE_OVERSKRIFT: Readonly<Record<FerieperiodeTableProps['kind'], Readonly<{ label: string; tooltip: string }>>> = {
  taf: { label: 'Feriedage', tooltip: 'Kun dage i TAF-perioden fremgår' },
  beregningsperiode: { label: 'Feriedage', tooltip: 'Kun dage i beregningsperioden fremgår' },
};

const FerieperiodeTable = React.memo(({
  kind,
  committedRows,
  feriedageById,
  saveOrderPath,
  cellIssues,
}: FerieperiodeTableProps) => {
  const collection = (kind === 'taf' ? eoFerieperioderCollection.template : eoFravaerPerioderCollection.template) as CollectionRef;
  const fraField = kind === 'taf' ? eoFerieperiodeFraField : eoFravaerPeriodeFraField;
  const tilField = kind === 'taf' ? eoFerieperiodeTilField : eoFravaerPeriodeTilField;
  const createRowId = kind === 'taf' ? createTafFerieRowId : createFravaerRowId;
  const createEmptyRow = React.useCallback((id: string) => createEmptyFerieCommittedRow(id), []);
  const table = useCollectionTable({
    collection,
    committedRows,
    createRowId,
    createEmptyRow,
    locationPrefix: kind === 'taf'
      ? 'erstatningsopgoerelse.ferieperioder'
      : 'erstatningsopgoerelse.fravaerPerioder',
    // route + tabKey er eksplicit navigation-metadata (§3.7); begge render-steder (TAF- og
    // beregningsperiode-varianten) bor på EO-oplysningerfanen.
    locationNav: { route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER },
  });
  const columns = React.useMemo(() => [
    { colId: 'fra', getSortValue: (row: FerieperiodeRow) => row.fra },
    { colId: 'til', getSortValue: (row: FerieperiodeRow) => row.til },
    { colId: 'feriedage', getSortValue: (row: FerieperiodeRow) => feriedageById[row.id] ?? undefined },
  ], [feriedageById]);
  const { sortedRows, sortableHeader } = useSortedCollectionTable({
    committedRows,
    getRowId: (row) => row.id,
    isRowEmpty: (row) => table.isRowEmpty(row.id),
    columns,
    reorderRows: table.reorderRows,
    saveOrderPath,
  });
  const renderRows = table.buildRenderRows(sortedRows);

  return (
    <StandardLooseTable sx={{
      width: '620px', tableLayout: 'fixed', mb: 3,
      '& .MuiTableCell-root': { textAlign: 'center', whiteSpace: 'nowrap' },
      '& thead th': { textAlign: 'center' },
    }}>
      <TableHead>
        <TableRow>
          <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('fra')}>Fra o.m.</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('til')}>Til o.m.</StandardLooseHeaderCell>
          <StandardLooseHeaderCell sx={{ width: 260 }} {...sortableHeader('feriedage')}>
            {FERIEDAGE_OVERSKRIFT[kind].label}
            <InfoTooltipIcon title={FERIEDAGE_OVERSKRIFT[kind].tooltip} />
          </StandardLooseHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {renderRows.map((row) => {
          const committed = table.committedById.get(row.rowId);
          const fraCell = table.buildCellSpec(row, fraField, 0);
          const tilCell = table.buildCellSpec(row, tilField, 1);
          const fraIssue = cellIssues?.get(serializeFieldAddress(fraCell.field.address));
          const tilIssue = cellIssues?.get(serializeFieldAddress(tilCell.field.address));
          return (
            <TableRow key={row.rowId} data-mineo-row-id={row.rowId}>
              <TableCell>
                <GridDateCell
                  gridCell={{ rowId: row.rowId, colIndex: 0 }}
                  cell={fraCell}
                  {...(fraIssue === undefined ? {} : { collectionRuleIssue: fraIssue })}
                />
              </TableCell>
              <TableCell>
                <GridDateCell
                  gridCell={{ rowId: row.rowId, colIndex: 1 }}
                  cell={tilCell}
                  {...(tilIssue === undefined ? {} : { collectionRuleIssue: tilIssue })}
                />
              </TableCell>
              <RowDeleteLaneCell>
                <Typography variant="body1" sx={{ textAlign: 'center', py: 0.5 }}>
                  {committed === undefined ? '' : (feriedageById[committed.id] ?? '')}
                </Typography>
                {committed !== undefined && !table.isRowEmpty(committed.id) ? (
                  <RowDeleteButton onDelete={() => table.removeRow(committed.id)} />
                ) : null}
              </RowDeleteLaneCell>
            </TableRow>
          );
        })}
      </TableBody>
    </StandardLooseTable>
  );
});

FerieperiodeTable.displayName = 'FerieperiodeTable';

export default FerieperiodeTable;
