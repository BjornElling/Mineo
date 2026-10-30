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
import { buildKontrolTabelCsv, KONTROLTABEL_CSV_TITEL } from '../../../domain/eoInspektion/eoInspektionCsv';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import { downloadFile } from '../../../utils/fileHelpers';
import { parseEmploymentIndexFromColumnId } from '../../../domain/eoInspektion/eoInspektionLoenTypes';
import { resolveSagsFilnavn } from '../../../document/documentFileName';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import VirtualizedDisplayTable from '../../tables/VirtualizedDisplayTable';
import type { VirtualizedDisplayTableHeaderRow } from '../../tables/VirtualizedDisplayTable';
import type { EOInspektionSnapshot } from '../../../domain/eoInspektion/eoInspektionSnapshot';
import { resolveAnsaettelsesforholdNavn } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';

const ROW_HEIGHT = 28;

/**
 * Tabellen dannes af sagens perioder, og listen nævner præcis de seks kilder, modellen læser
 * (`eoInspektionKontrolModel.ts`, `sources`). Før stod skadedatoen på listen, selv om tabellen ikke bygges af den,
 * og tre af de virksomme veje manglede (BB-380).
 */
const INGEN_PERIODER_TEKST =
  'Kontroltabellen dannes af sagens perioder. Udfyld mindst én af: «Vedrører perioden», beregningsperioden, en TAF- '
  + 'eller svie/smerte-periode, lønindkomst eller offentlige ydelser.';

