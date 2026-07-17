import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { AppSettingsProvider } from './contexts/AppSettingsContext';
import { RoutePathnameProvider } from './contexts/RoutePathnameProvider';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { useAppSettings } from './contexts/useAppSettings';
import { buildTheme } from './config/appTheme';
import {
  ProductionInputRuntimeProvider,
  useSettingsRevisionBridge,
  type InputRuntimeBinding,
} from './inputCore/react';

type PageComponent = React.ComponentType<Record<string, never>>;
type AppRoute = { path: string; component: PageComponent };

const routeModuleLoaders = {
  openEo: async () => import('./components/system/OpenEo'),
  stamdata: async () => import('./components/pages/Stamdata'),
  erstatningsopgoerelse: async () => import('./components/pages/Erstatningsopgoerelse'),
  erhvervsevnetab: async () => import('./components/pages/Erhvervsevnetab'),
  satser: async () => import('./components/pages/Satser'),
  renteberegning: async () => import('./components/pages/Renteberegning'),
  aarsloen: async () => import('./components/pages/Aarsloen'),
  varigeMen: async () => import('./components/pages/VarigeMen'),
  forsoergertab: async () => import('./components/pages/Forsoergertab'),
  indstillinger: async () => import('./components/pages/Indstillinger'),
  mineo: async () => import('./components/pages/Mineo'),
} satisfies Record<string, () => Promise<{ default: PageComponent }>>;

const lazyRoute = (loader: () => Promise<{ default: PageComponent }>) => React.lazy(loader);

const OpenEo = lazyRoute(routeModuleLoaders.openEo);
const Stamdata = lazyRoute(routeModuleLoaders.stamdata);
const Erstatningsopgoerelse = lazyRoute(routeModuleLoaders.erstatningsopgoerelse);
const Erhvervsevnetab = lazyRoute(routeModuleLoaders.erhvervsevnetab);
const Satser = lazyRoute(routeModuleLoaders.satser);
const Renteberegning = lazyRoute(routeModuleLoaders.renteberegning);
const Aarsloen = lazyRoute(routeModuleLoaders.aarsloen);
const VarigeMen = lazyRoute(routeModuleLoaders.varigeMen);
const Forsoergertab = lazyRoute(routeModuleLoaders.forsoergertab);
const Indstillinger = lazyRoute(routeModuleLoaders.indstillinger);
const Mineo = lazyRoute(routeModuleLoaders.mineo);

const preloadRouteModules = () => {
  void Promise.allSettled(Object.values(routeModuleLoaders).map((loadRouteModule) => loadRouteModule()));
};

const scheduleRouteModulePreload = () => {
  if ('requestIdleCallback' in window) {
    const idleCallbackId = window.requestIdleCallback(preloadRouteModules, { timeout: 2_000 });
    return () => {
      window.cancelIdleCallback(idleCallbackId);
    };
  }

  const timeoutId = globalThis.setTimeout(preloadRouteModules, 500);
  return () => {
    globalThis.clearTimeout(timeoutId);
  };
};

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

const ThemedApp = ({
  inputRuntimeBinding,
}: {
  inputRuntimeBinding: InputRuntimeBinding;
}) => {
  const { settings } = useAppSettings();
  const theme = React.useMemo(() => buildTheme(settings.themeMode), [settings.themeMode]);

  // Hold `EvaluationSourceToken` og det konkrete AppSettings-snapshot samlet (§3.4).
  useSettingsRevisionBridge(settings);

  React.useEffect(() => scheduleRouteModulePreload(), []);

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
          <ProductionInputRuntimeProvider binding={inputRuntimeBinding}>
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
          </ProductionInputRuntimeProvider>
        </RoutePathnameProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

/**
 * Hovedkomponent for Mineo applikationen
 */
function App({
  inputRuntimeBinding,
}: {
  inputRuntimeBinding: InputRuntimeBinding;
}) {
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
      <ThemedApp inputRuntimeBinding={inputRuntimeBinding} />
    </AppSettingsProvider>
  );
}

export default App;
