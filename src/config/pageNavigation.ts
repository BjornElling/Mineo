/**
 * Kanonisk kilde for "hvilken route og hvilken standard-fane hører en side til".
 *
 * Før dette modul var route-oversættelsen spredt ud i tre ad hoc-varianter:
 *   - saveBlockedFocus.getRouteForBlockingError (`/${pageKey}` + særtilfælde)
 *   - useUndoRedo.routeToPageId (rå regex-strip af '/')
 *   - hardkodede route-strenge i domæne-lokale navigation-objekter
 * En ny side eller en omdøbt route skulle dermed rettes flere steder. Her er der ÉT sted.
 *
 * Bemærk: `faellesAarsloen` har bevidst INGEN egen route — det er en delt sektion der
 * renderes under enten Erhvervsevnetab eller Forsørgertab afhængigt af kontekst. Den
 * kontekst-afhængige rutning bevares hos kalderen; dette modul dækker kun det 1:1-mappbare.
 */

import type { PersistedSectionKey } from './persistenceRegistry';

/**
 * Autoritativ page-definition. Komponentfilen står sammen med routen, så arkitekturværnet ikke vedligeholder
 * et parallelt route→page-inventar, der kan drifte fra den faktiske navigation.
 */
export const APP_PAGE_DEFINITIONS = {
  stamdata: { route: '/stamdata', componentFile: 'Stamdata.tsx' },
  erstatningsopgoerelse: { route: '/erstatningsopgoerelse', componentFile: 'Erstatningsopgoerelse.tsx' },
  erhvervsevnetab: { route: '/erhvervsevnetab', componentFile: 'Erhvervsevnetab.tsx' },
  satser: { route: '/satser', componentFile: 'Satser.tsx' },
  renteberegning: { route: '/renteberegning', componentFile: 'Renteberegning.tsx' },
  varigemen: { route: '/varigemen', componentFile: 'VarigeMen.tsx' },
  forsoergertab: { route: '/forsoergertab', componentFile: 'Forsoergertab.tsx' },
  aarsloen: { route: '/aarsloen', componentFile: 'Aarsloen.tsx' },
} as const;

type RoutedPageKey = keyof typeof APP_PAGE_DEFINITIONS;

/** Alle faste app-routes, afledt af den autoritative page-definition. */
export const APP_ROUTES: Readonly<{ [K in RoutedPageKey]: (typeof APP_PAGE_DEFINITIONS)[K]['route'] }> =
  Object.freeze(Object.fromEntries(
    Object.entries(APP_PAGE_DEFINITIONS).map(([key, definition]) => [key, definition.route])
  )) as { [K in RoutedPageKey]: (typeof APP_PAGE_DEFINITIONS)[K]['route'] };

export type AppRoute = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];

/**
 * Route for en pageKey, hvis den har en egen route. `faellesAarsloen` returnerer
 * `null`, fordi den ikke har en selvstændig route (kalderen vælger kontekst-route).
 */
export const getRouteForPageKey = (pageKey: PersistedSectionKey): AppRoute | null => {
  if (pageKey === 'faellesAarsloen') return null;
  return APP_ROUTES[pageKey];
};

/**
 * Omvendt opslag: route (fx '/erstatningsopgoerelse') → pageId brugt af aktiv-fane-
 * registret. Ukendte/tomme routes falder tilbage til 'stamdata' (app-startsiden).
 */
export const routeToPageId = (route: string): string => {
  const normalized = route.replace(/^\/+/, '');
  return normalized === '' ? 'stamdata' : normalized;
};

/**
 * Standard-fane pr. side med faner. Bruges når en navigation lander på siden uden et
 * mere specifikt fane-mål. Sider uden faner mangler bevidst i kortet.
 */
export const PAGE_DEFAULT_TAB = {
  erstatningsopgoerelse: 'eo_oplysninger',
  erhvervsevnetab: 'eet-oplysninger',
  renteberegning: 'calculation',
  varigemen: 'menberegning',
} as const satisfies Partial<Record<PersistedSectionKey, string>>;