const resolveEmploymentHeaderTitle = (snapshot: EOInspektionSnapshot, employmentIndex: number): string =>
  resolveAnsaettelsesforholdNavn(
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
      cells: ['Sagens første og sidste dato', formatIso(model.combinedMinFra), formatIso(model.combinedMaxTil)],
      rowSx: {
        '& .MuiTableCell-root': {
          borderTop: '1px solid var(--color-table-border) !important',
        },
      },
    });

    rows.push({
      key: 'table-range',
      cells: [
        'Tabellen viser (hele måneder)',
        <Box key="fra" component="span" sx={{ fontWeight: 600 }}>
          {formatIso(model.summaryTableFra)}
        </Box>,
        <Box key="til" component="span" sx={{ fontWeight: 600 }}>
          {formatIso(model.summaryTableTil)}
        </Box>,
      ],
    });

    // TAF's afskæringer står under perioderne, så det er synligt, hvilken regel TAF-dagskolonnen håndhæver – også
    // når en EET-dato netop IKKE afslutter TAF (skade fra 16-06-2011 eller verserende klage).
    model.tafAfskaering.forEach((afskaering, index) => {
      rows.push({
        key: `taf-afskaering:${afskaering.label}`,
        cells: [afskaering.label, formatIso(afskaering.dato), '-'],
        rowSx: index === 0
          ? { '& .MuiTableCell-root': { borderTop: '1px solid var(--color-table-border) !important' } }
          : undefined,
      });
    });

    return rows;
  }, [formatIso, model]);

  const sammentaellingTables = React.useMemo(() => {
    const renderControl = (control: SammentaellingControl): React.ReactElement | null => {
      switch (getSammentaellingControlStatus(control)) {
        case 'ok':
          return <Check sx={{ color: 'var(--color-status-success)', fontSize: 20 }} />;
        case 'error':
          return <ErrorOutline sx={{ color: 'var(--color-status-error)', fontSize: 20 }} />;
        case 'tom':
          // Intet er kontrolleret; et grønt ✓ ville påstå det modsatte (BB-386).
          return null;
      }
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

  /**
   * Tabelhovedet klæber til `Container`s scrollport og skal kompensere for containerens egen
   * øverste luft (`theme.spacing(3)` = 24 px) plus to px overlap.
   *
   * Værdien er uskaleret med vilje: tabellen lever inde i arbejdsfladens zoom-rod, så tallet
   * ganges med skalaen af browseren – og `Container`s luft skaleres med den SAMME faktor
   * (`calc(24px * var(--mineo-content-scale, 1))`). Kompensationen rammer derfor plet ved enhver
   * skala. Gøres containerens lodrette luft en dag fast igen, holder den kobling op med at
   * gælde, og hovedet vil klæbe forkert overalt undtagen ved fuld skala.
   */
  const stickyHeaderTop = React.useMemo(() => -Number.parseFloat(theme.spacing(3)) - 2, [theme]);
  // Samme betingelse som tom-tilstanden nedenfor: knappen og forklaringen kan ikke være uenige om, hvorvidt der
  // er en tabel.
  const canDownloadKontrolTabel = Boolean(model && model.rowCount > 0);

  const handleDownloadKontrolTabel = React.useCallback(() => {
    if (!canDownloadKontrolTabel || !snapshot) return;
    downloadFile(
      buildKontrolTabelCsv(snapshot.model, (employmentIndex) => resolveEmploymentHeaderTitle(snapshot, employmentIndex)),
      resolveSagsFilnavn(KONTROLTABEL_CSV_TITEL, 'csv', snapshot.stamdataValues.journalnr),
      'text/csv;charset=utf-8'
    );
  }, [canDownloadKontrolTabel, snapshot]);

  const renderSammentaellingTable = (firstHeader: string, rows: readonly StandardDisplayTableRow[]): React.ReactNode =>
    // En gruppe uden rækker står ikke som en tom overskrift, der ligner noget, der ikke er indlæst (BB-386).
    rows.length === 0 ? null : (
      <StandardDisplayTable
        useSmallFont
        columns={[
          { header: firstHeader, align: 'left', width: 520 },
          { header: 'Beregnet', align: 'center', width: 160 },
          { header: 'Tabel', align: 'center', width: 160 },
          { header: 'Kontrol', align: 'center', width: 120 },
        ]}
        rows={rows}
      />
    );

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
            {/* Forklaringen står her, hvor knappen er grå – før stod den nederst under to tabeller med `-` (BB-380). */}
            {snapshot.model.rowCount === 0 && (
              <Alert severity="info" sx={{ borderRadius: '10px', mt: 1 }}>
                {INGEN_PERIODER_TEKST}
              </Alert>
            )}
            <Box className="row--label-right-hover">
              <Typography className="row--text">Download tabel (CSV-format)</Typography>
              <Box className="row--label-right-hover__content" sx={{ mr: '90px' }}>
                <DocumentDownloadButton
                  onClick={handleDownloadKontrolTabel}
                  disabled={!canDownloadKontrolTabel}
                  disabledReason="Der er ingen perioder at vise"
                  label="Download tabel (CSV-format)"
                />
              </Box>
            </Box>
          </>
        ) : showPendingSnapshotInfo ? (
          // Tilstanden opstår kun, når beregningen er stoppet, og den forsvinder først, når fejlen er rettet. Teksten
          // lovede før, at «snapshottet bygges automatisk ved første visit» (BB-389). Samme tekst som EO-kontrol.
          <Alert severity="info" sx={{ borderRadius: '10px' }}>
            <AlertTitle sx={{ fontWeight: 500 }}>Kontroltabellen kan ikke vises, fordi beregningen er stoppet</AlertTitle>
            Se «Fejl og advarsler» under Beregning.
          </Alert>
        ) : null}
      </ContentBox>

      {/* Uden kontrolgrundlag er der intet at tælle sammen; tomme tabeller ville ligne noget, der ikke er indlæst. */}
      {snapshot && (
        <ContentBox className="content-box">
          <Typography className="section-header">Sammentælling</Typography>
          {renderSammentaellingTable('Enhed', sammentaellingTables.basis)}
          {renderSammentaellingTable('Beregningsperiode', sammentaellingTables.beregningsperiode)}
          {renderSammentaellingTable('TAF-periode', sammentaellingTables.taf)}
          {/* Beløbsgruppen hed også «Enhed» som dagtællingerne øverst; to ens overskrifter over forskellige størrelser. */}
          {renderSammentaellingTable('Beløb', sammentaellingTables.sfgg)}
        </ContentBox>
      )}

      <Box>
        {/* snapshot.model er non-optional på EOInspektionSnapshot; efter !snapshot-guarden
            er modellen derfor garanteret til stede, så ingen non-null-assertion er nødvendig. */}
        {!snapshot || snapshot.model.rowCount === 0 ? null : (
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
