import React from 'react';
import { Box, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import StyledYearFieldNext from '../inputs/StyledYearFieldNext';
import { getSatserForYear, satserAngivAarYearBounds } from '../../data/regulationRates';
import { downloadSatserPdf } from '../../utils/pdf/pdfService';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { satserSchema } from '../../schemas/formSchemas';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import {
  canDownloadSatser,
  resolveSatserAargangErrorMessage,
  resolveSatserEffectiveAargang,
} from '../../domain/calculations';
import ContentBox from '../layout/ContentBox';
import { formatAsAmount, formatPercent } from '../../utils/formatUtils';

/**
 * Formaterer beløb til dansk format
 */
const formatKroner = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return `${formatAsAmount(value, 0)} kr.`;
};

/**
 * Formaterer beløb per enhed til dansk format
 */
const formatKronerPerEnhed = (value: number | null | undefined, enhed: string): string => {
  if (value === null || value === undefined) return '';
  return `${formatAsAmount(value, 0)} kr./${enhed}`;
};

/**
 * Formaterer procent til dansk format
 */
const formatProcent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return formatPercent(value);
};

/**
 * Række-komponent for label-værdi par
 */
interface DataRowProps {
  label: string;
  value: string | null | undefined;
  rightAlign?: boolean;
}

const DataRow: React.FC<DataRowProps> = ({ label, value, rightAlign = true }) => {
  // Skjul hele rækken hvis der ikke er nogen værdi
  if (!value) return null;

  return (
    <Box className="row--label-right">
      <Typography className="row--text">{label}:</Typography>
      <Typography
        className="row--text"
        sx={{
          textAlign: rightAlign ? 'right' : 'left',
          whiteSpace: 'pre-line',
          marginLeft: '16px',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

/**
 * Satser-komponent til visning af lovbestemte satser
 *
 * Indeholder information om relevante satser for erstatningsberegninger.
 */
const Satser = React.memo(() => {
  const MIN_SATSER_YEAR = satserAngivAarYearBounds.minYear;
  const MAX_SATSER_YEAR = satserAngivAarYearBounds.maxYear;

  const { values, setValues } = usePersistedForm(
    satserSchema,
    'satser',
    {
      aargang: MAX_SATSER_YEAR,
    }
  );

  const { getPersistedData } = useFormPersistence();
  const { settings } = useAppSettings();

  /**
   * Håndterer commit af årgangs-feltet (committed model value)
   */
  const handleYearCommit = React.useCallback(
    (e: { target: { value: number | undefined } }) => {
      setValues((prev) => ({ ...prev, aargang: e.target.value }));
    },
    [setValues]
  );

  // Opdater satser når årstal ændres og er gyldigt
  const effectiveYear = React.useMemo(
    () => resolveSatserEffectiveAargang(values, MIN_SATSER_YEAR, MAX_SATSER_YEAR),
    [MAX_SATSER_YEAR, MIN_SATSER_YEAR, values]
  );
  const yearErrorMessage = React.useMemo(
    () => resolveSatserAargangErrorMessage(values, MIN_SATSER_YEAR, MAX_SATSER_YEAR),
    [MAX_SATSER_YEAR, MIN_SATSER_YEAR, values]
  );
  const yearError = yearErrorMessage ? { message: yearErrorMessage } : undefined;
  const canDownload = React.useMemo(
    () => canDownloadSatser(values, MIN_SATSER_YEAR, MAX_SATSER_YEAR),
    [MAX_SATSER_YEAR, MIN_SATSER_YEAR, values]
  );

  const gyldigtAar = effectiveYear ?? MAX_SATSER_YEAR;
  const satser = React.useMemo(() => getSatserForYear(gyldigtAar), [gyldigtAar]);

  // Håndter download af PDF
  const handleDownloadPdf = React.useCallback(async () => {
    if (satser && gyldigtAar) {
      await downloadSatserPdf({
        year: gyldigtAar,
        satser,
        settings,
        persistedStamdata: getPersistedData('stamdata'),
      });
    }
  }, [satser, gyldigtAar, getPersistedData, settings]);

  return (
    <Box>
      {/* Side-header */}
      <Typography className="page-title">Arbejdsskadesatser {gyldigtAar}</Typography>

      {/* Årstal sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Årstal</Typography>

        {/* Angiv år */}
        <Box className="row--label-offset">
          <Typography className="row--text" width='200px'>Angiv år:</Typography>
          <Box className="row--label-offset__content">
            <StyledYearFieldNext
              value={values.aargang}
              onCommit={handleYearCommit}
              minYear={MIN_SATSER_YEAR}
              maxYear={MAX_SATSER_YEAR}
              width={80}
              externalError={yearError}
            />
          </Box>
          <Box sx={{ flex: 1 }} />
          {canDownload && (
            <Box
              onClick={handleDownloadPdf}
              tabIndex={-1}
              sx={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                '&:hover': {
                  backgroundColor: '#e3f2fd',
                },
                '&:active': {
                  backgroundColor: '#bbdefb',
                },
              }}
            >
              <Download
                sx={{
                  fontSize: '24px',
                  color: 'primary.main',
                }}
              />
            </Box>
          )}
        </Box>
      </ContentBox>

      {/* Erstatningsansvarsloven sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Erstatningsansvarsloven</Typography>

        <DataRow
          label="Godtgørelse for svie og smerte"
          value={satser ? formatKronerPerEnhed(satser.eal.svieSmertePrDag, 'sygedag') : ''}
        />
        <DataRow
          label="Maksimum for svie og smerte"
          value={satser ? formatKroner(satser.eal.svieSmerteMax) : ''}
        />
        <DataRow
          label="Maksimum for erhvervsevnetabserstatning"
          value={satser ? formatKroner(satser.eal.erhvervsevnetabMax) : ''}
        />
        <DataRow
          label="Vejledende udtalelse om erhvervsevnetab"
          value={satser ? formatKroner(satser.eal.vejledendeUdtalelse) : ''}
        />
      </ContentBox>

      {/* Arbejdsskadesikringsloven sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Arbejdsskadesikringsloven</Typography>

        <DataRow
          label="Godtgørelse for varige mén"
          value={satser ? formatKronerPerEnhed(satser.asl.varigeMenPrGrad, 'méngrad') : ''}
        />
        <DataRow
          label="Maksimum årsløn"
          value={satser ? formatKroner(satser.asl.aarsloenMax) : ''}
        />
        <DataRow
          label="Minimum årsløn"
          value={satser ? formatKroner(satser.asl.aarsloenMin) : ''}
        />
        <DataRow
          label="Minimum årsløn (skader før 1.7.2024)"
          value={satser ? formatKroner(satser.asl.aarsloenMinFoer2024) : ''}
        />
        <DataRow
          label="Minimum årsløn (skader fra 1.7.2024)"
          value={satser ? formatKroner(satser.asl.aarsloenMinFra2024) : ''}
        />
        <DataRow
          label="Overgangsbeløb"
          value={satser ? formatKroner(satser.asl.overgangsbelob) : ''}
        />
        <DataRow
          label="Reguleringsprocent for erhvervsevnetab"
          value={satser ? formatProcent(satser.asl.reguleringProcentErhvervsevnetab) : ''}
        />
        <DataRow
          label="Reguleringsprocent for erhvervsevnetab (før 2024)"
          value={satser ? formatProcent(satser.asl.reguleringProcentErhvervsevnetabFoer2024) : ''}
        />
        <DataRow
          label="Reguleringsprocent for erhvervsevnetab (fra 2024)"
          value={satser ? formatProcent(satser.asl.reguleringProcentErhvervsevnetabFra2024) : ''}
        />
      </ContentBox>

      {/* Diverse sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Diverse</Typography>

        <DataRow
          label="Beløbsgrænse for fri proces"
          value={
            satser
              ? `${formatKroner(satser.diverse.friProcesEnlig)} (enlig) / ${formatKroner(satser.diverse.friProcesSamlevende)} (samlevende)\n+ ${formatKroner(satser.diverse.friProcesBarn)} per barn under 18 år`
              : ''
          }
        />
        <DataRow
          label="Reguleringssats"
          value={satser ? formatProcent(satser.diverse.reguleringssats) : ''}
        />
      </ContentBox>

      {/* Referencer sektion */}
      <ContentBox className="content-box">
        <Typography className="section-header">Referencer</Typography>

        <DataRow
          label="Erstatningsansvarsloven"
          value={satser ? satser.referencer.ealReference : ''}
        />
        <DataRow
          label="Arbejdsskadesikringsloven"
          value={satser ? satser.referencer.aslReference : ''}
        />
        <DataRow
          label="Kapitalisering"
          value={satser ? satser.referencer.kapitalisering : ''}
        />
        <DataRow
          label="Kapitalisering (skade fra 1.1.2011)"
          value={satser ? satser.referencer.kapitaliseringSkadeFra2011 : ''}
        />
        <DataRow
          label="Kapitalisering (skade før 1.1.2011)"
          value={satser ? satser.referencer.kapitaliseringSkadeFoer2011 : ''}
        />
        <DataRow
          label="Kapitalisering (skade fra 1.7.2007)"
          value={satser ? satser.referencer.kapitaliseringSkadeFra2007 : ''}
        />
        <DataRow
          label="Kapitalisering (skade før 1.7.2007)"
          value={satser ? satser.referencer.kapitaliseringSkadeFoer2007 : ''}
        />
        <DataRow
          label="Fri proces"
          value={satser ? satser.referencer.friProcesReference : ''}
        />
        <DataRow
          label="Reguleringssatser"
          value={satser ? satser.referencer.reguleringssatsReference : ''}
        />
      </ContentBox>
    </Box>
  );
});

Satser.displayName = 'Satser';

export default Satser;


