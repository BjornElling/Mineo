/**
 * Storage Manifest
 *
 * Centraliseret definition af alle sessionStorage keys brugt i MinEO.
 * Dette sikrer type-safety og forhindrer typos ved gem/hent operationer.
 */

/**
 * Alle gyldige storage keys i MinEO
 *
 * Hver side/modul har sin egen key til sessionStorage.
 * Mapping: pageKey → sessionStorage key
 */
export const STORAGE_KEYS = {
  stamdata: 'mineo_stamdata',
  satser: 'mineo_satser',
  aarsloen: 'mineo_aarsloen',
  faellesAarsloen: 'mineo_faellesAarsloen',
  renteberegning: 'mineo_renteberegning',
  varigemen: 'mineo_varigemen',
  forsoergertab: 'mineo_forsoergertab',
  erstatningsopgoerelse: 'mineo_erstatningsopgoerelse',
  erhvervsevnetab: 'mineo_erhvervsevnetab',
} as const;

export const LEGACY_DOMAIN_STORAGE_KEYS = {
  faellesPersondata: 'mineo_faellesPersondata',
} as const;

export const UI_STORAGE_KEYS = {
  lastSavedFilename: 'mineo_ui_lastSavedFilename',
  lastSavedFilenameBasis: 'mineo_ui_lastSavedFilenameBasis',
  loentrinFinderOverlay: 'mineo_ui_loentrinFinderOverlay',
  eoOffentligeYdelserHelpers: 'mineo_ui_eoOffentligeYdelserHelpers',
  devtoolsLastSeenIssueId: 'mineo_ui_devtools_lastSeenIssueId',
  pendingOverlay: 'mineo_pendingOverlay',
  sideMenuExpanded: 'mineo_sideMenuExpanded',
} as const;

const UI_STORAGE_PREFIXES = {
  activeTab: 'mineo_ui_activeTab_',
} as const;

export const createActiveTabStorageKey = (pageId: string): string => `${UI_STORAGE_PREFIXES.activeTab}${pageId}`;

const STORAGE_KEY_SET: ReadonlySet<string> = new Set([
  ...Object.values(STORAGE_KEYS),
  ...Object.values(LEGACY_DOMAIN_STORAGE_KEYS),
  ...Object.values(UI_STORAGE_KEYS),
]);

const DOMAIN_STORAGE_KEY_SET: ReadonlySet<string> = new Set([
  ...Object.values(STORAGE_KEYS),
  ...Object.values(LEGACY_DOMAIN_STORAGE_KEYS),
]);

/**
 * Type-safe storage key type
 *
 * Bruges til at sikre at kun gyldige pageKeys kan bruges
 * i persistence-funktioner.
 */
export type StorageKey = keyof typeof STORAGE_KEYS;

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
 * Tjek om en sessionStorage key er en gyldig MinEO key
 *
 * @param key - SessionStorage key at tjekke
 * @returns true hvis key er en kendt MinEO key
 */
export const isValidStorageKey = (key: string): boolean => {
  return STORAGE_KEY_SET.has(key) || key.startsWith(UI_STORAGE_PREFIXES.activeTab);
};

/**
 * Hent alle MinEO keys fra sessionStorage
 *
 * Returnerer kun keys der matcher vores manifest (domæne-data + UI-state).
 * Brug getDomainStorageKeys() hvis kun domæne-data skal ryddes.
 *
 * @returns Array af gyldige sessionStorage keys
 */
export const getAllMinEOKeys = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && isValidStorageKey(key)) {
      keys.push(key);
    }
  }
  return keys;
};

/**
 * Hent kun domæne-data keys fra sessionStorage (udelader UI-state keys)
 *
 * Bruges ved "ryd sagsdata"-operationer, hvor UI-præferencer
 * (filnavn, sidebar-tilstand, overlay-tilstand) skal bevares.
 *
 * @returns Array af domæne-relaterede sessionStorage keys
 */
export const getDomainStorageKeys = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && DOMAIN_STORAGE_KEY_SET.has(key)) {
      keys.push(key);
    }
  }
  return keys;
};
