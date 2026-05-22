import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { FormPersistenceProvider } from './contexts/FormPersistenceContext';
import { AppSettingsProvider } from './contexts/AppSettingsContext';
import { RoutePathnameProvider } from './contexts/RoutePathnameProvider';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { useAppSettings } from './contexts/useAppSettings';
import { buildTheme } from './config/appTheme';

type PageComponent = React.ElementType<Record<string, never>>;
type AppRoute = { path: string; component: PageComponent };

const OpenEo = React.lazy(async () => import('./components/system/OpenEo'));
const Stamdata = React.lazy(async () => import('./components/pages/Stamdata'));
const Erstatningsopgoerelse = React.lazy(async () => import('./components/pages/Erstatningsopgoerelse'));
const Erhvervsevnetab = React.lazy(async () => import('./components/pages/Erhvervsevnetab'));
const Satser = React.lazy(async () => import('./components/pages/Satser'));
const Renteberegning = React.lazy(async () => import('./components/pages/Renteberegning'));
const Aarsloen = React.lazy(async () => import('./components/pages/Aarsloen'));
const VarigeMen = React.lazy(async () => import('./components/pages/VarigeMen'));
const Forsoergertab = React.lazy(async () => import('./components/pages/Forsoergertab'));
const Indstillinger = React.lazy(async () => import('./components/pages/Indstillinger'));
const Mineo = React.lazy(async () => import('./components/pages/Mineo'));

/**
 * Route-konfiguration til Mineo applikationen
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
        <React.Suspense fallback={null}>
          <Component />
        </React.Suspense>
      </ErrorBoundary>
    </MainLayout>
  ));
  WrappedPage.displayName = 'Page';
  return WrappedPage;
};

const RootRedirect = () => {
  const { settings } = useAppSettings();

  // Bevidst UX-valg:
  // - Normal åbning af app/PWA går via root-route og styres af Mineo-toggle'en.
  // - Filindlæsning er et separat flow i MainLayout og ender altid på Stamdata.
  return <Navigate to={settings.defaultStartsideErStamdata ? '/stamdata' : '/mineo'} replace />;
};

const ThemedApp = () => {
  const { settings } = useAppSettings();
  const theme = React.useMemo(() => buildTheme(settings.themeMode), [settings.themeMode]);

  // Memoisér page wrappers for at undgå at genoprette dem ved hver render
  const pageWrappers = React.useMemo(() => {
    return routes.map(({ path, component }) => ({
      path,
      element: createPageWrapper(component),
    }));
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <RoutePathnameProvider>
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
        </RoutePathnameProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

/**
 * Hovedkomponent for Mineo applikationen
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

  return (
    <AppSettingsProvider>
      <ThemedApp />
    </AppSettingsProvider>
  );
}

export default App;
