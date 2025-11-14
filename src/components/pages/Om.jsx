import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../common/ContentBox';
import { VERSION, BUILD_DATE } from '../../config/version';

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
const DataRow = ({ label, value }) => {
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
          textAlign: 'right',
          marginLeft: '16px',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

/**
 * Om-komponent til visning af programinformation
 *
 * Viser information om MINEO programmet, herunder version og build-dato.
 * Indeholder også en tekstbeskrivelse af programmets formål og anvendelse.
 */
const Om = React.memo(() => {
  const buildDate = new Date(BUILD_DATE);
  const formattertDato = buildDate.toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <Box>
      {/* Side-header */}
      <Typography variant="h4" className="page-title">
        Om MINEO
      </Typography>

      {/* Programinformation */}
      <ContentBox>
        <SectionHeader>Programinformation</SectionHeader>

        <DataRow label="Version" value={VERSION} />
        <DataRow label="Build dato" value={formattertDato} />
      </ContentBox>

      {/* Beskrivelse */}
      <ContentBox>
        <SectionHeader>Beskrivelse</SectionHeader>

        {/* Afsnit 1: Generel introduktion */}
        <Typography className="field-label" sx={{ marginBottom: '16px' }}>
          MINEO er et højt specialiseret regneprogram til arbejdsskadesager. Det er udviklet til advokater, 
          sagsbehandlere og andre professionelle, der laver erstatningsopgørelser som led i deres arbejde.
        </Typography>

        {/* Afsnit 2: Licensinformation */}
        <Typography className="field-label" sx={{ marginBottom: '16px' }}>
          Det er gratis at benytte MINEO, og programmet er frigivet under MIT-licensen, hvilket indebærer, at:
        </Typography>

        {/* Punktopstilling med korrekt spacing */}
        <Box sx={{ marginLeft: '10px', marginBottom: '24px' }}>

          {/* Punkt 1 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '30px 1fr', marginBottom: '8px' }}>
            <Typography className="field-label">1)</Typography>
            <Typography className="field-label">
              Du kan bruge programmet frit, herunder også til kommercielle formål.
            </Typography>
          </Box>

          {/* Punkt 2 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '30px 1fr', marginBottom: '8px' }}>
            <Typography className="field-label">2)</Typography>
            <Typography className="field-label">
              Kildekoden er frit tilgængelig, og du må videreudvikle og lave egne udgaver af programmet.
            </Typography>
          </Box>

          {/* Punkt 3 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '30px 1fr' }}>
            <Typography className="field-label">3)</Typography>
            <Typography className="field-label">
              Programmet leveres "som det er", uden nogen former for garanti. 
            </Typography>
          </Box>

        </Box>

        {/* Afsnit 3: Ansvarsfraskrivelse (flyttet til sidst) */}
        <Typography className="field-label" sx={{ marginBottom: '0px' }}>
          Programmet forudsætter kendskab til erstatningsberegning. Ligesom din bil ikke forhindrer dig 
          i at køre galt, forhindrer MINEO dig ikke i at lave fejl. Det er dit eget ansvar at sikre, at de 
          beregninger du laver med MINEO, er korrekte og i overensstemmelse med gældende lovgivning og praksis.
        </Typography>

      </ContentBox>
    </Box>
  );
});

Om.displayName = 'Om';

export default Om;
