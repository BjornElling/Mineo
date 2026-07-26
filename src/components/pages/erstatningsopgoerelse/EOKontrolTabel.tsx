import * as React from 'react';
import { Alert, AlertTitle, Box, Typography } from '@mui/material';
import { Check, ErrorOutlined as ErrorOutline } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import ContentBox from '../../layout/ContentBox';
import {
  getSammentaellingControlStatus,
  type SammentaellingControl,
  type SammentaellingDisplayRow,
} from '../../../domain/erstatningsopgoerelse/control/eoControlMismatch';
import { CSV_DELIMITER, escapeCsvCell, normalizeCsvHeader, toCsvScalar } from '../../../domain/eoInspektion/csvUtils';
import { formatCurrency } from '../../../utils/formatUtils';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import { downloadFile } from '../../../utils/fileHelpers';
import { isAmountColumnId, parseEmploymentIndexFromColumnId } from '../../../domain/eoInspektion/eoInspektionLoenTypes';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import VirtualizedDisplayTable from '../../tables/VirtualizedDisplayTable';
import type { VirtualizedDisplayTableHeaderRow } from '../../tables/VirtualizedDisplayTable';
import type { EOInspektionSnapshot } from '../../../domain/eoInspektion/eoInspektionSnapshot';
import { resolveArbejdsstedDisplayName } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { resolveSkadeEllerAnmeldelsesdatoReference } from '../../../domain/erstatningsopgoerelse/helpers/eoDateReferenceText';

const ROW_HEIGHT = 28;

const resolveEmploymentHeaderTitle = (snapshot: EOInspektionSnapshot, employmentIndex: number): string =>
  resolveArbejdsstedDisplayName(
    snapshot.eoValues.loenindkomstAnsaettelsesforhold?.[employmentIndex]?.navnPaaArbejdssted,
    employmentIndex
  );

type EOKontrolTabelProps = {
  inspektionSnapshot?: EOInspektionSnapshot | null;
  isActive?: boolean;
};

const SNAPSHOT_INFO_DELAY_MS = 1_000;

const EOKontrolTabel = React.memo(({ inspektionSnapshot = null, isActive = false }: EOKontrolTabelProps) => {
  const theme = useTheme();
  const snapshot = inspektionSnapshot;
  const model = snapshot?.model ?? null;
  const stamdataDatoLabel = resolveSkadeEllerAnmeldelsesdatoReference(snapshot?.stamdataValues.skadestype).label;
  const [showPendingSnapshotInfo, setShowPendingSnapshotInfo] = React.useState(false);

  React.useEffect(() => {
    if (!isActive || snapshot) {
      setShowPendingSnapshotInfo(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowPendingSnapshotInfo(true);
    }, SNAPSHOT_INFO_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isActive, snapshot]);

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
          borderTop: '1px solid var(--color-table-border) !important',
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
        return <Check sx={{ color: 'var(--color-status-success)', fontSize: 20 }} />;
      }
      return <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />;
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
  const canDownloadKontrolTabel = Boolean(model?.tableFra && model?.tableTil);

  // Format\u00e9r en bel\u00f8bscelle til CSV fra den r\u00e5 numeriske model-v\u00e6rdi via den kanoniske
  // formatCurrency. Spejler model-kolonnens displayformat (0 \u2192 tom celle), s\u00e5 CSV-output
  // er identisk med tabellen uden at parse den allerede formaterede displaystreng.
  const formatCsvAmountCell = React.useCallback((rawValue: number | undefined): string => {
    if (rawValue === undefined || rawValue === 0) return '';
    return formatCurrency(rawValue);
  }, []);

  const handleDownloadKontrolTabel = React.useCallback(() => {
    if (!canDownloadKontrolTabel || !model) return;

    const headers = model.columns.map((column) => escapeCsvCell(normalizeCsvHeader(column.header)));
    const lines: string[] = [];
    lines.push(headers.join(CSV_DELIMITER));

    for (let rowIndex = 0; rowIndex < model.rowCount; rowIndex += 1) {
      const cells = model.columns.map((column) => {
        if (isAmountColumnId(column.id)) {
          const rawValues = model.columnRawValues.get(column.id);
          return escapeCsvCell(formatCsvAmountCell(rawValues?.[rowIndex]));
        }
        return escapeCsvCell(toCsvScalar(column.getCell(rowIndex)));
      });
      lines.push(cells.join(CSV_DELIMITER));
    }

    const content = `\ufeff${lines.join('\r\n')}`;
    downloadFile(content, 'kontroltabel.csv', 'text/csv;charset=utf-8');
  }, [canDownloadKontrolTabel, formatCsvAmountCell, model]);

  return (
    <Box>
      <ContentBox className="content-box">
        <Typography className="section-header">Kontroltabel</Typography>

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
                <DocumentDownloadButton
                  onClick={handleDownloadKontrolTabel}
                  disabled={!canDownloadKontrolTabel}
                  label="Download tabel (CSV-format)"
                />
              </Box>
            </Box>
          </>
        ) : showPendingSnapshotInfo ? (
          <Alert severity="info" sx={{ borderRadius: '10px' }}>
            <AlertTitle sx={{ fontWeight: 500 }}>Kontroltabellen er ikke opdateret endnu</AlertTitle>
            Snapshottet bygges automatisk ved første visit til fanen.
          </Alert>
        ) : null}
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
        {/* snapshot.model er non-optional på EOInspektionSnapshot; efter !snapshot-guarden
            er modellen derfor garanteret til stede, så ingen non-null-assertion er nødvendig. */}
        {!snapshot ? null : snapshot.model.rowCount === 0 ? (
          <Alert severity="info" sx={{ borderRadius: '10px' }}>
            <AlertTitle sx={{ fontWeight: 500 }}>Kan ikke oprette kontroltabel</AlertTitle>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Der mangler dato-oplysninger til at oprette tidslinjen. Kontroltabellen kræver mindst én af følgende:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Stamdata:</strong> {stamdataDatoLabel}
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
            rowCount={snapshot.model.rowCount}
            rowHeight={ROW_HEIGHT}
            height={0}
            getRowKey={snapshot.model.getRowKey}
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

EOKontrolTabel.displayName = 'EOKontrolTabel';

export default EOKontrolTabel;
