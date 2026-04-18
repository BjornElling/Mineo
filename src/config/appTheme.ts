import { createTheme } from '@mui/material';
import type { PaletteMode, Theme } from '@mui/material/styles';

export type AppThemeMode = 'light' | 'dark';

const buildPalette = (mode: AppThemeMode) => {
  if (mode === 'dark') {
    return {
      mode: 'dark' as PaletteMode,
      primary: {
        main: '#5a9fd4',
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

export const buildTheme = (mode: AppThemeMode): Theme =>
  createTheme({
    palette: buildPalette(mode),
    typography: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 14,
      allVariants: {
        color: 'var(--mineo-color-mui-typography-default, rgba(0, 0, 0, 0.87))',
      },
    },
    components: {
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
            color: 'var(--mineo-color-input-text, rgba(0, 0, 0, 0.87))',
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
