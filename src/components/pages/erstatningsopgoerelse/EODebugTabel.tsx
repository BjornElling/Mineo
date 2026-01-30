import * as React from 'react';
import { Alert, AlertTitle, Box, Tooltip, Typography } from '@mui/material';
import { Check, Download, ErrorOutline, WarningAmber } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import ContentBox from '../../layout/ContentBox';

import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { buildEODebugModel } from '../../../domain/debug/eoDebugModel';
import { buildEODebugSammentaellingModel } from '../../../domain/debug/eoDebugSammentaelling';
import type { SammentaellingControl } from '../../../domain/debug/eoDebugSammentaelling';
import { CSV_DELIMITER, escapeCsvCell, normalizeCsvHeader, toCsvScalar } from '../../../domain/debug/eoDebugCsv';
import { formatCurrency, parseAmount } from '../../../utils/formatUtils';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { ISODateString } from '../../../types/branded';
import { isoToDanish, subtractOneDay } from '../../../types/branded';
import { downloadFile } from '../../../utils/fileHelpers';
import { useFormPersistence } from '../../../contexts/FormPersistenceContext';
import { useFormFieldErrorsBySource } from '../../../hooks/useFormFieldErrors';
import StandardDisplayTable from '../../tables/StandardDisplayTable';
import type { StandardDisplayTableRow } from '../../tables/StandardDisplayTable';
import VirtualizedDisplayTable from '../../tables/VirtualizedDisplayTable';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

const ROW_HEIGHT = 28;

const isAmountColumnId = (id: string): boolean => id.startsWith('offentlig:') || id.includes(':wage:');

const isDanishNumberString = (value: string): boolean => {
  if (value.trim() === '') return false;
  return /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(value) || /^-?\d+(,\d+)?$/.test(value);
};

