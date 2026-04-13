import * as React from 'react';
import { Alert, AlertTitle, Box, Typography } from '@mui/material';
import { Check, Download, ErrorOutline } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import ContentBox from '../../layout/ContentBox';
import { getSammentaellingControlStatus, type SammentaellingControl, type SammentaellingDisplayRow } from '../../../domain/debug/eoDebugSammentaelling';
import { CSV_DELIMITER, escapeCsvCell, normalizeCsvHeader, toCsvScalar } from '../../../domain/debug/eoDebugCsv';
import { formatCurrency } from '../../../utils/formatUtils';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import { downloadFile } from '../../../utils/fileHelpers';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import VirtualizedDisplayTable from '../../tables/VirtualizedDisplayTable';
import type { VirtualizedDisplayTableHeaderRow } from '../../tables/VirtualizedDisplayTable';
import type { EODebugSnapshot } from '../../../domain/debug/eoDebugSnapshot';

const ROW_HEIGHT = 28;

const isAmountColumnId = (id: string): boolean => id.startsWith('offentlig:') || id.includes(':wage:');

const isDanishNumberString = (value: string): boolean => {
  if (value.trim() === '') return false;
  return /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(value) || /^-?\d+(,\d+)?$/.test(value);
};

const parseDanishNumberString = (value: string): number => {
  const clean = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const resolveEmploymentHeaderTitle = (snapshot: EODebugSnapshot, employmentIndex: number): string => {
  const employment = snapshot.eoValues.loenindkomstAnsaettelsesforhold?.[employmentIndex];
  const arbejdsstedNavn = employment?.navnPaaArbejdssted?.trim() ?? '';
  return arbejdsstedNavn !== '' ? arbejdsstedNavn : `Ansættelsessted ${employmentIndex + 1}`;
};

const parseEmploymentIndexFromColumnId = (columnId: string): number | null => {
  const match = columnId.match(/^loen:(\d+):(taf_regulering|wage:[^:]+)$/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : null;
};

type EODebugTabelProps = {
  debugSnapshot?: EODebugSnapshot | null;
};

const EODebugTabel = React.memo(({ debugSnapshot = null }: EODebugTabelProps) => {
  const theme = useTheme();
  const snapshot = debugSnapshot;
  const model = snapshot?.model ?? null;

  const formatIso = React.useCallback((iso: ISODateString | undefined): string => {
    if (!iso) return '-';
    return isoToDanish(iso) ?? '-';
  }, []);

  const summaryRows = React.useMemo(() => {
    if (!model) return [] as StandardDisplayTableRow[];

    const rows: StandardDisplayTableRow[] = model.sources.map((source) => ({
      key: source.label,
      cells: [source.label, formatIso(source.fra), formatIso(source.til)],
    }));

    rows.push({
      key: 'combined',
      cells: ['Laveste/højeste dato (beregnet)', formatIso(model.combinedMinFra), formatIso(model.combinedMaxTil)],
      rowSx: {
        '& .MuiTableCell-root': {
          borderTop: '1px solid #e5e7eb !important',
        },
      },
    });

    rows.push({
      key: 'table-range',
      cells: [
        'Tabelperiode (definerende)',
        <Box key="fra" component="span" sx={{ fontWeight: 600 }}>
          {formatIso(model.summaryTableFra)}
        </Box>,
        <Box key="til" component="span" sx={{ fontWeight: 600 }}>
          {formatIso(model.summaryTableTil)}
        </Box>,
      ],
    });

    return rows;
  }, [formatIso, model]);

  const sammentaellingTables = React.useMemo(() => {
    const renderControl = (control: SammentaellingControl): React.ReactElement => {
      const status = getSammentaellingControlStatus(control);
      if (status === 'ok') {
        return <Check sx={{ color: 'green', fontSize: 20 }} />;
      }
      return <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />;
    };

    const toTableRows = (displayRows: readonly SammentaellingDisplayRow[]): StandardDisplayTableRow[] => {
      return displayRows.map((entry) => ({
        key: entry.key,
        cells: [
          entry.label,
          entry.control.beregnetDisplay,
          entry.control.tabelDisplay,
          renderControl(entry.control),
        ],
      }));
    };

    if (!snapshot) {
      return {
        basis: [] as StandardDisplayTableRow[],
        beregningsperiode: [] as StandardDisplayTableRow[],
        taf: [] as StandardDisplayTableRow[],
        sfgg: [] as StandardDisplayTableRow[],
      };
    }

    return {
      basis: toTableRows(snapshot.sammentaellingTables.basis),
      beregningsperiode: toTableRows(snapshot.sammentaellingTables.beregningsperiode),
      taf: toTableRows(snapshot.sammentaellingTables.taf),
      sfgg: toTableRows(snapshot.sammentaellingTables.sfgg ?? []),
    };
  }, [snapshot]);

  const tableColumns = React.useMemo(() => {
    if (!model) return [];
    return model.columns.map((column) => ({
      id: column.id,
      header: column.header,
      align: column.align,
      width: column.width,
      borderLeft: column.borderLeft,
    }));
  }, [model]);

  const tableHeaderRows = React.useMemo(() => {
    if (!snapshot || !model) return undefined;

    const topRowCells: Array<VirtualizedDisplayTableHeaderRow['cells'][number]> = [];
    let columnIndex = 0;

    while (columnIndex < model.columns.length) {
      const column = model.columns[columnIndex];
      if (!column) break;

      const employmentIndex = parseEmploymentIndexFromColumnId(column.id);
      if (employmentIndex === null) {
        topRowCells.push({
          key: `top:${column.id}`,
          content: '',
          columnId: undefined,
          colSpan: 1,
          width: column.width,
          borderLeft: column.borderLeft,
        });
        columnIndex += 1;
        continue;
      }

      let spanWidth = column.width;
      let spanCount = 1;
      let nextIndex = columnIndex + 1;
      while (nextIndex < model.columns.length) {
        const nextColumn = model.columns[nextIndex];
        if (!nextColumn) break;
        if (parseEmploymentIndexFromColumnId(nextColumn.id) !== employmentIndex) break;
        spanWidth += nextColumn.width;
        spanCount += 1;
        nextIndex += 1;
      }

      topRowCells.push({
        key: `employment:${employmentIndex}`,
        content: (
          <Box component="span" sx={{ display: 'block', fontWeight: 700, textAlign: 'center' }}>
            {resolveEmploymentHeaderTitle(snapshot, employmentIndex)}
          </Box>
        ),
        colSpan: spanCount,
        width: spanWidth,
        borderLeft: column.borderLeft,
      });
      columnIndex = nextIndex;
    }

    const bottomRowCells: Array<VirtualizedDisplayTableHeaderRow['cells'][number]> = model.columns.map((column) => ({
      key: `bottom:${column.id}`,
      content: column.header,
      columnId: column.id,
      width: column.width,
      align: 'center',
      borderLeft: column.borderLeft,
    }));

    return [
      { key: 'employment-groups', cells: topRowCells, stickyHeight: 32 },
      { key: 'column-labels', cells: bottomRowCells, stickyHeight: 44 },
    ] satisfies readonly VirtualizedDisplayTableHeaderRow[];
  }, [model, snapshot]);

  const renderCell = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!model) return '';
      const column = model.columns[colIndex];
      return column ? column.getCell(rowIndex) : '';
    },
    [model]
  );

  const stickyHeaderTop = React.useMemo(() => -Number.parseFloat(theme.spacing(3)) - 2, [theme]);
  const canDownloadDebugTable = Boolean(model?.tableFra && model?.tableTil);

  const formatCsvAmountCell = React.useCallback((value: unknown): string => {
    const scalar = toCsvScalar(value);
    const trimmed = scalar.trim();
    if (trimmed === '') return '';
    if (!isDanishNumberString(trimmed)) return scalar;
    const parsed = parseDanishNumberString(trimmed);
    if (!Number.isFinite(parsed)) return scalar;
    return formatCurrency(parsed);
  }, []);

  const handleDownloadDebugTable = React.useCallback(() => {
    if (!canDownloadDebugTable || !model) return;

    const headers = model.columns.map((column) => escapeCsvCell(normalizeCsvHeader(column.header)));
    const lines: string[] = [];
    lines.push(headers.join(CSV_DELIMITER));

    for (let rowIndex = 0; rowIndex < model.rowCount; rowIndex += 1) {
      const cells = model.columns.map((column) => {
        const cellValue = column.getCell(rowIndex);
        const scalar = isAmountColumnId(column.id) ? formatCsvAmountCell(cellValue) : toCsvScalar(cellValue);
        return escapeCsvCell(scalar);
      });
      lines.push(cells.join(CSV_DELIMITER));
    }

    const content = `\ufeff${lines.join('\r\n')}`;
    downloadFile(content, 'debug-tabel.csv', 'text/csv;charset=utf-8');
  }, [canDownloadDebugTable, formatCsvAmountCell, model]);

  return (
    <Box>
      <ContentBox className="content-box">
        <Typography className="section-header">Debug tabel</Typography>

        {snapshot ? (
          <>
            <StandardDisplayTable
              useSmallFont
              columns={[
                { header: 'Interval', align: 'left', width: 520 },
                { header: 'Fra', align: 'center', width: 180 },
                { header: 'Til', align: 'center', width: 180 },
              ]}
              rows={summaryRows}
            />
            <Box className="row--label-right-hover">
              <Typography className="row--text">Download tabel (CSV-format)</Typography>
              <Box className="row--label-right-hover__content" sx={{ mr: '90px' }}>
                <Box
                  onClick={canDownloadDebugTable ? handleDownloadDebugTable : undefined}
                  tabIndex={-1}
                  sx={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: canDownloadDebugTable ? 'pointer' : 'default',
                    transition: 'background-color 0.2s',
                    '&:hover': canDownloadDebugTable ? { backgroundColor: '#e3f2fd' } : undefined,
                    '&:active': canDownloadDebugTable ? { backgroundColor: '#bbdefb' } : undefined,
                  }}
                >
                  <Download
                    sx={{
                      fontSize: '24px',
                      color: canDownloadDebugTable ? 'primary.main' : 'text.disabled',
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </>
        ) : (
          <Alert severity="info" sx={{ borderRadius: '10px' }}>
            <AlertTitle sx={{ fontWeight: 500 }}>Debug-tabellen er ikke opdateret endnu</AlertTitle>
            Snapshottet bygges automatisk ved første visit til fanen.
          </Alert>
        )}
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Sammentælling</Typography>

        <StandardDisplayTable
          useSmallFont
          columns={[
            { header: 'Enhed', align: 'left', width: 520 },
            { header: 'Beregnet', align: 'center', width: 160 },
            { header: 'Tabel', align: 'center', width: 160 },
            { header: 'Kontrol', align: 'center', width: 120 },
          ]}
          rows={sammentaellingTables.basis}
        />

        <StandardDisplayTable
          useSmallFont
          columns={[
            { header: 'Beregningsperiode', align: 'left', width: 520 },
            { header: 'Beregnet', align: 'center', width: 160 },
            { header: 'Tabel', align: 'center', width: 160 },
            { header: 'Kontrol', align: 'center', width: 120 },
          ]}
          rows={sammentaellingTables.beregningsperiode}
        />

        <StandardDisplayTable
          useSmallFont
          columns={[
            { header: 'TAF-periode', align: 'left', width: 520 },
            { header: 'Beregnet', align: 'center', width: 160 },
            { header: 'Tabel', align: 'center', width: 160 },
            { header: 'Kontrol', align: 'center', width: 120 },
          ]}
          rows={sammentaellingTables.taf}
        />

        <StandardDisplayTable
          useSmallFont
          columns={[
            { header: 'Enhed', align: 'left', width: 520 },
            { header: 'Beregnet', align: 'center', width: 160 },
            { header: 'Tabel', align: 'center', width: 160 },
            { header: 'Kontrol', align: 'center', width: 120 },
          ]}
          rows={sammentaellingTables.sfgg}
        />
      </ContentBox>

      <Box>
        {!snapshot ? null : model?.rowCount === 0 ? (
          <Alert severity="info" sx={{ borderRadius: '10px' }}>
            <AlertTitle sx={{ fontWeight: 500 }}>Kan ikke oprette debug-tabel</AlertTitle>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Der mangler dato-oplysninger til at oprette tidslinjen. Debug-tabellen kræver mindst én af følgende:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Stamdata:</strong> Skadedato
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Erstatningsopgørelse:</strong> Periode (fra/til)
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>TAF-perioder:</strong> Mindst én periode med fra/til-dato
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Svie/smerte-perioder:</strong> Mindst én periode med fra/til-dato
              </Typography>
            </Box>
          </Alert>
        ) : (
          <VirtualizedDisplayTable
            columns={tableColumns}
            headerRows={tableHeaderRows}
            rowCount={model!.rowCount}
            rowHeight={ROW_HEIGHT}
            height={0}
            getRowKey={model!.getRowKey}
            renderCell={renderCell}
            useSmallFont
            scrollMode="ancestor"
            stickyHeader
            stickyHeaderTop={stickyHeaderTop}
          />
        )}
      </Box>
    </Box>
  );
});

EODebugTabel.displayName = 'EODebugTabel';

export default EODebugTabel;
