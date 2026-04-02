import * as React from 'react';
import { TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import TableDateIsoInput from '../inputs/table/TableDateIsoInput';
import TableDropdown, { type TableDropdownOption } from '../inputs/table/TableDropdown';
import StandardLooseTable, { StandardLooseHeaderCell } from './StandardLooseTable';
import { useTableSort } from './useTableSort';
import { computeSkadesdatoMinRule, dateRanges_erstatningsopgoerelse } from '../../config/dateRanges';
import type { SvieSmertePeriodeRow, Tilstand } from '../../schemas/formSchemas';
import { tilstandEnum } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { isoToDanish, subtractOneDay } from '../../types/branded';
import { computeRowDateBounds } from '../../domain/erstatningsopgoerelse/helpers/rowDateBounds';
import type { SvieSmerteDraftRow } from '../../domain/erstatningsopgoerelse/tables/tableDraftRows';
import { useRegisterTableSaveOrder } from './useRegisterTableSaveOrder';

type SvieSmerteDerived = Readonly<{
  hasRangeError: boolean;
  antalDage: number | null;
}>;

export type SvieSmerteTableProps = Readonly<{
  rows: SvieSmerteDraftRow[];
  committedById: ReadonlyMap<string, SvieSmertePeriodeRow>;
  derivedById: Record<string, SvieSmerteDerived>;
  overlappingIds: ReadonlySet<string>;
  skadesdatoISO: ISODateString | undefined;
  menAfgoerelseDato: ISODateString | undefined;
  erErhvervssygdom: boolean;
  verserendeKlageMen: boolean;
  onFieldChange: (rowId: string, field: 'fra' | 'til' | 'tilstand') => (value: string) => void;
  onRowBlur: (rowId: string) => void;
  saveOrderPath?: string;
}>;

const SVIE_TILSTAND_OPTIONS: readonly TableDropdownOption[] = [
  { value: 'sygemeldt', label: 'Sygemeldt' },
  { value: 'delvist-sygemeldt', label: 'Delvist Sygemeldt' },
];

const buildAfterVarigeMenErrorMessage = (menAfgoerelseDato: ISODateString): string => {
  const dateText = isoToDanish(menAfgoerelseDato) ?? menAfgoerelseDato;
  return `Der er angivet svie/smerte efter afgørelse om varige mén (${dateText})`;
};

const getRowId = (row: SvieSmerteDraftRow) => row.id;
const isRowEmpty = (row: SvieSmerteDraftRow) => row.fra.trim() === '' && row.til.trim() === '';

const SvieSmerteTable = React.memo(
  ({ rows, committedById, derivedById, overlappingIds, skadesdatoISO, menAfgoerelseDato, erErhvervssygdom, verserendeKlageMen, onFieldChange, onRowBlur, saveOrderPath }: SvieSmerteTableProps) => {
    const sortColumns = React.useMemo(() => [
      { colId: 'fra', getSortValue: (row: SvieSmerteDraftRow) => committedById.get(row.id)?.fra },
      { colId: 'til', getSortValue: (row: SvieSmerteDraftRow) => committedById.get(row.id)?.til },
      { colId: 'antalDage', getSortValue: (row: SvieSmerteDraftRow) => derivedById[row.id]?.antalDage ?? undefined },
      { colId: 'tilstand', getSortValue: (row: SvieSmerteDraftRow) => committedById.get(row.id)?.tilstand },
    ], [committedById, derivedById]);

    const { sortedRows, getSortRole, getSortDirection, handleHeaderClick } = useTableSort({
      rows,
      getRowId,
      isRowEmpty,
      columns: sortColumns,
    });
    const visibleRowIds = React.useMemo(() => sortedRows.map((row) => row.id), [sortedRows]);
    useRegisterTableSaveOrder(saveOrderPath, visibleRowIds);

    return (
      <StandardLooseTable
        sx={{
          width: '760px',
          tableLayout: 'fixed',
          mb: 3,
          '& .MuiTableCell-root': {
            textAlign: 'center',
            whiteSpace: 'nowrap',
          },
          '& thead th': {
            textAlign: 'center',
          },
        }}
      >
        <TableHead>
          <TableRow>
            <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('fra')} sortRole={getSortRole('fra')} sortDirection={getSortDirection('fra')}>Fra o.m.</StandardLooseHeaderCell>
            <StandardLooseHeaderCell sx={{ width: 180 }} onClick={() => handleHeaderClick('til')} sortRole={getSortRole('til')} sortDirection={getSortDirection('til')}>Til o.m.</StandardLooseHeaderCell>
            <StandardLooseHeaderCell sx={{ width: 100 }} onClick={() => handleHeaderClick('antalDage')} sortRole={getSortRole('antalDage')} sortDirection={getSortDirection('antalDage')}>Antal dage</StandardLooseHeaderCell>
            <StandardLooseHeaderCell sx={{ width: 220 }} onClick={() => handleHeaderClick('tilstand')} sortRole={getSortRole('tilstand')} sortDirection={getSortDirection('tilstand')}>Tilstand</StandardLooseHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedRows.map((row) => {
            const committed = committedById.get(row.id);
            const derived = derivedById[row.id];
            const beregnetVaerdi = derived?.antalDage ?? null;

            const fraISO = committed?.fra;
            const tilISO = committed?.til;

            // Mén-afgørelsesdato: til-dato skal være < menAfgoerelseDato (ikke <=)
            // Derfor trækker vi én dag fra menAfgoerelseDato
            const menAfgoerelseDatoMinus1 = menAfgoerelseDato ? subtractOneDay(menAfgoerelseDato) : undefined;
            const shouldApplyMenCutoff = !verserendeKlageMen && menAfgoerelseDato !== undefined;
            const fraAfterVarigeMen = shouldApplyMenCutoff && fraISO !== undefined && fraISO >= menAfgoerelseDato;
            const tilAfterVarigeMen = shouldApplyMenCutoff && tilISO !== undefined && tilISO >= menAfgoerelseDato;

            const skadesdatoMinRule = computeSkadesdatoMinRule({
              skadesdatoISO,
              erErhvervssygdom,
              fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
            });

            const bounds = computeRowDateBounds({
              skadesdatoMinDate: skadesdatoMinRule.minDate,
              rowFra: fraISO,
              rowTil: tilISO,
              fallbackMin: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMin,
              fallbackMax: dateRanges_erstatningsopgoerelse.tabelSvieSmerteFra.fallbackMax,
              tilFallbackMax: dateRanges_erstatningsopgoerelse.tabelSvieSmerteTil.max,
              tilExtraMaxDate: menAfgoerelseDatoMinus1,
              useTilExtraMaxDate: !verserendeKlageMen,
            });
            const absoluteMinDate = bounds.fra.min;
            const fraMaxDate = bounds.fra.max;
            const tilMinDate = bounds.til.min;
            const tilMaxDate = bounds.til.max;

            const tilstandValue: Tilstand | undefined = (() => {
              const trimmed = row.tilstand.trim();
              if (trimmed === '') return undefined;
              const parsed = tilstandEnum.safeParse(trimmed);
              return parsed.success ? parsed.data : undefined;
            })();

            // Generer konkrete årsager til afgrænsning
            const fraNoValidRangeCause = (() => {
              const parts: string[] = [];
              if (skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
              if (tilISO) parts.push('til-dato i samme række');
              return parts.length > 0 ? parts.join(', ') : undefined;
            })();

            const tilNoValidRangeCause = (() => {
              const parts: string[] = [];
              if (!fraISO && skadesdatoMinRule.minBoundKind) parts.push('skadesdato');
              if (fraISO) parts.push('fra-dato i samme række');
              parts.push('dags dato');
              if (!verserendeKlageMen && menAfgoerelseDato) parts.push('dato for ménafgørelse');
              return parts.join(', ');
            })();

            // Tjek om denne række har overlappende periode
            const hasOverlap = overlappingIds.has(row.id);
            const overlapError = hasOverlap ? 'Der er overlappende perioder' : undefined;

            const afterVarigeMenErrorMessage = menAfgoerelseDato ? buildAfterVarigeMenErrorMessage(menAfgoerelseDato) : undefined;

            const fraErrorMessage =
              fraAfterVarigeMen && overlapError
                ? `${afterVarigeMenErrorMessage}; ${overlapError}`
                : fraAfterVarigeMen
                  ? afterVarigeMenErrorMessage
                  : overlapError;
            const tilErrorMessage =
              tilAfterVarigeMen && overlapError
                ? `${afterVarigeMenErrorMessage}; ${overlapError}`
                : tilAfterVarigeMen
                  ? afterVarigeMenErrorMessage
                  : overlapError;

            return (
              <TableRow key={row.id} data-mineo-row-id={row.id}>
                <TableCell>
                  <TableDateIsoInput
                    gridCell={{ rowId: row.id, colIndex: 0 }}
                    value={fraISO}
                    onBlur={(e) => {
                      onFieldChange(row.id, 'fra')(e.target.value ?? '');
                      onRowBlur(row.id);
                    }}
                    minDate={absoluteMinDate}
                    maxDate={fraMaxDate}
                    specialRangeErrors={{
                      fraTilRole: 'fra',
                      minBoundKind: skadesdatoMinRule.minBoundKind,
                      minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
                    }}
                    noValidRangeCause={fraNoValidRangeCause}
                    externalErrorMessage={fraErrorMessage}
                  />
                </TableCell>
                <TableCell>
                  <TableDateIsoInput
                    gridCell={{ rowId: row.id, colIndex: 1 }}
                    value={tilISO}
                    onBlur={(e) => {
                      onFieldChange(row.id, 'til')(e.target.value ?? '');
                      onRowBlur(row.id);
                    }}
                    minDate={tilMinDate}
                    maxDate={tilMaxDate}
                    specialRangeErrors={{
                      fraTilRole: 'til',
                      minBoundKind:
                        skadesdatoMinRule.minBoundKind && tilMinDate === absoluteMinDate ? skadesdatoMinRule.minBoundKind : undefined,
                      minBoundReferenceISO: skadesdatoMinRule.minBoundReferenceISO,
                    }}
                    noValidRangeCause={tilNoValidRangeCause}
                    externalErrorMessage={tilErrorMessage}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body1">{beregnetVaerdi !== null ? beregnetVaerdi : ''}</Typography>
                </TableCell>
                <TableCell>
                  <TableDropdown
                    gridCell={{ rowId: row.id, colIndex: 3 }}
                    value={tilstandValue}
                    options={SVIE_TILSTAND_OPTIONS}
                    appearance="loose"
                    sx={{ width: 200 }}
                    onChange={(e) => {
                      onFieldChange(row.id, 'tilstand')(e.target.value ?? '');
                      onRowBlur(row.id);
                    }}
                    placeholder="Vælg tilstand"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </StandardLooseTable>
    );
  }
);

SvieSmerteTable.displayName = 'SvieSmerteTable';

export default SvieSmerteTable;