const EODebugTabel = React.memo(() => {
  const theme = useTheme();
  const { getPersistedData } = useFormPersistence();

  const stamdataValues = React.useMemo(() => {
    return { ...STAMDATA_INITIAL_VALUES, ...(getPersistedData('stamdata') ?? {}) };
  }, [getPersistedData]);

  const erstatningsopgoerelseValues = React.useMemo<ErstatningsopgoerelseValues>(() => {
    return { ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES, ...(getPersistedData('erstatningsopgoerelse') ?? {}) };
  }, [getPersistedData]);

  const erstatningsopgoerelseFieldErrors = useFormFieldErrorsBySource('erstatningsopgoerelse');

  const deferredStamdata = React.useDeferredValue(stamdataValues);
  const deferredEO = React.useDeferredValue(erstatningsopgoerelseValues);

  const svieSmerteContext = React.useMemo(() => {
    const erErhvervssygdom = deferredStamdata.skadestype === 'Erhvervssygdom';
    const menAfgoerelseDatoForTabel =
      deferredEO.varigeMenAfgorelse === 'Ja' ? subtractOneDay(deferredEO.menAfgoerelseDato) : undefined;
    const verserendeKlageMen = deferredEO.verserendeKlageMen === 'Ja';

    return {
      skadesdatoISO: deferredStamdata.skadesdato,
      erErhvervssygdom,
      menAfgoerelseDatoForTabel,
      verserendeKlageMen,
    };
  }, [
    deferredStamdata.skadesdato,
    deferredStamdata.skadestype,
    deferredEO.menAfgoerelseDato,
    deferredEO.varigeMenAfgorelse,
    deferredEO.verserendeKlageMen,
  ]);

  const taftContext = React.useMemo(() => {
    const erErhvervssygdom = deferredStamdata.skadestype === 'Erhvervssygdom';
    const endeligEETBeregnetDato =
      deferredEO.endeligtEetAfgorelse === 'Ja'
        ? deferredEO.endeligEETVirkningsdato || deferredEO.endeligEETAfgoerelseDato
        : undefined;
    const verserendeKlageEet = deferredEO.verserendeKlageEet === 'Ja';

    return {
      skadesdatoISO: deferredStamdata.skadesdato,
      erErhvervssygdom,
      endeligEETBeregnetDato,
      differencekravDato: deferredEO.differencekravDato,
      verserendeKlageEet,
    };
  }, [
    deferredStamdata.skadesdato,
    deferredStamdata.skadestype,
    deferredEO.differencekravDato,
    deferredEO.endeligEETAfgoerelseDato,
    deferredEO.endeligEETVirkningsdato,
    deferredEO.endeligtEetAfgorelse,
    deferredEO.verserendeKlageEet,
  ]);

  const model = React.useMemo(() => buildEODebugModel(deferredEO), [deferredEO]);
  const sammentaelling = React.useMemo(
    () =>
      buildEODebugSammentaellingModel({
        values: deferredEO,
        errors: erstatningsopgoerelseFieldErrors,
        model,
        svieSmerteContext,
        taftContext,
      }),
    [deferredEO, erstatningsopgoerelseFieldErrors, model, svieSmerteContext, taftContext]
  );

  const formatIso = React.useCallback((iso: ISODateString | undefined): string => {
    if (!iso) return '-';
    return isoToDanish(iso) ?? '-';
  }, []);

  const summaryRows = React.useMemo(() => {
    const rows: StandardDisplayTableRow[] = model.sources.map((s) => ({
      key: s.label,
      cells: [s.label, formatIso(s.fra), formatIso(s.til)],
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
  }, [
    formatIso,
    model.combinedMaxTil,
    model.combinedMinFra,
    model.sources,
    model.summaryTableFra,
    model.summaryTableTil,
  ]);

  const sammentaellingRows = React.useMemo((): StandardDisplayTableRow[] => {
    const rows: StandardDisplayTableRow[] = [];

    const formatDaValue = (value: number): string => value.toLocaleString('da-DK');

    const getWarningTooltipText = (tabel: number, lose: number, oevrige: number, beregnet: number): string => {
      return `${formatDaValue(tabel)} - ${formatDaValue(lose)} løse feriedage - ${formatDaValue(oevrige)} øvrige fraværsdage = ${formatDaValue(beregnet)}`;
    };

    const renderControl = (control: SammentaellingControl): React.ReactElement => {
      if (control.beregnetDisplay === control.tabelDisplay) {
        return <Check sx={{ color: 'green', fontSize: 20 }} />;
      }

      if (
        control.warningEligible &&
        control.beregnetValue !== null &&
        control.tabelValue !== null &&
        control.beregnetValue !== control.tabelValue &&
        control.tabelValue - control.loseFeriedage - control.oevrigeFravaersdage === control.beregnetValue
      ) {
        return (
          <Tooltip
            title={getWarningTooltipText(
              control.tabelValue,
              control.loseFeriedage,
              control.oevrigeFravaersdage,
              control.beregnetValue
            )}
          >
            <WarningAmber sx={{ color: 'orange', fontSize: 20 }} />
          </Tooltip>
        );
      }

      return <ErrorOutline sx={{ color: 'red', fontSize: 20 }} />;
    };

    const { beregningsperiode, taf, svieSmerteSygedage, svieSmerteDelvise, loenindkomst, offentligeYdelser } =
      sammentaelling;

    rows.push({
      key: 'arbejdsdage-beregning',
      cells: [
        'Arbejdsdage i beregningsperiode',
        beregningsperiode.beregnetDisplay,
        beregningsperiode.tabelDisplay,
        renderControl(beregningsperiode),
      ],
    });

    rows.push({
      key: 'arbejdsdage-taf',
      cells: [
        'Arbejdsdage i TAF-periode',
        taf.beregnetDisplay,
        taf.tabelDisplay,
        renderControl(taf),
      ],
    });

    rows.push({
      key: 'svie-smerte-sygedage',
      cells: [
        'Svie/smerte, sygedage',
        svieSmerteSygedage.beregnetDisplay,
        svieSmerteSygedage.tabelDisplay,
        renderControl(svieSmerteSygedage),
      ],
    });

    rows.push({
      key: 'svie-smerte-delvise',
      cells: [
        'Svie/smerte, delvise sygedage',
        svieSmerteDelvise.beregnetDisplay,
        svieSmerteDelvise.tabelDisplay,
        renderControl(svieSmerteDelvise),
      ],
    });

    const ekstraRows = [...loenindkomst, ...offentligeYdelser];
    ekstraRows.forEach((entry, index) => {
      rows.push({
        key: entry.key,
        cells: [
          entry.label,
          entry.control.beregnetDisplay,
          entry.control.tabelDisplay,
          renderControl(entry.control),
        ],
        rowSx:
          index === 0
            ? {
                '& .MuiTableCell-root': {
                  borderTop: '1px solid #e5e7eb !important',
                },
              }
            : undefined,
      });
    });

    return rows;
  }, [sammentaelling]);

  const tableColumns = React.useMemo(() => {
    return model.columns.map((c) => ({
      id: c.id,
      header: c.header,
      align: c.align,
      width: c.width,
      borderLeft: c.borderLeft,
    }));
  }, [model.columns]);

  const renderCell = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      const col = model.columns[colIndex];
      return col ? col.getCell(rowIndex) : '';
    },
    [model.columns]
  );

  const stickyHeaderTop = React.useMemo(() => -Number.parseFloat(theme.spacing(3)), [theme]);
  const canDownloadDebugTable = Boolean(model.tableFra && model.tableTil);

  const formatCsvAmountCell = React.useCallback((value: unknown): string => {
    const scalar = toCsvScalar(value);
    const trimmed = scalar.trim();
    if (trimmed === '') return '';
    if (!isDanishNumberString(trimmed)) return scalar;
    const parsed = parseAmount(trimmed);
    if (!Number.isFinite(parsed)) return scalar;
    return formatCurrency(parsed);
  }, []);

  const handleDownloadDebugTable = React.useCallback(() => {
    if (!canDownloadDebugTable) return;

    const headers = model.columns.map((col) => escapeCsvCell(normalizeCsvHeader(col.header)));
    const lines: string[] = [];
    lines.push(headers.join(CSV_DELIMITER));

    for (let rowIndex = 0; rowIndex < model.rowCount; rowIndex += 1) {
      const cells = model.columns.map((col) => {
        const cellValue = col.getCell(rowIndex);
        const scalar = isAmountColumnId(col.id) ? formatCsvAmountCell(cellValue) : toCsvScalar(cellValue);
        return escapeCsvCell(scalar);
      });
      lines.push(cells.join(CSV_DELIMITER));
    }

    const content = `\ufeff${lines.join('\r\n')}`;
    downloadFile(content, 'debug-tabel.csv', 'text/csv;charset=utf-8');
  }, [canDownloadDebugTable, formatCsvAmountCell, model.columns, model.rowCount]);

  return (
    <Box>
      <ContentBox className="content-box">
        <Typography className="section-header">Debug tabel</Typography>

        <StandardDisplayTable
          useSmallFont
          columns={[
            { header: 'Interval', align: 'left', width: 520 },
            { header: 'Fra', align: 'center', width: 180 },
            { header: 'Til', align: 'center', width: 180 },
          ]}
          rows={summaryRows}
          containerSx={{ mb: 2 }}
        />
        <Box className="row--label-right-hover" sx={{ mt: 2 }}>
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
          rows={sammentaellingRows}
        />
      </ContentBox>

      <Box sx={{ mt: 2 }}>
        {model.rowCount === 0 ? (
          <Alert severity="info" sx={{ borderRadius: '10px' }}>
            <AlertTitle sx={{ fontWeight: 500 }}>Kan ikke oprette debug-tabel</AlertTitle>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Der mangler dato-oplysninger til at oprette tidslinjen. Debug-tabellen kræver mindst én af følgende:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                <strong>Stamdata:</strong> Skadesdato
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
            rowCount={model.rowCount}
            rowHeight={ROW_HEIGHT}
            height={0}
            getRowKey={model.getRowKey}
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
