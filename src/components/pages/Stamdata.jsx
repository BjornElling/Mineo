import React from 'react';
import { Box, Typography, MenuItem } from '@mui/material';

// Importer dato-konfiguration
import { MIN_SKADESDATO, TODAY } from '../../config/dateRanges';
// Importer centrale komponenter
import ContentBox from '../common/ContentBox';
import FieldLabel from '../common/FieldLabel';
import SectionHeader from '../common/SectionHeader';
import StyledTextField from '../inputs/StyledTextField';
import StyledDropdown from '../inputs/StyledDropdown';
import StyledDateField from '../inputs/StyledDateField';
// Importer persistence hook
import { usePersistedForm } from '../../hooks/usePersistedForm';

// Skadestype-valgmuligheder
const skadestyper = ['Arbejdsulykke', 'Erhvervssygdom'];

/**
 * Stamdata-komponent til sagsinformation og skadelidtes detaljer
 *
 * Indeholder journalnummer, sagsansvarlige, skadelidtes navn, skadestype og dato.
 * Dato-feltets label skifter automatisk mellem 'Skadesdato' og 'Anmeldelsesdato'
 * baseret på valgt skadestype.
 */
const Stamdata = React.memo(() => {
  // Brug persisted form hook
  const { values, handleChange } = usePersistedForm('stamdata', {
    journalnr: '',
    advokat: '',
    sagsbehandler: '',
    skadelidte: '',
    skadestype: '',
    skadesdato: '',
  });

  // Dynamisk dato-label baseret på skadestype
  const datoLabel = values.skadestype === 'Erhvervssygdom' ? 'Anmeldelsesdato' : 'Skadesdato';

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
              value={values.journalnr}
              onChange={handleChange('journalnr')}
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
              value={values.advokat}
              onChange={handleChange('advokat')}
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
              value={values.sagsbehandler}
              onChange={handleChange('sagsbehandler')}
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
              value={values.skadelidte}
              onChange={handleChange('skadelidte')}
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
              value={values.skadestype}
              onChange={handleChange('skadestype')}
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
              value={values.skadesdato}
              onChange={handleChange('skadesdato')}
              minDate={MIN_SKADESDATO}
              maxDate={TODAY}
            />
          </Box>
        </ContentBox>
      </Box>
  );
});

export default Stamdata;