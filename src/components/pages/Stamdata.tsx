import React from 'react';
import { Box, CircularProgress, MenuItem, Typography } from '@mui/material';

import { dateRanges_skadelidteFodselsdato, dateRanges_stamdata } from '../../config/dateRanges';
import { useAppSettings } from '../../contexts/useAppSettings';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { skadestypeEnum, stamdataSchema } from '../../schemas/formSchemas';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { resolveStamdataDatoLabel } from '../../domain/policies';
import StyledDateField from '../inputs/StyledDateField';
import StyledDropdown from '../inputs/StyledDropdown';
import StyledTextField, { type StyledTextFieldValueCommitEvent } from '../inputs/StyledTextField';
import ContentBox from '../layout/ContentBox';
import SideTab from '../layout/SideTab';
const StamdataTestTab = React.lazy(async () => import('./StamdataTestTab'));

// Afled dropdown-valgmulighederne fra schemaets enum, så UI og validering aldrig kan komme ud af sync.
const SKADESTYPER = skadestypeEnum.options;

const Stamdata = React.memo(() => {
  const { settings } = useAppSettings();
  // Test-fanen er DEV-only: indstillingen kan kun slås til i udviklingsmiljøet, og
  // selve visningen er gated på import.meta.env.DEV, så en localStorage-værdi gemt
  // under en dev-session aldrig aktiverer fanen i en produktions-build.
  const showTestTab = import.meta.env.DEV && settings.showStamdataTestTab;
  const [activeTab, setActiveTab] = React.useState<'stamdata' | 'test'>('stamdata');

  // Hvis test-tab slås fra mens den er aktiv, skift tilbage til stamdata
  React.useEffect(() => {
    if (!showTestTab && activeTab === 'test') {
      setActiveTab('stamdata');
    }
  }, [showTestTab, activeTab]);

  const { values, setValues, setFieldValue } = usePersistedForm(stamdataSchema, 'stamdata', STAMDATA_INITIAL_VALUES);

  const reportSkadedatoError = useFormFieldErrorReporter('stamdata', 'skadedato', { severity: 'error', source: 'input' });
  const reportSkadelidteFodselsdatoError = useFormFieldErrorReporter('stamdata', 'skadelidteFodselsdato', { severity: 'error', source: 'input' });

  const handleInitialsChange = (field: 'advokat' | 'sagsbehandler') => (event: StyledTextFieldValueCommitEvent) => {
    const rawValue = String(event.target.value || '');
    const normalizedValue = rawValue.trim();
    setValues((prev) => ({ ...prev, [field]: normalizedValue }), { fieldPath: field });
  };

  const commitField = React.useCallback(
    <K extends keyof typeof values>(fieldName: K) =>
      (event: { target: { value: (typeof values)[K] } }) => {
        setFieldValue(fieldName, event.target.value);
      },
    [setFieldValue]
  );

  const datoLabel = React.useMemo(
    () => resolveStamdataDatoLabel(values),
    [values]
  );

  const dateRange = React.useMemo(() => ({
    min: dateRanges_stamdata.skadedato.min,
    max: dateRanges_stamdata.skadedato.max,
  }), []);

  return (
    <Box>
      <Typography className="page-title">Stamdata</Typography>

      {/* Indhold med test-tab i højre side */}
      <Box sx={{ position: 'relative' }}>
        {/* Test-tab (roteret 90° til højre, placeret ved højrekanten af ContentBox) */}
        {showTestTab && (
          <SideTab
            label="Test"
            active={activeTab === 'test'}
            onClick={() => setActiveTab('test')}
            top="-25px"
          />
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
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Journalnr.
              </Typography>
              <Box className="row--label-offset__content">
                <StyledTextField name="journalnr" value={values.journalnr ?? ''} onCommit={commitField('journalnr')} width={220} />
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Advokat/Sagsbehandler
              </Typography>
              <Box className="row--label-offset__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StyledTextField
                    name="advokat"
                    value={values.advokat ?? ''}
                    onCommit={handleInitialsChange('advokat')}
                    placeholder="(init.)"
                    width={80}
                    sx={{ '& input': { textAlign: 'center' } }}
                  />
                  <Typography className="row--text">/</Typography>
                  <StyledTextField
                    name="sagsbehandler"
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
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Skadelidtes navn
              </Typography>
              <Box className="row--label-offset__content">
                <StyledTextField name="skadelidte" value={values.skadelidte ?? ''} onCommit={commitField('skadelidte')} width={350} />
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Fødselsdato
              </Typography>
              <Box className="row--label-offset__content">
                <StyledDateField
                  name="skadelidteFodselsdato"
                  value={values.skadelidteFodselsdato}
                  onCommit={commitField('skadelidteFodselsdato')}
                  onFieldError={reportSkadelidteFodselsdatoError}
                  minDate={dateRanges_skadelidteFodselsdato.min}
                  maxDate={dateRanges_skadelidteFodselsdato.max}
                />
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                Skadestype
              </Typography>
              <Box className="row--label-offset__content">
                <StyledDropdown name="skadestype" value={values.skadestype} onChange={commitField('skadestype')} placeholder="Vælg skadestype" width={200}>
                  {SKADESTYPER.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </StyledDropdown>
              </Box>
            </Box>

            <Box className="row--label-offset">
              <Typography className="row--text" sx={{ minWidth: '250px' }}>
                {datoLabel}
              </Typography>
              <Box className="row--label-offset__content">
                <StyledDateField
                  name="skadedato"
                  value={values.skadedato}
                  onCommit={commitField('skadedato')}
                  onFieldError={reportSkadedatoError}
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
            <React.Suspense fallback={<CircularProgress />}>
              <StamdataTestTab />
            </React.Suspense>
          </Box>
        )}
      </Box>
    </Box>
  );
});

Stamdata.displayName = 'Stamdata';

export default Stamdata;
