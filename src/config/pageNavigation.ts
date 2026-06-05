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

import type { StorageKey } from './storageManifest';

/** Alle faste app-routes (uden for de persisterede domæne-sektioner). */
export const APP_ROUTES = {
  stamdata: '/stamdata',
  erstatningsopgoerelse: '/erstatningsopgoerelse',
  erhvervsevnetab: '/erhvervsevnetab',
  satser: '/satser',
  renteberegning: '/renteberegning',
  varigemen: '/varigemen',
  forsoergertab: '/forsoergertab',
  aarsloen: '/aarsloen',
} as const;

export type AppRoute = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];

/**
 * Route for en pageKey, hvis den har en egen route. `faellesAarsloen` returnerer
 * `null`, fordi den ikke har en selvstændig route (kalderen vælger kontekst-route).
 */
export const getRouteForPageKey = (pageKey: StorageKey): AppRoute | null => {
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
} as const satisfies Partial<Record<StorageKey, string>>;
