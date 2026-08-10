import React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useDefaultDirectorySetting } from './useDefaultDirectorySetting';

/**
 * «Placering til gemte filer»-rækken på Indstillinger.
 *
 * Rækken har ÉN kilde til både navn og udseende: `location.kind`. Tidligere kom navnet fra
 * IndexedDB-metadata, mens kursivering og «Nulstil»-linket kom fra `settings.defaultDirectoryHandleId`
 * i localStorage — to lagre, der kan ryddes hver for sig, så rækken kunne vise standardens navn
 * stylet som et brugervalg. Se `defaultDirectoryLocation.ts`.
 */
const DefaultDirectoryRow = React.memo(() => {
  const { location, chooseDirectory, resetToDefault } = useDefaultDirectorySetting();

  // Kun `valgt` er en intakt brugervalgt mappe. `utilgaengelig` peger på skrivebordet præcis som
  // `standard` gør, og skal derfor se sådan ud — men beholder Nulstil, så det døde valg kan ryddes.
  const harValgtMappe = location?.kind === 'valgt';

  return (
    <Box className="row--label-right-hover">
      <Typography className="row--text">Placering til gemte filer</Typography>
      <Box className="row--label-right-hover__content">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            className="row--text"
            sx={{
              fontStyle: harValgtMappe ? 'normal' : 'italic',
              color: harValgtMappe ? 'text.primary' : 'text.secondary',
              minWidth: 120,
              textAlign: 'right',
            }}
          >
            {location === null ? 'Indlæser...' : location.displayName}
          </Typography>
          <Tooltip title="Vælg mappe">
            <IconButton
              type="button"
              onClick={chooseDirectory}
              // Kun et ikon som indhold; tooltippen giver ikke et varigt tilgængeligt navn.
              aria-label="Vælg mappe"
              /*
                Opt-in til Container'ens feltsekvens (§Implementeringsfrihed i
                `keyboard-navigation.md`): uden markøren er mappevalget kun tilgængeligt for musen,
                fordi CONTAINER_FOCUSABLE_SELECTOR bevidst kun medtager knapper, der beder om det.
                Aktivering med Enter/mellemrum følger af det native <button> — ingen egen keydown.
              */
              data-mineo-focusable-button="true"
              size="small"
              sx={{
                padding: 0.5,
                '&:hover': { backgroundColor: 'var(--color-hover)' },
              }}
            >
              <FolderOpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {location !== null && location.kind !== 'standard' && (
            <Tooltip title="Nulstil til skrivebord">
              {/*
                Var et <span> med onClick: klikbart for musen, men usynligt for tastatur og
                skærmlæser (ingen rolle, ingen fokus, ingen Enter/Space). Som <button> er handlingen
                tilgængelig ad alle veje. Den nulstillede styling bevarer det oprindelige udseende.
              */}
              <Typography
                component="button"
                type="button"
                onClick={resetToDefault}
                sx={{
                  font: 'inherit',
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  '&:hover': { color: 'primary.main' },
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                Nulstil
              </Typography>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );
});

DefaultDirectoryRow.displayName = 'DefaultDirectoryRow';

export default DefaultDirectoryRow;
