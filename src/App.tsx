import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { AppSettingsProvider } from './contexts/AppSettingsContext';
import { RoutePathnameProvider } from './contexts/RoutePathnameProvider';
import MainLayout from './components/layout/MainLayout';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { useAppSettings } from './contexts/useAppSettings';
import { buildTheme } from './config/appTheme';
import {
  ALL_APP_PAGE_ROUTES,
  APP_ROUTES,
  APP_SYSTEM_PAGE_DEFINITIONS,
} from './config/pageNavigation';
import {
  ProductionInputRuntimeProvider,
  useSettingsRevisionBridge,
  type InputRuntimeBinding,
} from './inputCore/react';

type PageComponent = React.ComponentType<Record<string, never>>;

/**
 * Route → lazy-loader. Nøglen er selve pathen, og den valideres mod rute-inventaret i
 * `pageNavigation.ts` nedenfor — så en ny side ikke kan tilføjes her uden at være i
 * kataloget (eller omvendt).
 */
const routeModuleLoaders = {
  [APP_SYSTEM_PAGE_DEFINITIONS.openEo.route]: async () => import('./components/system/OpenEo'),
  [APP_ROUTES.stamdata]: async () => import('./components/pages/Stamdata'),
  [APP_ROUTES.erstatningsopgoerelse]: async () => import('./components/pages/Erstatningsopgoerelse'),
  [APP_ROUTES.erhvervsevnetab]: async () => import('./components/pages/Erhvervsevnetab'),
  [APP_ROUTES.satser]: async () => import('./components/pages/Satser'),
  [APP_ROUTES.renteberegning]: async () => import('./components/pages/Renteberegning'),
  [APP_ROUTES.aarsloen]: async () => import('./components/pages/Aarsloen'),
  [APP_ROUTES.varigemen]: async () => import('./components/pages/VarigeMen'),
  [APP_ROUTES.forsoergertab]: async () => import('./components/pages/Forsoergertab'),
  [APP_SYSTEM_PAGE_DEFINITIONS.indstillinger.route]: async () => import('./components/pages/Indstillinger'),
  [APP_SYSTEM_PAGE_DEFINITIONS.mineo.route]: async () => import('./components/pages/Mineo'),
} satisfies Record<string, () => Promise<{ default: PageComponent }>>;

/**
 * Rute-inventaret er ÉT sted (`pageNavigation.ts`). Denne guard fejler ved modulets import,
 * hvis de to lister driver fra hinanden — tidligere stod pathstrengene hardkodet her ved
 * siden af kataloget, uden at nogen test sammenlignede dem.
 */
const assertRouteInventoryMatchesCatalog = (): void => {
  const declared = new Set(Object.keys(routeModuleLoaders));
  const missing = ALL_APP_PAGE_ROUTES.filter((route) => !declared.has(route));
  const extra = [...declared].filter((route) => !ALL_APP_PAGE_ROUTES.includes(route));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `App-routes matcher ikke pageNavigation-kataloget. Mangler loader: [${missing.join(', ')}]. `
      + `Ukendt route: [${extra.join(', ')}].`
    );
  }
};

assertRouteInventoryMatchesCatalog();

/** Route → lazy page-komponent, afledt af det validerede inventar. */
const lazyPageByRoute: Readonly<Record<string, PageComponent>> = Object.freeze(
  Object.fromEntries(
    Object.entries(routeModuleLoaders).map(([route, loader]) => [route, React.lazy(loader)])
  )
);

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
 * App-shellen som ÉN layout-route.
 *
 * Tidligere byggede `createPageWrapper` en selvstændig `MainLayout`-wrapper pr. route (11
 * memoiserede wrapper-komponenter). Det er nu én `<Route element={<AppShell />}>` med
 * `<Outlet/>`, så layoutet er beskrevet ét sted i stedet for at blive gentaget pr. side.
 *
 * Præcisering, så en senere læser ikke tror der lå en remount-fejl: den gamle form
 * remountede IKKE shellen ved navigation. React reconciler samme komponenttype på tværs af
 * søskende-routes, så `MainLayout` (og dermed `Container`s focus-cache og MutationObserver)
 * blev bevaret i begge former — verificeret med en mount-tælling på begge varianter.
 * Gevinsten her er strukturel: ét autoritativt layout-/route-flow, ikke en adfærdsrettelse.
 *
 * `ErrorBoundary` og `Suspense` ligger inde i shellen, så en fejl eller en indlæsning i én
 * side ikke river layoutet med sig.
 */
const AppShell = () => (
  <MainLayout>
    <ErrorBoundary>
      <React.Suspense fallback={null}>
        <Outlet />
      </React.Suspense>
    </ErrorBoundary>
  </MainLayout>
);

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

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <RoutePathnameProvider>
          <ProductionInputRuntimeProvider binding={inputRuntimeBinding}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              {/* Alle sider bor under den ÉNE shell-route, så layoutet ikke remountes. */}
              <Route element={<AppShell />}>
                {ALL_APP_PAGE_ROUTES.map((route) => {
                  const Page = lazyPageByRoute[route]!;
                  return <Route key={route} path={route} element={<Page />} />;
                })}
              </Route>
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
