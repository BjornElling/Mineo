import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { UI_STORAGE_KEYS } from '../config/storageManifest';
import type { PersistedData } from '../types/persistence';

const debugEnabled = import.meta.env.DEV;
const debugLog = (...args: unknown[]): void => {
  if (debugEnabled) console.debug(...args);
};
const debugGroup = (label: string): void => {
  if (debugEnabled) console.group(label);
};
const debugGroupEnd = (): void => {
  if (debugEnabled) console.groupEnd();
};

/**
 * Tjekker om en værdi indeholder meningsfulde data (ikke tom/null).
 */
export const isMeaningfulValue = (value: unknown): boolean => {
  const hasMeaningful = (
    candidate: unknown,
    depth: number,
    seen: WeakSet<object>
  ): boolean => {
    if (depth > 10) return false;
    if (candidate === null || candidate === undefined) return false;

    if (typeof candidate === 'string') {
      return candidate.trim().length > 0;
    }

    if (typeof candidate === 'boolean' || typeof candidate === 'number') {
      return true;
    }

    if (Array.isArray(candidate)) {
      return candidate.some((item) => hasMeaningful(item, depth + 1, seen));
    }

    if (typeof candidate === 'object') {
      if (seen.has(candidate)) return false;
      seen.add(candidate);
      return Object.values(candidate as Record<string, unknown>)
        .some((item) => hasMeaningful(item, depth + 1, seen));
    }

    return false;
  };

  return hasMeaningful(value, 0, new WeakSet<object>());
};

/**
 * Tæller antal felter med meningsfulde værdier i et data-objekt.
 * Håndterer nested strukturer og arrays.
 */
const countFieldsRecursive = (data: unknown, depth: number = 0): number => {
  // Sikkerhed mod uendelig rekursion
  if (depth > 10) {
    return 0;
  }

  if (!data) {
    return 0;
  }

  // Håndter arrays (fx rentekravRows)
  if (Array.isArray(data)) {
    return data.reduce((sum, item) => sum + countFieldsRecursive(item, depth + 1), 0);
  }

  // Håndter objekter
  if (typeof data === 'object') {
    let count = 0;

    for (const key of Object.keys(data as Record<string, unknown>)) {
      // Ignorer metadata og private nøgler
      if (key.startsWith('_')) {
        continue;
      }

      const value = (data as Record<string, unknown>)[key];

      // Hvis værdi er et objekt eller array, rekurser
      if (typeof value === 'object' && value !== null) {
        count += countFieldsRecursive(value, depth + 1);
      } else if (isMeaningfulValue(value)) {
        // Ellers tæl hvis meningsfuld
        count += 1;
      }
    }

    return count;
  }

  // Primitive værdier
  return isMeaningfulValue(data) ? 1 : 0;
};

/**
 * Tæller totalt antal felter med meningsfulde værdier i hele datasættet.
 */
export const countFilledFields = (data: unknown): number => {
  if (!data || typeof data !== 'object') {
    return 0;
  }

  // Tæl alle data-sektioner (undtagen metadata)
  let totalCount = 0;

  for (const [key, value] of Object.entries(data)) {
    // Spring metadata over
    if (key.startsWith('_')) {
      continue;
    }

    totalCount += countFieldsRecursive(value);
  }

  return totalCount;
};

const isPersistedDataWrapper = (value: unknown): value is PersistedData<unknown> => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.version === 'string' &&
    typeof obj.timestamp === 'number' &&
    'data' in obj
  );
};

/**
 * Indsamler alle data fra sessionStorage.
 * Scanner alle mineo_* keys og strukturerer data per menupunkt.
 *
 * VIGTIGT: Unwrapper PersistedData-struktur (version, timestamp, data)
 * for at få fat i den faktiske data.
 */
