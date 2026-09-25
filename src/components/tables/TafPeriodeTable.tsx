import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { RowDeleteButton, RowDeleteLaneCell } from './RowDeleteButton';
import { GridDateCell, GridIntegerCell } from '../../inputCore/react/fields/gridCells';
import {
  eoTafPeriodeFraField,
  eoTafPeriodeLoseFeriedageField,
  eoTafPeriodeTilField,
  eoTafPerioderCollection,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { serializeFieldAddress, type CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldIssue, FieldIssueSet } from '../../inputCore/inputIssue';
import { createFieldWarning } from '../../inputCore/fieldWarning';
import {
  TAF_LOSE_FERIEDAGE_LABEL,
  TAF_PERIODE_UDEN_ARBEJDSDAGE_MESSAGE,
} from '../../domain/erstatningsopgoerelse/validation/tafRowRules';
import type { TafPeriodeRow } from '../../schemas/formSchemas';
import { createEmptyTafCommittedRow, createTafRowId } from '../../domain/erstatningsopgoerelse/tables/tafTableModel';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';
import { useCollectionTable } from './useCollectionTable';
import { useSortedCollectionTable } from './useSortedCollectionTable';
import type { TableSaveOrderPath } from '../../utils/tableSaveOrderRegistry';
import { APP_ROUTES } from '../../config/pageNavigation';
import { EO_TAB_KEYS } from '../../config/eoTabKeys';

export type TafPeriodeTableProps = Readonly<{
  committedRows: readonly TafPeriodeRow[];
  derivedById: Readonly<Record<string, number | null>>;
  derivedColumnHeader: string;
  saveOrderPath?: TableSaveOrderPath;
  /**
   * Rækkereglerne, der ikke kan ligge på descriptoren – cutoff mod differencekrav/EET, overlap og for mange
   * løse feriedage (projekteret fra domænet, se `tafCutoffDateIssues.ts` og `tafRowCellIssues.ts`). Leveres
   * pr. celle på feltets EGEN adresse, så cellen behandler dem som enhver anden rød feltfejl.
   */
  cellIssues?: FieldIssueSet;
  /**
   * «Løse ferie-/feriefridage» vises kun, når TAF opgøres i arbejdsdage; i måneder fradrages de ikke
   * (BB-247). Skjult er ikke udfyldt: værdierne bevares og kommer tilbage, hvis enheden skifter.
   */
  visLoseFeriedage: boolean;
  /** Rækker, hvis periode inden for opgørelsen ikke har én arbejdsdag – gul ring (BB-257). */
  ingenArbejdsdageById?: Readonly<Record<string, boolean>>;
}>;

const createEmptyRow = (id: string): TafPeriodeRow => createEmptyTafCommittedRow(id);
const collection = eoTafPerioderCollection.template as CollectionRef;

const TafPeriodeTable = React.memo(({
  committedRows,
  derivedById,
  derivedColumnHeader,
  saveOrderPath,
  cellIssues,
  visLoseFeriedage,
  ingenArbejdsdageById,
}: TafPeriodeTableProps) => {
  const columns = React.useMemo(() => [
    { colId: 'fra', getSortValue: (row: TafPeriodeRow) => row.fra },
    { colId: 'til', getSortValue: (row: TafPeriodeRow) => row.til },
    { colId: 'loseFeriedage', getSortValue: (row: TafPeriodeRow) => row.loseFeriedage },
    { colId: 'beregnet', getSortValue: (row: TafPeriodeRow) => derivedById[row.id] ?? undefined },
  ], [derivedById]);
  const table = useCollectionTable({
    collection,
    committedRows,
    createRowId: createTafRowId,
    createEmptyRow,
    locationPrefix: 'erstatningsopgoerelse.tafPerioder',
    // route + tabKey er eksplicit navigation-metadata (§3.7); TAF-perioderne bor på EO-oplysningerfanen.
    locationNav: { route: APP_ROUTES.erstatningsopgoerelse, tabKey: EO_TAB_KEYS.EO_OPLYSNINGER },
  });
  const { sortedRows, sortableHeader } = useSortedCollectionTable({
    committedRows,
    getRowId: (row) => row.id,
    isRowEmpty: (row) => table.isRowEmpty(row.id),
    columns,
    reorderRows: table.reorderRows,
    saveOrderPath,
  });
  const renderOrder = table.buildRenderRows(sortedRows);

  return (
    <StandardLooseTable sx={{ width: visLoseFeriedage ? '860px' : '660px', tableLayout: 'fixed', mb: 3, '& .MuiTableCell-root': { textAlign: 'center', whiteSpace: 'nowrap' }, '& thead th': { textAlign: 'center' } }}>
      <TableHead><TableRow>
        <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('fra')}>Fra o.m.</StandardLooseHeaderCell>
        <StandardLooseHeaderCell sx={{ width: 180 }} {...sortableHeader('til')}>Til o.m.</StandardLooseHeaderCell>
        {visLoseFeriedage ? (
          <StandardLooseHeaderCell sx={{ width: 200 }} {...sortableHeader('loseFeriedage')}>{TAF_LOSE_FERIEDAGE_LABEL}</StandardLooseHeaderCell>
        ) : null}
        {/* Overskriften siger, at kolonnen tæller rækkens del inden for EO-perioden – samme form som
            svie/smerte-tabellens «Antal dage (i EO-perioden)» (BB-217, BB-250). */}
        <StandardLooseHeaderCell sx={{ width: 300 }} {...sortableHeader('beregnet')}>{derivedColumnHeader}</StandardLooseHeaderCell>
      </TableRow></TableHead>
      <TableBody>{renderOrder.map((row) => {
        const committed = table.committedById.get(row.rowId);
        const calculated = committed === undefined ? null : (derivedById[committed.id] ?? null);
        // Cutoff-issuet slås op på cellens EGEN, allerede bundne feltadresse. Spec'ets `field` er bundet
        // med hele ejerstien (§3.2), så opslaget kan ikke ramme en anden række end den, cellen redigerer.
        const fraCell = table.buildCellSpec(row, eoTafPeriodeFraField, 0);
        const tilCell = table.buildCellSpec(row, eoTafPeriodeTilField, 1);
        const loseCell = table.buildCellSpec(row, eoTafPeriodeLoseFeriedageField, 2);
        const issueFor = (cell: { field: { address: Parameters<typeof serializeFieldAddress>[0] } }):
          FieldIssue | undefined =>
          cellIssues?.get(serializeFieldAddress(cell.field.address));
        const fraIssue = issueFor(fraCell);
        const tilIssue = issueFor(tilCell);
        const loseIssue = issueFor(loseCell);
        const ingenArbejdsdage = committed !== undefined && ingenArbejdsdageById?.[committed.id] === true
          ? createFieldWarning(TAF_PERIODE_UDEN_ARBEJDSDAGE_MESSAGE)
          : undefined;
        return <TableRow key={row.rowId} data-mineo-row-id={row.rowId}>
          <TableCell><GridDateCell
            gridCell={{ rowId: row.rowId, colIndex: 0 }}
            cell={fraCell}
            {...(fraIssue === undefined ? {} : { collectionRuleIssue: fraIssue })}
            {...(ingenArbejdsdage === undefined ? {} : { warning: ingenArbejdsdage })}
          /></TableCell>
          <TableCell><GridDateCell
            gridCell={{ rowId: row.rowId, colIndex: 1 }}
            cell={tilCell}
            {...(tilIssue === undefined ? {} : { collectionRuleIssue: tilIssue })}
            {...(ingenArbejdsdage === undefined ? {} : { warning: ingenArbejdsdage })}
          /></TableCell>
          {visLoseFeriedage ? (
            <TableCell><GridIntegerCell
              gridCell={{ rowId: row.rowId, colIndex: 2 }}
              cell={loseCell}
              {...(loseIssue === undefined ? {} : { collectionRuleIssue: loseIssue })}
            /></TableCell>
          ) : null}
          <RowDeleteLaneCell>
            <Typography variant="body1">{calculated === null ? '' : formatAsAmountTrimmed(calculated)}</Typography>
            {committed !== undefined && !table.isRowEmpty(committed.id) ? <RowDeleteButton onDelete={() => table.removeRow(committed.id)} /> : null}
          </RowDeleteLaneCell>
        </TableRow>;
      })}</TableBody>
    </StandardLooseTable>
  );
});

TafPeriodeTable.displayName = 'TafPeriodeTable';
export default TafPeriodeTable;
