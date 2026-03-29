import React from 'react';
import { Box, MenuItem, Typography } from '@mui/material';

import { dateRanges_stamdata } from '../../config/dateRanges';
import { useAppSettings } from '../../contexts/useAppSettings';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { stamdataSchema } from '../../schemas/formSchemas';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { resolveStamdataDatoLabel } from '../../domain/policies';
import StyledDateField from '../inputs/StyledDateField';
import StyledDropdown from '../inputs/StyledDropdown';
import StyledTextField, { type StyledTextFieldValueCommitEvent } from '../inputs/StyledTextField';
import ContentBox from '../layout/ContentBox';
import StamdataDebugTab from './StamdataDebugTab';

const SKADESTYPER = ['Arbejdsulykke', 'Erhvervssygdom'] as const;

const Stamdata = React.memo(() => {
  const { settings } = useAppSettings();
  const showTestTab = settings.showStamdataTestTab;
  const [activeTab, setActiveTab] = React.useState<'stamdata' | 'test'>('stamdata');

  // Hvis test-tab slås fra mens den er aktiv, skift tilbage til stamdata
  React.useEffect(() => {
    if (!showTestTab && activeTab === 'test') {
      setActiveTab('stamdata');
    }
  }, [showTestTab, activeTab]);

  const { values, setValues, handleChange } = usePersistedForm(stamdataSchema, 'stamdata', STAMDATA_INITIAL_VALUES);

  const reportSkadesdatoError = useFormFieldErrorReporter('stamdata', 'skadesdato', { severity: 'error', source: 'input' });

  const handleInitialsChange = (field: 'advokat' | 'sagsbehandler') => (event: StyledTextFieldValueCommitEvent) => {
    const rawValue = String(event.target.value || '');
    const normalizedValue = rawValue.trim();
    setValues((prev) => ({ ...prev, [field]: normalizedValue }));
  };

  const datoLabel = React.useMemo(
    () => resolveStamdataDatoLabel(values),
    [values]
  );

  const dateRange = React.useMemo(() => ({
    min: dateRanges_stamdata.skadesdato.min,
    max: dateRanges_stamdata.skadesdato.max,
  }), []);

  return (
    <Box>
      <Typography className="page-title">Stamdata</Typography>

      {/* Indhold med test-tab i højre side */}
      <Box sx={{ position: 'relative' }}>
        {/* Test-tab (roteret 90° til højre, placeret ved højrekanten af ContentBox) */}
        {showTestTab && (
          <Box
            onClick={() => setActiveTab('test')}
            sx={{
              position: 'absolute',
              left: '1200px',
              top: '-25px',
              transform: 'rotate(90deg)',
              transformOrigin: 'left bottom',
              zIndex: 10,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 140,
              minHeight: 48,
              padding: '12px 16px',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              fontFamily: 'Montserrat, sans-serif',
              lineHeight: 1.25,
              letterSpacing: '0.02857em',
              color: activeTab === 'test' ? 'primary.main' : 'rgba(0, 0, 0, 0.6)',
              opacity: activeTab === 'test' ? 1 : 0.7,
              transition: 'color 0.2s, opacity 0.2s',
              backgroundColor: 'transparent',
              borderBottom: activeTab === 'test' ? '2px solid #1976d2' : '2px solid transparent',
              '&:hover': {
                opacity: 1,
              },
            }}
          >
            Test
          </Box>
        )}

        {/* Stamdata-indhold */}
        <Box
          role="tabpanel"
          hidden={activeTab !== 'stamdata'}
          sx={{ display: activeTab === 'stamdata' ? 'block' : 'none' }}
        >
          <ContentBox className="content-box" data-section-id="stamdata-sagsinfo">
            <Typography className="section-header">Sagsinfo</Typography>

            <Box className="row--label-offset">
              <Typography className="row--text" minWidth="250px">
                Journalnr.
              </Typography>
              <Box className="row--label-offset__content">
                <StyledTextField value={values.journalnr ?? ''} onCommit={handleChange('journalnr')} width={220} />
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" minWidth="250px">
                Advokat/Sagsbehandler
              </Typography>
              <Box className="row--label-offset__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StyledTextField
                    value={values.advokat ?? ''}
                    onCommit={handleInitialsChange('advokat')}
                    placeholder="(init.)"
                    width={80}
                    sx={{ '& input': { textAlign: 'center' } }}
                  />
                  <Typography className="row--text">/</Typography>
                  <StyledTextField
                    value={values.sagsbehandler ?? ''}
                    onCommit={handleInitialsChange('sagsbehandler')}
                    placeholder="(init.)"
                    width={80}
                    sx={{ '& input': { textAlign: 'center' } }}
                  />
                </Box>
              </Box>
            </Box>
          </ContentBox>

          <ContentBox className="content-box" data-section-id="stamdata-skadelidte">
            <Typography className="section-header">Skadelidte</Typography>

            <Box className="row--label-offset">
              <Typography className="row--text" minWidth="250px">
                Skadelidtes navn
              </Typography>
              <Box className="row--label-offset__content">
                <StyledTextField value={values.skadelidte ?? ''} onCommit={handleChange('skadelidte')} width={350} />
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" minWidth="250px">
                Skadestype
              </Typography>
              <Box className="row--label-offset__content">
                <StyledDropdown value={values.skadestype} onChange={handleChange('skadestype')} placeholder="Vælg skadestype" width={200}>
                  {SKADESTYPER.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </StyledDropdown>
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" minWidth="250px">
                {datoLabel}
              </Typography>
              <Box className="row--label-offset__content">
                <StyledDateField
                  value={values.skadesdato}
                  onCommit={handleChange('skadesdato')}
                  onFieldError={reportSkadesdatoError}
                  minDate={dateRange.min}
                  maxDate={dateRange.max}
                />
              </Box>
            </Box>
          </ContentBox>
        </Box>

        {/* Test-indhold */}
        {showTestTab && (
          <Box
            role="tabpanel"
            hidden={activeTab !== 'test'}
            sx={{ display: activeTab === 'test' ? 'block' : 'none' }}
          >
            <StamdataDebugTab />
          </Box>
        )}
      </Box>
    </Box>
  );
});

Stamdata.displayName = 'Stamdata';

export default Stamdata;
