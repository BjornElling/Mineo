import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../common/ContentBox';
import StyledToggleSwitch from '../inputs/StyledToggleSwitch';
import StyledRadioButton from '../inputs/StyledRadioButton';
import StyledWeekField from '../inputs/StyledWeekField';
import { MIN_YEAR, MAX_YEAR } from '../../config/dateRanges';

/**
 * Indstillinger-side
 *
 * Viser programindstillinger med toggle switches
 */
const Indstillinger = React.memo(() => {
  const [settings, setSettings] = React.useState({
    darkMode: false,
    notifications: true,
    autoSave: true,
    advancedMode: false,
  });

  const [language, setLanguage] = React.useState('dansk');
  const [dateFormat, setDateFormat] = React.useState('dd-mm-åååå');
  const [testWeek, setTestWeek] = React.useState('');

  const handleToggle = (setting) => (event) => {
    setSettings({
      ...settings,
      [setting]: event.target.checked,
    });
  };

  const handleLanguageChange = (event) => {
    setLanguage(event.target.value);
  };

  const handleDateFormatChange = (event) => {
    setDateFormat(event.target.value);
  };

  const handleWeekChange = (event) => {
    setTestWeek(event.target.value);
  };

  return (
    <Box>
      <ContentBox>
        <Typography variant="h5" sx={{ fontFamily: 'Ubuntu', fontWeight: 500, marginBottom: 3 }}>
          Indstillinger
        </Typography>

        {/* Indstillinger med toggle switches */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Dark Mode */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 2,
            borderRadius: '10px',
            '&:hover': { backgroundColor: '#f5f5f5' },
          }}>
            <Box>
              <Typography sx={{ fontFamily: 'Ubuntu', fontWeight: 500, fontSize: '14px' }}>
                Mørk tilstand
              </Typography>
              <Typography sx={{ fontFamily: 'Ubuntu', fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
                Skift til mørkt tema for bedre læsning om aftenen
              </Typography>
            </Box>
            <StyledToggleSwitch
              checked={settings.darkMode}
              onChange={handleToggle('darkMode')}
            />
          </Box>

          {/* Notifikationer */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 2,
            borderRadius: '10px',
            '&:hover': { backgroundColor: '#f5f5f5' },
          }}>
            <Box>
              <Typography sx={{ fontFamily: 'Ubuntu', fontWeight: 500, fontSize: '14px' }}>
                Notifikationer
              </Typography>
              <Typography sx={{ fontFamily: 'Ubuntu', fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
                Vis beskeder om gemte filer og advarsler
              </Typography>
            </Box>
            <StyledToggleSwitch
              checked={settings.notifications}
              onChange={handleToggle('notifications')}
            />
          </Box>

          {/* Auto-gem */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 2,
            borderRadius: '10px',
            '&:hover': { backgroundColor: '#f5f5f5' },
          }}>
            <Box>
              <Typography sx={{ fontFamily: 'Ubuntu', fontWeight: 500, fontSize: '14px' }}>
                Automatisk gem
              </Typography>
              <Typography sx={{ fontFamily: 'Ubuntu', fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
                Gem automatisk hvert 5. minut
              </Typography>
            </Box>
            <StyledToggleSwitch
              checked={settings.autoSave}
              onChange={handleToggle('autoSave')}
            />
          </Box>

          {/* Avanceret tilstand */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 2,
            borderRadius: '10px',
            '&:hover': { backgroundColor: '#f5f5f5' },
          }}>
            <Box>
              <Typography sx={{ fontFamily: 'Ubuntu', fontWeight: 500, fontSize: '14px' }}>
                Avanceret tilstand
              </Typography>
              <Typography sx={{ fontFamily: 'Ubuntu', fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
                Vis ekstra felter og funktioner for erfarne brugere
              </Typography>
            </Box>
            <StyledToggleSwitch
              checked={settings.advancedMode}
              onChange={handleToggle('advancedMode')}
            />
          </Box>

        </Box>

        {/* Radio button eksempler */}
        <Box sx={{ marginTop: 4 }}>
          <Typography variant="h6" sx={{ fontFamily: 'Ubuntu', fontWeight: 500, marginBottom: 3 }}>
            Præferencer
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Sprogvalg */}
            <Box sx={{ padding: 2, borderRadius: '10px', backgroundColor: '#f9f9f9' }}>
              <StyledRadioButton
                label="Sprog"
                value={language}
                onChange={handleLanguageChange}
                options={[
                  { value: 'dansk', label: 'Dansk' },
                  { value: 'engelsk', label: 'Engelsk' },
                  { value: 'tysk', label: 'Tysk' },
                ]}
              />
            </Box>

            {/* Datoformat */}
            <Box sx={{ padding: 2, borderRadius: '10px', backgroundColor: '#f9f9f9' }}>
              <StyledRadioButton
                label="Datoformat"
                value={dateFormat}
                onChange={handleDateFormatChange}
                row={true}
                options={[
                  { value: 'dd-mm-åååå', label: 'DD-MM-ÅÅÅÅ' },
                  { value: 'mm-dd-åååå', label: 'MM-DD-ÅÅÅÅ' },
                  { value: 'åååå-mm-dd', label: 'ÅÅÅÅ-MM-DD' },
                ]}
              />
            </Box>
          </Box>
        </Box>

        {/* Test af StyledWeekField */}
        <Box sx={{ marginTop: 4 }}>
          <Typography variant="h6" sx={{ fontFamily: 'Ubuntu', fontWeight: 500, marginBottom: 3 }}>
            Test: Uge-felt
          </Typography>

          <Box sx={{ padding: 2, borderRadius: '10px', backgroundColor: '#f9f9f9' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography
                sx={{
                  fontFamily: 'Ubuntu',
                  fontSize: '14px',
                  minWidth: '150px',
                  color: 'rgba(0, 0, 0, 0.87)'
                }}
              >
                Indtast uge:
              </Typography>
              <StyledWeekField
                value={testWeek}
                onChange={handleWeekChange}
                minYear={MIN_YEAR}
                maxYear={MAX_YEAR}
                width={150}
              />
              <Typography
                sx={{
                  fontFamily: 'Ubuntu',
                  fontSize: '12px',
                  color: 'rgba(0, 0, 0, 0.6)',
                  fontStyle: 'italic'
                }}
              >
                Værdi: {testWeek || '(tom)'}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontFamily: 'Ubuntu',
                fontSize: '12px',
                color: 'rgba(0, 0, 0, 0.6)',
                marginTop: 2
              }}
            >
              Test funktioner: År-fortolkning (1-4 cifre), ISO 8601 validering (52/53 uger), auto-formatering til uu/åååå
            </Typography>
          </Box>
        </Box>

      </ContentBox>
    </Box>
  );
});

Indstillinger.displayName = 'Indstillinger';

export default Indstillinger;
