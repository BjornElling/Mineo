/**
 * Storage Manifest
 *
 * Centraliseret definition af alle sessionStorage keys brugt i Mineo.
 * Dette sikrer type-safety og forhindrer typos ved gem/hent operationer.
 *
 * Namespace-isolation: Alle keys får et variant-prefix (default `mineo`). MinProcesrente-
 * standalone-buildet kalder `setStorageNamespace('minprocesrente')` ved bootstrap — FØR
 * nogen storage-adgang sker — så de to varianter aldrig deler sessionStorage-keys, selv
 * hvis de en dag serveres fra samme origin (lokal dev, preview, sti-baseret deploy).
 * Mineo beholder de uændrede `mineo_*`-keys, så eksisterende data bevares.
 *
 * Keys resolveres dovent (ved access) via getters, fordi `setStorageNamespace` skal kunne
 * sættes på entrypoint-niveau efter dette modul er importeret.
 */

let storageNamespace = 'mineo';

/**
 * Sæt storage-namespace for hele app-varianten. Skal kaldes ÉN gang ved bootstrap,
 * før nogen sessionStorage-adgang. Idempotent for samme værdi.
 */
export const setStorageNamespace = (namespace: string): void => {
  storageNamespace = namespace;
};

export const getStorageNamespace = (): string => storageNamespace;

const ns = (suffix: string): string => `${storageNamespace}_${suffix}`;

/**
 * Suffix-mapping pr. domæne-sektion. De faktiske storage-keys bygges med namespace
 * via `getStorageKey` / `STORAGE_KEYS`-getterne nedenfor.
 */
const STORAGE_KEY_SUFFIXES = {
  stamdata: 'stamdata',
  satser: 'satser',
  aarsloen: 'aarsloen',
  faellesAarsloen: 'faellesAarsloen',
  renteberegning: 'renteberegning',
  varigemen: 'varigemen',
  forsoergertab: 'forsoergertab',
  erstatningsopgoerelse: 'erstatningsopgoerelse',
  erhvervsevnetab: 'erhvervsevnetab',
} as const;

const UI_STORAGE_KEY_SUFFIXES = {
  lastSavedFilename: 'ui_lastSavedFilename',
  lastSavedFilenameBasis: 'ui_lastSavedFilenameBasis',
  loentrinFinderOverlay: 'ui_loentrinFinderOverlay',
  eoOffentligeYdelserHelpers: 'ui_eoOffentligeYdelserHelpers',
  devtoolsLastSeenIssueId: 'ui_devtools_lastSeenIssueId',
  pendingOverlay: 'pendingOverlay',
  sideMenuExpanded: 'sideMenuExpanded',
} as const;

const ACTIVE_TAB_SUFFIX_PREFIX = 'ui_activeTab_';

const buildKeyMap = <T extends Record<string, string>>(suffixes: T): { readonly [K in keyof T]: string } => {
  const descriptors = {} as { [K in keyof T]: PropertyDescriptor };
  for (const name of Object.keys(suffixes) as (keyof T)[]) {
    descriptors[name] = {
      enumerable: true,
      get: () => ns(suffixes[name]),
    };
  }
  return Object.defineProperties({} as { [K in keyof T]: string }, descriptors);
};

/**
 * Alle gyldige domæne-storage keys. Hver property resolveres dovent med aktuelt namespace.
 * Mapping: pageKey → sessionStorage key (fx `mineo_renteberegning`).
 */
export const STORAGE_KEYS = buildKeyMap(STORAGE_KEY_SUFFIXES);

export const UI_STORAGE_KEYS = buildKeyMap(UI_STORAGE_KEY_SUFFIXES);

export const createActiveTabStorageKey = (pageId: string): string => ns(`${ACTIVE_TAB_SUFFIX_PREFIX}${pageId}`);

/**
 * Type-safe storage key type
 *
 * Bruges til at sikre at kun gyldige pageKeys kan bruges
 * i persistence-funktioner.
 */
export type StorageKey = keyof typeof STORAGE_KEY_SUFFIXES;

/**
 * Helper til at få sessionStorage key fra pageKey
 *
 * @param pageKey - Logisk side-nøgle (fx 'stamdata')
 * @returns SessionStorage key (fx 'mineo_stamdata')
 */
export const getStorageKey = (pageKey: StorageKey): string => {
  return STORAGE_KEYS[pageKey];
};

/**
 * Tjek om en sessionStorage key er en gyldig key for den aktive variant.
 *
 * Sættene bygges dynamisk fra aktuelt namespace, så `setStorageNamespace` virker
 * uanset import-rækkefølge.
 *
 * @param key - SessionStorage key at tjekke
 * @returns true hvis key er en kendt key for den aktive variant
 */
export const isValidStorageKey = (key: string): boolean => {
  const domainKeys = Object.values(STORAGE_KEYS) as string[];
  const uiKeys = Object.values(UI_STORAGE_KEYS) as string[];
  return domainKeys.includes(key)
    || uiKeys.includes(key)
    || key.startsWith(ns(ACTIVE_TAB_SUFFIX_PREFIX));
};
