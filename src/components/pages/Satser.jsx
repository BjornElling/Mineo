import React from 'react';
import { Box, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import ContentBox from '../common/ContentBox';
import StyledYearField from '../inputs/StyledYearField';
import { MIN_YEAR, MAX_YEAR } from '../../config/dateRanges';
import { getSatserForYear } from '../../data/regulationRates';
import { generateSatserPdf } from '../../utils/pdf/satserPdf';
import { usePersistedForm } from '../../hooks/usePersistedForm';

// Formaterings-funktioner
const formatKroner = (value) => {
  if (value === null || value === undefined || value === '') return '';
  return `${value.toLocaleString('da-DK').replace(/\./g, '.')} kr.`;
};

const formatKronerPerEnhed = (value, enhed) => {
  if (value === null || value === undefined || value === '') return '';
  return `${value.toLocaleString('da-DK').replace(/\./g, '.')} kr./${enhed}`;
};

const formatProcent = (value) => {
  if (value === null || value === undefined || value === '') return '';
  return `${value.toString().replace('.', ',')} %`;
};

// Section Header-komponent
const SectionHeader = ({ children }) => (
  <Typography className="section-header" component="div">
    {children}
  </Typography>
);

// Field Label-komponent
const FieldLabel = ({ children }) => (
  <Typography className="field-label">
    {children}
  </Typography>
);

// Række-komponent for label-værdi par
const DataRow = ({ label, value, rightAlign = true }) => {
  // Skjul hele rækken hvis der ikke er nogen værdi (men vis hvis værdien er 0)
  if (value === null || value === undefined || value === '') return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: '16px',
        justifyContent: 'space-between',
      }}
    >
      <FieldLabel>{label}:</FieldLabel>
      <Typography
        className="field-label"
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
  const { values, handleChange } = usePersistedForm('satser', {
    aar: MAX_YEAR.toString(),
  });

  const [satser, setSatser] = React.useState(() => getSatserForYear(MAX_YEAR));
  const [gyldigtAar, setGyldigtAar] = React.useState(MAX_YEAR);
  const [harFejl, setHarFejl] = React.useState(false);

  // Opdater satser når årstal ændres og er gyldigt
  React.useEffect(() => {
    if (values.aar.length === 4) {
      const year = parseInt(values.aar, 10);
      if (year >= MIN_YEAR && year <= MAX_YEAR) {
        const data = getSatserForYear(year);
        setSatser(data);
        setGyldigtAar(year);
      }
    }
  }, [values.aar]);

  // Håndter download af PDF
  const handleDownloadPdf = React.useCallback(() => {
    if (satser && gyldigtAar) {
      generateSatserPdf(gyldigtAar, satser);
    }
  }, [satser, gyldigtAar]);

  return (
    <Box>
      {/* Side-header */}
      <Typography variant="h4" className="page-title">
        Arbejdsskadesatser {gyldigtAar}
      </Typography>

      {/* Årstal sektion */}
      <ContentBox>
        <SectionHeader>Årstal</SectionHeader>

        {/* Angiv år */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            marginBottom: '16px',
          }}
        >
          <FieldLabel>Angiv år:</FieldLabel>
          <StyledYearField
            value={values.aar}
            onChange={handleChange('aar')}
            onErrorChange={setHarFejl}
            minYear={MIN_YEAR}
            maxYear={MAX_YEAR}
            width={80}
          />
          <Box sx={{ flex: 1 }} />
          {!harFejl && (
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
                  color: '#1976d2',
                }}
              />
            </Box>
          )}
        </Box>
      </ContentBox>

      {/* Erstatningsansvarsloven sektion */}
      <ContentBox>
        <SectionHeader>Erstatningsansvarsloven</SectionHeader>

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
      <ContentBox>
        <SectionHeader>Arbejdsskadesikringsloven</SectionHeader>

        <DataRow
          label="Godtgørelse for varige mén"
          value={satser ? formatKronerPerEnhed(satser.asl.varigeMenPrGrad, 'méngrad') : ''}
        />
        <DataRow
          label="Maksimum årsløn"
          value={satser ? formatKroner(satser.asl.aarslonMax) : ''}
        />
        <DataRow
          label="Minimum årsløn"
          value={satser ? formatKroner(satser.asl.aarslonMin) : ''}
        />
        <DataRow
          label="Minimum årsløn (skader før 1.7.2024)"
          value={satser ? formatKroner(satser.asl.aarslonMinFoer2024) : ''}
        />
        <DataRow
          label="Minimum årsløn (skader fra 1.7.2024)"
          value={satser ? formatKroner(satser.asl.aarslonMinFra2024) : ''}
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
      <ContentBox>
        <SectionHeader>Diverse</SectionHeader>

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
      <ContentBox>
        <SectionHeader>Referencer</SectionHeader>

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
