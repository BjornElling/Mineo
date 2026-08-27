import { createTheme } from '@mui/material';
import type { PaletteMode, Theme } from '@mui/material/styles';
import type { ResolvedThemeMode } from '../settings/appSettingsSchema';
import { CONTENT_SCALE_CSS_VARIABLE } from '../utils/uiScale';
import { MineoTooltipContent } from '../components/ui/MineoTooltipContent';

export type { ResolvedThemeMode };

// Tager `ResolvedThemeMode` og ikke `AppThemeMode`: brugerens valg kan være `'system'`, men et
// tema kan ikke males «som systemet». Oversættelsen sker ét sted (`resolveThemeMode`), og
// typegrænsen her gør det til en compilerfejl at sende valget udenom den.
const buildPalette = (mode: ResolvedThemeMode) => {
  if (mode === 'dark') {
    return {
      mode: 'dark' as PaletteMode,
      primary: {
        main: '#90caf9',
      },
      secondary: {
        main: '#f48fb1',
      },
      text: {
        primary: 'rgba(255, 255, 255, 0.87)',
        secondary: 'rgba(255, 255, 255, 0.6)',
      },
      background: {
        default: '#141414',
        paper: '#1e1e1e',
      },
    };
  }

  return {
    mode: 'light' as PaletteMode,
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
  };
};

export const buildTheme = (mode: ResolvedThemeMode): Theme =>
  createTheme({
    palette: buildPalette(mode),
    typography: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 14,
      allVariants: {
        color: `var(--mineo-color-mui-typography-default, ${
          mode === 'dark' ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)'
        })`,
      },
    },
    components: {
      MuiTooltip: {
        defaultProps: {
          // Slotten modtager den færdige title fra ALLE MUI-tooltips. Dermed kan callsites ikke
          // gøre boksens bredde afhængig af en lokalt valgt tekstombrydning.
          slots: { tooltip: MineoTooltipContent },
        },
        styleOverrides: {
          tooltip: {
            width: 'fit-content',
            maxWidth: '320px',
            textAlign: 'left',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'normal',
            '& .mineo-tooltip-line': {
              display: 'block',
              maxWidth: '100%',
            },
            // Tooltippen er portaleret uden for arbejdsfladens zoom-rod, men hører visuelt til det,
            // den forklarer. Uden dette står hjælpeteksten i 11 px ved siden af en brødtekst, der
            // er skaleret ned til 10,5 px – altså STØRRE end det, den beskriver – og boksen bliver
            // en tredjedel for bred. Zoom sættes på selve tooltipboksen og ikke på popper-roden:
            // roden bærer Poppers positionerings-`transform`, som zoom ellers ville gange med.
            // Poppers måling af popper-roden ser den zoomede størrelse, så ankeret forbliver rigtigt.
            // Sidemenuen overstyrer `--mineo-content-scale` på sin egen popper, fordi dens tooltips
            // hører til menuens skala.
            zoom: `var(${CONTENT_SCALE_CSS_VARIABLE}, 1)`,
          },
        },
      },
      MuiSnackbar: {
        styleOverrides: {
          root: {
            // Kvitteringen hører til den flade, den melder om. Zoom sættes på roden, fordi den
            // både bærer sin egen `position: fixed`-placering og sin centrerings-`transform`:
            // begge er relative til elementets eget koordinatsystem og følger derfor pænt med.
            zoom: `var(${CONTENT_SCALE_CSS_VARIABLE}, 1)`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            // Samme regel som tooltips: et dialogvindue er en del af den samme visuelle flade som
            // siden bag det og må ikke stå med større tekst end den. Zoom sættes på papiret, ikke
            // på containeren: papiret centreres af flexbox uden egne offsets, så zoom kun ændrer
            // dets størrelse. Backdroppen er en søskende og dækker fortsat hele vinduet.
            zoom: `var(${CONTENT_SCALE_CSS_VARIABLE}, 1)`,
          },
        },
      },
      MuiTypography: {
        defaultProps: {
          color: 'text.primary',
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '14px',
            fontWeight: 400,
            color: `var(--mineo-color-input-text, ${
              mode === 'dark' ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)'
            })`,
          },
          input: {
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '14px',
            fontWeight: 400,
            color: 'inherit',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '14px',
            fontWeight: 400,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableRipple: false,
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            color: 'inherit',
            fontWeight: 'inherit',
          },
        },
      },
    },
  });
