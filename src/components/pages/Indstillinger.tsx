import React from 'react';
import { Box, Checkbox, FormControlLabel, IconButton, MenuItem, Tooltip, Typography } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import StyledToggleSwitch from '../inputs/StyledToggleSwitch';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../inputs/StyledDropdown';
import type { CommitEvent } from '../inputs/fieldEvents';
import { useAppSettings } from '../../contexts/AppSettingsContext';
import ContentBox from '../layout/ContentBox';
import { getAlleLoenmodtagerOrg, getAlleArbejdsgiverOrg } from '../../data/overenskomstRates';
import { saveDefaultDirectoryHandle, deleteDefaultDirectoryHandle, getDirectoryDisplayInfo } from '../../utils/fileHandleStorage';
import { logInfo, logWarning } from '../../utils/logger';
import type { BrevhovedIndstillinger } from '../../settings/appSettingsSchema';

/**
 * Indstillinger-side
 *
 * Programindstillinger (device-lokale) – gemmes i localStorage og indgår ikke i `.eo` filer.
 *
 * IMPORTANT (trust-critical + persistence separation):
 * - Disse indstillinger er ikke en del af sagsdata.
 * - `.eo` filer må kun indeholde schema-valideret brugerinput fra FormPersistenceContext (sessionStorage).
 *
 * Refs:
 * - `src/contracts/app-settings.md`
 */
