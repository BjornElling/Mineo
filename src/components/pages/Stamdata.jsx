import React from 'react';
import { Box, Typography, MenuItem } from '@mui/material';

// Importer dato-konfiguration
import { MIN_SKADESDATO, TODAY } from '../../config/dateRanges';
// Importer centrale komponenter
import ContentBox from '../common/ContentBox';
import StyledTextField from '../inputs/StyledTextField';
import StyledDropdown from '../inputs/StyledDropdown';
import StyledDateField from '../inputs/StyledDateField';

// Skadestype-valgmuligheder
const skadestyper = ['Arbejdsulykke', 'Erhvervssygdom'];

// Field Label-komponent
const FieldLabel = ({ children }) => (
  <Typography className="field-label">
    {children}
  </Typography>
);

// Section Header-komponent
const SectionHeader = ({ children }) => (
  <Typography className="section-header" component="div">
    {children}
  </Typography>
);

/**
 * Stamdata-komponent til sagsinformation og skadelidtes detaljer
 *
 * Indeholder journalnummer, sagsansvarlige, skadelidtes navn, skadestype og dato.
 * Dato-feltets label skifter automatisk mellem 'Skadesdato' og 'Anmeldelsesdato'
 * baseret på valgt skadestype.
 */
const Stamdata = React.memo(() => {
  // State for alle felter
  const [journalnr, setJournalnr] = React.useState('');
  const [advokat, setAdvokat] = React.useState('');
  const [sagsbehandler, setSagsbehandler] = React.useState('');
  const [skadelidte, setSkadelidte] = React.useState('');
  const [skadestype, setSkadestype] = React.useState('');
  const [skadesdato, setSkadesdato] = React.useState('');

  // Dynamisk dato-label baseret på skadestype
  const datoLabel = skadestype === 'Erhvervssygdom' ? 'Anmeldelsesdato' : 'Skadesdato';

  return (
    <Box>
        {/* Side-header */}
        <Typography variant="h4" className="page-title">
          Stamdata
        </Typography>

        {/* Sagsinfo sektion */}
        <ContentBox>
          <SectionHeader>Sagsinfo</SectionHeader>

          {/* Journalnummer */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <FieldLabel>Journalnr.:</FieldLabel>
            <StyledTextField
              value={journalnr}
              onChange={(e) => setJournalnr(e.target.value)}
              width={220}
            />
          </Box>

          {/* Advokat/Sagsbehandler */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <FieldLabel>Advokat/sagsbehandler:</FieldLabel>
            <StyledTextField
              value={advokat}
              onChange={(e) => setAdvokat(e.target.value)}
              placeholder="(init.)"
              width={80}
              sx={{
                '& input': { textAlign: 'center' },
              }}
            />
            <Typography
              className="body-text-secondary"
              sx={{
                margin: '0 8px',
              }}
            >
              /
            </Typography>
            <StyledTextField
              value={sagsbehandler}
              onChange={(e) => setSagsbehandler(e.target.value)}
              placeholder="(init.)"
              width={80}
              sx={{
                '& input': { textAlign: 'center' },
              }}
            />
          </Box>
        </ContentBox>

        {/* Skadelidte sektion */}
        <ContentBox>
          <SectionHeader>Skadelidte</SectionHeader>

          {/* Skadelidtes navn */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <FieldLabel>Skadelidtes navn:</FieldLabel>
            <StyledTextField
              value={skadelidte}
              onChange={(e) => setSkadelidte(e.target.value)}
              width={350}
            />
          </Box>

          {/* Skadestype */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <FieldLabel>Skadestype:</FieldLabel>
            <StyledDropdown
              value={skadestype}
              onChange={(e) => setSkadestype(e.target.value)}
              placeholder="Vælg skadestype"
              width={175}
            >
              {skadestyper.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </StyledDropdown>
          </Box>

          {/* Skadesdato / Anmeldelsesdato */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <FieldLabel>{datoLabel}:</FieldLabel>
            <StyledDateField
              value={skadesdato}
              onChange={(e) => setSkadesdato(e.target.value)}
              minDate={MIN_SKADESDATO}
              maxDate={TODAY}
            />
          </Box>
        </ContentBox>
      </Box>
  );
});

export default Stamdata;