/**
 * De routes der IKKE svarer til en persisteret sagssektion.
 *
 * `APP_PAGE_DEFINITIONS` er bevidst nøglet på `PersistedSectionKey`, fordi den bærer
 * sektion↔route-oversættelsen for undo/redo-destinationer og feltlokationer. Disse tre sider
 * har ingen sagsdata og hører derfor ikke i det kort — men de ER stadig routes, og de skal
 * ikke stå hardkodet i `App.tsx` ved siden af.
 *
 * - `/open`: PWA-filåbnings-landingen (ikke i sidemenuen).
 * - `/indstillinger`: §2.2 systemside (device-lokale indstillinger, ikke sagsdata).
 * - `/mineo`: §2.3 informationsside.
 */
export const APP_SYSTEM_PAGE_DEFINITIONS = {
  openEo: { route: '/open', componentFile: 'OpenEo.tsx' },
  indstillinger: { route: '/indstillinger', componentFile: 'Indstillinger.tsx' },
  mineo: { route: '/mineo', componentFile: 'Mineo.tsx' },
} as const;

export type AppSystemPageKey = keyof typeof APP_SYSTEM_PAGE_DEFINITIONS;

/**
 * Samlet rute-inventar: sagssider + systemsider.
 *
 * `App.tsx` deriverer sine `<Route>`-elementer HERFRA i stedet for at gentage
 * pathstrengene. Før stod de 8 sagssider listet både her og i `App.tsx` (med hardkodede
 * strenge, uden at importere `APP_ROUTES`), mens de 3 systemsider kun fandtes i `App.tsx` —
 * altså to lister med to forskellige nøglebegreber, som kunne drifte fra hinanden uden at
 * nogen test bemærkede det.
 */
export const ALL_APP_PAGE_ROUTES: readonly string[] = Object.freeze([
  ...Object.values(APP_PAGE_DEFINITIONS).map((definition) => definition.route),
  ...Object.values(APP_SYSTEM_PAGE_DEFINITIONS).map((definition) => definition.route),
]);

/**
 * De sider sidemenuen kan navigere til — altså alle routes MINUS `/open`, som er PWA-
 * filåbnings-landingen og bevidst ikke står i menuen.
 *
 * Findes fordi sidemenuen indtil nu bar sit EGET inventar: `SideMenu.tsx` hardkodede de otte
 * sagssider og de to systemsider som bare strenge og importerede slet ikke dette modul. Det var
 * dermed en TREDJE liste ved siden af kataloget og `App.tsx` — den ene `App.tsx`-guarden ikke
 * kigger på — så en omdøbt route gav en lydløst død menupost i stedet for en fejl.
 *
 * Typen er værnet: menuens poster er nu nøglet på `MenuPageKey`, så en omdøbt eller slettet side
 * bliver en COMPILE-fejl i menuen. Det slår en AST-regel her, fordi grænsen kan udtrykkes som en
 * type — men bemærk dens loft: typen fanger drift i NØGLERNE, ikke at menuen faktisk viser alle
 * sider. Completeness dækkes derfor af `SideMenu.test.tsx`.
 */
export type MenuPageKey = RoutedPageKey | Exclude<AppSystemPageKey, 'openEo'>;

const MENU_PAGE_ROUTES: Readonly<Record<MenuPageKey, string>> = Object.freeze({
  ...APP_ROUTES,
  indstillinger: APP_SYSTEM_PAGE_DEFINITIONS.indstillinger.route,
  mineo: APP_SYSTEM_PAGE_DEFINITIONS.mineo.route,
});

/**
 * Route for en menuside. Erstatter `` `/${pageId}` ``-interpolationen i `MainLayout`, som var
 * selve mekanismen bag driften: den gjorde ENHVER streng til en gyldig "route".
 */
export const getRouteForMenuPageKey = (pageKey: MenuPageKey): string => MENU_PAGE_ROUTES[pageKey];
