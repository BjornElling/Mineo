import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { FormPersistenceProvider } from './contexts/FormPersistenceContext';
import { AppSettingsProvider } from './contexts/AppSettingsContext';
// Side-effect: registrerer EO-domænets cleanup/rollback hooks i det generiske registry
import './domain/erstatningsopgoerelse/eoCleanupRegistration';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/errors/ErrorBoundary';
import Stamdata from './components/pages/Stamdata';
import Erstatningsopgoerelse from './components/pages/Erstatningsopgoerelse';
import Erhvervsevnetab from './components/pages/Erhvervsevnetab';
import Satser from './components/pages/Satser';
import Renteberegning from './components/pages/Renteberegning';
import Aarsloen from './components/pages/Aarsloen';
import VarigeMen from './components/pages/VarigeMen';
import Forsoergertab from './components/pages/Forsoergertab';
import Indstillinger from './components/pages/Indstillinger';
import Mineo from './components/pages/Mineo';
import OpenEo from './components/pages/OpenEo';
import { useAppSettings } from './contexts/useAppSettings';

type PageComponent = React.ComponentType<Record<string, never>>;
type AppRoute = { path: string; component: PageComponent };

/**
 * MUI tema konfiguration
 *
 * VIGTIGT: Dette er den PRIMÆRE kilde til typografi og styling i MINEO.
 * CSS variabler i typography.css og layout.css er synkroniseret med disse værdier.
 * Alle MUI-komponent overrides skal defineres her - IKKE i CSS.
 */
const theme = createTheme({
  palette: {
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
  },
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 14,
    allVariants: {
      // Debug: farvemarkering af MUI-standard tekst (styres via `fontStyleColorDebug` / CSS variable).
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

/**
 * Route-konfiguration til MINEO applikationen
 *
 * Mapper stier til deres tilhørende page-komponenter
 */
const routes: AppRoute[] = [
  { path: '/open', component: OpenEo },
  { path: '/stamdata', component: Stamdata },
  { path: '/erstatningsopgoerelse', component: Erstatningsopgoerelse },
  { path: '/erhvervsevnetab', component: Erhvervsevnetab },
  { path: '/satser', component: Satser },
  { path: '/renteberegning', component: Renteberegning },
  { path: '/varigemen', component: VarigeMen },
  { path: '/forsoergertab', component: Forsoergertab },
  { path: '/aarsloen', component: Aarsloen },
  { path: '/indstillinger', component: Indstillinger },
  { path: '/mineo', component: Mineo },
];

/**
 * Generisk wrapper der lægger enhver page-komponent ind i MainLayout + ErrorBoundary
 *
 * @param {React.ComponentType} Component - Page-komponenten der skal wrappes
 * @returns {React.ComponentType} Wrapped komponent
 */
const createPageWrapper = (Component: PageComponent): PageComponent => {
  const WrappedPage: PageComponent = React.memo(() => (
    <MainLayout>
      <ErrorBoundary>
        <Component />
      </ErrorBoundary>
    </MainLayout>
  ));
  WrappedPage.displayName = `Page(${Component.displayName || Component.name || 'Component'})`;
  return WrappedPage;
};

const RootRedirect = () => {
  const { settings } = useAppSettings();

  // Bevidst UX-valg:
  // - Normal åbning af app/PWA går via root-route og styres af Mineo-toggle'en.
  // - Filindlæsning er et separat flow i MainLayout og ender altid på Stamdata.
  return <Navigate to={settings.defaultStartsideErStamdata ? '/stamdata' : '/mineo'} replace />;
};

/**
 * Hovedkomponent for MINEO applikationen
 */
function App() {
  // Håndter browser back/forward cache (bfcache) for at undgå React hook fejl
  React.useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // Hvis siden kommer fra bfcache, genindlæs den
      if (event.persisted) {
        window.location.reload();
      }
    };

    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // Memoisér page wrappers for at undgå at genoprette dem ved hver render
  const pageWrappers = React.useMemo(() => {
    return routes.map(({ path, component }) => ({
      path,
      element: createPageWrapper(component),
    }));
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <AppSettingsProvider>
        <BrowserRouter>
          <FormPersistenceProvider>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              {pageWrappers.map(({ path, element: PageWrapper }) => (
                <Route key={path} path={path} element={<PageWrapper />} />
              ))}
              <Route
                path="*"
                element={
                  <div style={{ padding: '40px' }}>
                    <h2>404 - Side ikke fundet</h2>
                    <p>URL: {window.location.pathname}</p>
                  </div>
                }
              />
            </Routes>
          </FormPersistenceProvider>
        </BrowserRouter>
      </AppSettingsProvider>
    </ThemeProvider>
  );
}

export default App;