export const collectAllData = (): Record<string, unknown> => {
  const allData: Record<string, unknown> = {};

  // Liste over metadata-keys der skal ignoreres
  const metadataKeys: string[] = [
    UI_STORAGE_KEYS.pendingOverlay,
    UI_STORAGE_KEYS.lastSavedFilename,
    UI_STORAGE_KEYS.lastSavedFilenameBasis,
    UI_STORAGE_KEYS.sideMenuExpanded,
  ];

  debugGroup('[collectAllData] Scanning sessionStorage');
  debugLog(`Total keys in sessionStorage: ${sessionStorage.length}`);

  // Scan alle sessionStorage keys
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);

    // Kun interesseret i mineo_* keys
    if (key && key.startsWith('mineo_')) {
      // UI-state keys er ikke persisted brugerinput og kan være ikke-JSON (fx 'satser')
      if (key.startsWith('mineo_ui_')) {
        debugLog(`  Skipping UI key: ${key}`);
        continue;
      }

      // Ignorer metadata-keys
      if (metadataKeys.includes(key)) {
        debugLog(`  Skipping metadata key: ${key}`);
        continue;
      }

      const pageKey = key.replace('mineo_', '');
      debugLog(`  Found data key: ${key} → pageKey: ${pageKey}`);

      try {
        const value = sessionStorage.getItem(key);
        if (value) {
          const parsed: unknown = JSON.parse(value);

          if (isPersistedDataWrapper(parsed)) {
            debugLog(`    ✓ PersistedData format detected (version: ${parsed.version})`);
            allData[pageKey] = parsed.data;
          } else {
            debugLog(`    Skipping non-PersistedData payload for key: ${key}`);
          }
        }
      } catch (error) {
        console.warn(`Fejl ved parsing af sessionStorage key '${key}':`, error);
        // Spring denne key over ved fejl
      }
    }
  }

  debugLog(`Collected data keys: ${Object.keys(allData).join(', ')}`);
  debugGroupEnd();

  return allData;
};

/**
 * Tjekker om datasættet indeholder egentligt brugerindhold.
 */
export const hasRealData = (data: unknown): boolean => {
  return countFilledFields(data) > 0;
};

/**
 * Rydder alle mineo_* keys fra sessionStorage.
 * Bruges før indlæsning af ny fil for at sikre tomme felter overskrives.
 */
export const clearAllData = (): void => {
  const keysToRemove: string[] = [];
  const keysToPreserve: ReadonlySet<string> = new Set([
    UI_STORAGE_KEYS.sideMenuExpanded, // Behold brugerens menu-tilstand ved hent/slet
  ]);

  // Samle alle mineo_* keys
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('mineo_') && !keysToPreserve.has(key)) {
      keysToRemove.push(key);
    }
  }

  // Fjern alle keys (gør det i separat loop for at undgå iterator-problemer)
  keysToRemove.forEach(key => {
    sessionStorage.removeItem(key);
  });

  debugLog(`Ryddet ${keysToRemove.length} mineo_* keys fra sessionStorage (beholdt ${keysToPreserve.size})`);
};

/**
 * Gemmer data til sessionStorage med PersistedData-struktur.
 *
 * VIGTIGT: Wrapper data i PersistedData-format (version, timestamp, data)
 * for at matche det format FormPersistenceContext forventer.
 */
export const saveDataToSessionStorage = (data: unknown): void => {
  if (!data || typeof data !== 'object') {
    throw new Error('Ugyldig data - skal være et objekt');
  }

  debugGroup('[saveDataToSessionStorage] Gemmer data fra fil til sessionStorage');
  debugLog(`Input data keys: ${Object.keys(data).join(', ')}`);

  // Gem hver sektion til sessionStorage i PersistedData-format
  for (const [pageKey, pageData] of Object.entries(data as Record<string, unknown>)) {
    // Spring metadata over
    if (pageKey.startsWith('_')) {
      debugLog(`  Skipping metadata key: ${pageKey}`);
      continue;
    }

    try {
      // Wrap i PersistedData-struktur (matcher FormPersistenceContext)
      const persistedData: PersistedData<unknown> = {
        version: PERSISTED_DATA_VERSION,
        timestamp: Date.now(),
        data: pageData,
      };

      const storageKey = `mineo_${pageKey}`;
      sessionStorage.setItem(storageKey, JSON.stringify(persistedData));
      const fieldCount = (pageData && typeof pageData === 'object' && !Array.isArray(pageData))
        ? Object.keys(pageData as Record<string, unknown>).length
        : 0;
      debugLog(`  ✓ Saved: ${storageKey} (${fieldCount} fields)`);
    } catch (error) {
      console.warn(`Fejl ved gemning af ${pageKey} til sessionStorage:`, error);
      throw new Error(`Kunne ikke gemme ${pageKey}`);
    }
  }

  debugGroupEnd();
};