const Indstillinger = React.memo(() => {
  const { settings, updateSettings } = useAppSettings();

  // State for default directory display name
  const [directoryDisplayName, setDirectoryDisplayName] = React.useState<string>('Skrivebord (standard)');
  const [isLoadingDirectory, setIsLoadingDirectory] = React.useState(true);

  // Hent og vis nuværende standardplacering ved mount og når settings ændres
  // VIGTIGT: Bruger getDirectoryDisplayInfo (non-invasive) - IKKE resolveDefaultDirectoryHandle
  // da sidstnævnte kan trigge permission-requests
  React.useEffect(() => {
    const loadDirectoryInfo = async () => {
      setIsLoadingDirectory(true);
      try {
        // Hvis ingen brugervalgt placering, vis standard
        if (!settings.defaultDirectoryHandleId) {
          setDirectoryDisplayName('Skrivebord (standard)');
          return;
        }

        // Hent cached display-info UDEN permission-request
        const meta = await getDirectoryDisplayInfo();
        if (meta) {
          setDirectoryDisplayName(meta.displayName);
        } else {
          // Metadata ikke fundet - vis blot standard (ingen recovery, ingen warning)
          // UI er passiv observatør, ikke reparatør
          setDirectoryDisplayName('Skrivebord (standard)');
        }
      } catch {
        // Vis blot standard ved fejl - ingen logging, ingen recovery
        setDirectoryDisplayName('Skrivebord (standard)');
      } finally {
        setIsLoadingDirectory(false);
      }
    };
    loadDirectoryInfo();
  }, [settings.defaultDirectoryHandleId]);

  // Handler for at vælge ny standardplacering
  const handleChooseDirectory = React.useCallback(async () => {
    try {
      const showDirectoryPicker = window.showDirectoryPicker;
      if (!showDirectoryPicker) {
        logWarning('showDirectoryPicker ikke tilgængelig i denne browser');
        return;
      }

      // VIGTIGT: Fjernet mode: 'readwrite' for at undgå at browseren blokerer
      // special-mapper (Downloads, Desktop, OneDrive).
      // Write-permission requesteres først når filen faktisk gemmes.
      const directoryHandle = await showDirectoryPicker({
        startIn: 'desktop',
      });

      // Gem handle til IndexedDB - returnerer et unikt ID
      // VIGTIGT: ID'et kommer fra storage-laget, IKKE UI-laget
      const handleId = await saveDefaultDirectoryHandle(directoryHandle);

      // Opdater settings med det returnerede ID
      updateSettings({ defaultDirectoryHandleId: handleId });

      // Opdater display name
      setDirectoryDisplayName(directoryHandle.name);

      logInfo(`Standardplacering sat til: ${directoryHandle.name}`);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Bruger annullerede - ingen handling
        return;
      }
      logWarning('Fejl ved valg af standardplacering', {
        context: 'Indstillinger.handleChooseDirectory',
        data: { error: error.message },
      });
    }
  }, [updateSettings]);

  // Handler for at nulstille til standard (skrivebord)
  const handleResetDirectory = React.useCallback(async () => {
    try {
      // Slet handle fra IndexedDB
      await deleteDefaultDirectoryHandle();

      // Fjern ID fra settings
      updateSettings({ defaultDirectoryHandleId: undefined });

      // Opdater display
      setDirectoryDisplayName('Skrivebord (standard)');

      logInfo('Standardplacering nulstillet til skrivebord');
    } catch (error) {
      logWarning('Fejl ved nulstilling af standardplacering', { context: 'Indstillinger.handleResetDirectory' });
    }
  }, [updateSettings]);

  // Hent alle organisationer til overenskomst-dropdowns
  const alleLoenmodtagerOrg = React.useMemo(() => getAlleLoenmodtagerOrg(), []);
  const alleArbejdsgiverOrg = React.useMemo(() => getAlleArbejdsgiverOrg(), []);

  // Løn på helligdage options
  const loenPaaHelligdageOptions = React.useMemo(
    () => ['Almindelig løn', 'SH-udbetaling', 'Ingen'] as const,
    []
  );
  type LoenPaaHelligdageOption = (typeof loenPaaHelligdageOptions)[number];
  const isLoenPaaHelligdageOption = (value: string): value is LoenPaaHelligdageOption => {
    return (loenPaaHelligdageOptions as readonly string[]).includes(value);
  };

  const afsluttesMedOptions = React.useMemo(
    () => ['Bekræftet godkendt', 'Underskrift-linje'] as const,
    []
  );
  type AfsluttesMedOption = (typeof afsluttesMedOptions)[number];
  const isAfsluttesMedOption = (value: string): value is AfsluttesMedOption => {
    return (afsluttesMedOptions as readonly string[]).includes(value);
  };

  const resolvedAfsluttesMed = isAfsluttesMedOption(settings.erstatningsopgoerelseAfsluttesMed)
    ? settings.erstatningsopgoerelseAfsluttesMed
    : 'Bekræftet godkendt';

  React.useEffect(() => {
    if (settings.erstatningsopgoerelseAfsluttesMed !== resolvedAfsluttesMed) {
      updateSettings({ erstatningsopgoerelseAfsluttesMed: resolvedAfsluttesMed });
    }
  }, [resolvedAfsluttesMed, settings.erstatningsopgoerelseAfsluttesMed, updateSettings]);

  return (
    <Box>
      {/* Side-header */}
      <Typography className="page-title">Indstillinger</Typography>

      <ContentBox className="content-box">
        <Typography className="section-header">Standardværdier</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Fuld løn under ferie</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              checked={settings.defaultFuldLoenUnderFerie}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ defaultFuldLoenUnderFerie: e.target.value })}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Løn på helligdage</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              allowEmpty={false}
              value={settings.defaultLoenPaaHelligdage}
              onChange={(e: StyledDropdownChangeEvent<string>) => {
                if (isLoenPaaHelligdageOption(e.target.value)) {
                  updateSettings({ defaultLoenPaaHelligdage: e.target.value });
                }
              }}
              width={185}
            >
              {loenPaaHelligdageOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </StyledDropdown>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Overenskomstparter</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text">L:</Typography>
              <StyledDropdown
                value={settings.defaultOverenskomstLoenmodtager}
                onChange={(e: StyledDropdownChangeEvent<string>) => {
                  updateSettings({ defaultOverenskomstLoenmodtager: e.target.value });
                }}
                width={200}
                allowEmpty={false}
              >
                <MenuItem value="ALLE">Alle</MenuItem>
                {alleLoenmodtagerOrg.map((org) => (
                  <MenuItem key={org} value={org}>
                    {org}
                  </MenuItem>
                ))}
              </StyledDropdown>

              <Typography className="row--text">A:</Typography>
              <StyledDropdown
                value={settings.defaultOverenskomstArbejdsgiver}
                onChange={(e: StyledDropdownChangeEvent<string>) => {
                  updateSettings({ defaultOverenskomstArbejdsgiver: e.target.value });
                }}
                width={200}
                allowEmpty={false}
              >
                <MenuItem value="ALLE">Alle</MenuItem>
                {alleArbejdsgiverOrg.map((org) => (
                  <MenuItem key={org} value={org}>
                    {org}
                  </MenuItem>
                ))}
              </StyledDropdown>
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Opgørelse afsluttes med</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              allowEmpty={false}
              value={resolvedAfsluttesMed}
              onChange={(e) => {
                if (isAfsluttesMedOption(e.target.value)) {
                  updateSettings({ erstatningsopgoerelseAfsluttesMed: e.target.value });
                }
              }}
              width={220}
            >
              {afsluttesMedOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </StyledDropdown>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Placering til gemte filer</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                className="row--text"
                sx={{
                  fontStyle: settings.defaultDirectoryHandleId ? 'normal' : 'italic',
                  color: settings.defaultDirectoryHandleId ? 'text.primary' : 'text.secondary',
                  minWidth: 120,
                  textAlign: 'right',
                }}
              >
                {isLoadingDirectory ? 'Indlæser...' : directoryDisplayName}
              </Typography>
              <Tooltip title="Vælg mappe">
                <IconButton
                  onClick={handleChooseDirectory}
                  size="small"
                  sx={{
                    padding: 0.5,
                    '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                  }}
                >
                  <FolderOpenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {settings.defaultDirectoryHandleId && (
                <Tooltip title="Nulstil til skrivebord">
                  <Typography
                    component="span"
                    onClick={handleResetDirectory}
                    sx={{
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    Nulstil
                  </Typography>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>

        <Box className="row--label-right-hover" sx={{ alignItems: 'flex-start' }}>
          <Typography className="row--text">Indsæt brevhoved i</Typography>
          <Box className="row--label-right-hover__content">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }}>
              {/* Første række: Erstatningsopgørelse, SH-dage, Renteberegning */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {([
                  { key: 'erstatningsopgoerelse', label: 'Erstatningsopgørelse' },
                  { key: 'shDage', label: 'SH-dage' },
                  { key: 'renteberegning', label: 'Renteberegning' },
                ] as const).map(({ key, label }) => (
                  <FormControlLabel
                    key={key}
                    control={
                      <Checkbox
                        checked={settings.brevhovedIndstillinger[key]}
                        onChange={(e) => {
                          const newBrevhovedIndstillinger: BrevhovedIndstillinger = {
                            ...settings.brevhovedIndstillinger,
                            [key]: e.target.checked,
                          };
                          updateSettings({ brevhovedIndstillinger: newBrevhovedIndstillinger });
                        }}
                        size="small"
                      />
                    }
                    label={label}
                    sx={{
                      marginRight: 1,
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                ))}
              </Box>
              {/* Anden række: Regulering, Varige mén, Satser, Årslønsberegning */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {([
                  { key: 'regulering', label: 'Regulering' },
                  { key: 'varigeMen', label: 'Varige mén' },
                  { key: 'satser', label: 'Satser' },
                  { key: 'aarsloensberegning', label: 'Årslønsberegning' },
                ] as const).map(({ key, label }) => (
                  <FormControlLabel
                    key={key}
                    control={
                      <Checkbox
                        checked={settings.brevhovedIndstillinger[key]}
                        onChange={(e) => {
                          const newBrevhovedIndstillinger: BrevhovedIndstillinger = {
                            ...settings.brevhovedIndstillinger,
                            [key]: e.target.checked,
                          };
                          updateSettings({ brevhovedIndstillinger: newBrevhovedIndstillinger });
                        }}
                        size="small"
                      />
                    }
                    label={label}
                    sx={{
                      marginRight: 1,
                      '& .MuiFormControlLabel-label': {
                        fontSize: '0.875rem',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Beregningsteknisk</Typography>

        <Typography className="row--subheading">Erhvervsevnetab</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Endelig EET-afgørelse kan gøre tidligere udbetalt midl. EET til endeligt med tilbagevirkende kraft</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch checked disabled onCommit={() => {}} />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Tillad regulering med overenskomst, der ikke dækker hele perioden
          </Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch checked disabled onCommit={() => {}} />
          </Box>
        </Box>

      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Debug</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Vis knap til at rapportere fejl og forbedringsønsker på indholdsbokse</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              checked={settings.showContentBoxReportButton}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ showContentBoxReportButton: e.target.value })}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Vis debug-fane på Erstatningsopgørelse-side</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              checked={settings.showEODebugMenu}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ showEODebugMenu: e.target.value })}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Vis test-fane på Stamdata-tab</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              checked={settings.showStamdataTestTab}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ showStamdataTestTab: e.target.value })}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Farvemarkering af font-styles</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              checked={settings.fontStyleColorDebug}
              onCommit={(e: CommitEvent<boolean>) => updateSettings({ fontStyleColorDebug: e.target.value })}
            />
          </Box>
        </Box>

      </ContentBox>
    </Box>
  );
});

Indstillinger.displayName = 'Indstillinger';

export default Indstillinger;
