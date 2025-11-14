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

      {/* Program information */}
      <ContentBox>
        <SectionHeader>Programinformation</SectionHeader>

        <DataRow
          label="Version"
          value={VERSION}
        />
        <DataRow
          label="Build dato"
          value={formattertDato}
        />
      </ContentBox>

      {/* Beskrivelse */}
      <ContentBox>
        <SectionHeader>Beskrivelse</SectionHeader>

        <Typography className="field-label" sx={{ marginBottom: '16px' }}>
          MINEO er et beregningsprogram til arbejdsskadeområdet, udviklet til at hjælpe med
          erstatningsberegninger og håndtering af arbejdsskadesatser.
        </Typography>
      </ContentBox>
    </Box>
  );
});

Om.displayName = 'Om';

export default Om;
