/**
 * Storage Manifest
 *
 * Centraliseret definition af alle sessionStorage keys brugt i MINEO.
 * Dette sikrer type-safety og forhindrer typos ved gem/hent operationer.
 */

/**
 * Alle gyldige storage keys i MINEO
 *
 * Hver side/modul har sin egen key til sessionStorage.
 * Mapping: pageKey → sessionStorage key
 */
export const STORAGE_KEYS = {
  stamdata: 'mineo_stamdata',
  satser: 'mineo_satser',
  aarsloen: 'mineo_aarsloen',
  renteberegning: 'mineo_renteberegning',
  varigemen: 'mineo_varigemen',
  erstatningsopgoerelse: 'mineo_erstatningsopgoerelse',
} as const;

const STORAGE_KEY_SET: ReadonlySet<string> = new Set(Object.values(STORAGE_KEYS));

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
 * Tjek om en sessionStorage key er en gyldig MINEO key
 *
 * @param key - SessionStorage key at tjekke
 * @returns true hvis key er en kendt MINEO key
 */
export const isValidStorageKey = (key: string): boolean => {
  return STORAGE_KEY_SET.has(key);
};

/**
 * Hent alle MINEO keys fra sessionStorage
 *
 * Returnerer kun keys der matcher vores manifest.
 *
 * @returns Array af gyldige sessionStorage keys
 */
export const getAllMineoKeys = (): string[] => {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && isValidStorageKey(key)) {
      keys.push(key);
    }
  }
  return keys;
};
