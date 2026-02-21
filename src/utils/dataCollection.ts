/**
 * Formel-værdi struktur
 */
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { UI_STORAGE_KEYS } from '../config/storageManifest';

interface FormulaValue {
  formula: string;
  value: string;
}

/**
 * Parsed field value
 */
interface ParsedFieldValue {
  formula: string | null;
  computed: string;
}

type FormulaLike = {
  formula?: unknown;
  value?: unknown;
};

type InternalFieldStateLike = {
  formula?: unknown;
  computed?: unknown;
};

type PersistedDataWrapper = {
  version: string;
  timestamp: number;
  data: unknown;
};

/**
 * Parser en felt-værdi og håndterer både string og formel-objekter
 */
export const parseFieldValue = (value: unknown): ParsedFieldValue => {
  // Hvis value er et objekt med formula property
  if (value && typeof value === 'object' && 'formula' in (value as Record<string, unknown>)) {
    const v = value as FormulaLike;
    return {
      formula: typeof v.formula === 'string' && v.formula.trim() ? v.formula : null,
      computed: typeof v.value === 'string' ? v.value : ''
    };
  }

  // Ellers normal string (backward compatible)
  return {
    formula: null,
    computed: typeof value === 'string' ? value : (value === null || value === undefined ? '' : String(value))
  };
};

/**
 * Serialiserer en felt-værdi til gem-format
 */
export const serializeFieldValue = (internalState: unknown): string | FormulaValue => {
  const state = (internalState && typeof internalState === 'object')
    ? (internalState as InternalFieldStateLike)
    : null;

  // Hvis der er en formel, gem som object
  if (state && typeof state.formula === 'string' && state.formula.trim().length > 0) {
    return {
      formula: state.formula,
      value: typeof state.computed === 'string' ? state.computed : ''
    };
  }

  // Ellers gem som string (backward compatible)
  if (state && typeof state.computed === 'string') {
    return state.computed;
  }

  return typeof internalState === 'string'
    ? internalState
    : (internalState === null || internalState === undefined ? '' : String(internalState));
};

/**
 * Tjekker om en værdi indeholder meningsfulde data (ikke tom/null).
 */
export const isMeaningfulValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  if (typeof value === 'boolean') {
    return true; // Booleans tæller altid
  }

  if (typeof value === 'number') {
    return true; // Tal tæller altid (inkl. 0)
  }

  return false;
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

const isPersistedDataWrapper = (value: unknown): value is PersistedDataWrapper => {
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
  const metadataKeys = [
    UI_STORAGE_KEYS.pendingOverlay,
    UI_STORAGE_KEYS.lastSavedFilename,
    UI_STORAGE_KEYS.lastSavedFilenameBasis,
    'mineo_lastSavedFilePath',
    'mineo_lastSavedStamdata',
    'mineo_debug_lastLoad',
    UI_STORAGE_KEYS.debugLastLoadInfo,
    UI_STORAGE_KEYS.sideMenuExpanded,
  ];

  console.group('[collectAllData] Scanning sessionStorage');
  console.log(`Total keys in sessionStorage: ${sessionStorage.length}`);

  // Scan alle sessionStorage keys
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);

    // Kun interesseret i mineo_* keys
    if (key && key.startsWith('mineo_')) {
      // UI-state keys er ikke persisted brugerinput og kan være ikke-JSON (fx 'satser')
      if (key.startsWith('mineo_ui_')) {
        console.log(`  Skipping UI key: ${key}`);
        continue;
      }

      // Ignorer metadata-keys
      if (metadataKeys.includes(key)) {
        console.log(`  Skipping metadata key: ${key}`);
        continue;
      }

      const pageKey = key.replace('mineo_', '');
      console.log(`  Found data key: ${key} → pageKey: ${pageKey}`);

      try {
        const value = sessionStorage.getItem(key);
        if (value) {
          const parsed: unknown = JSON.parse(value);

          // Unwrap PersistedData-struktur hvis den findes
          // (Nye data har {version, timestamp, data}, gamle data er bare objekter)
          if (isPersistedDataWrapper(parsed)) {
            // Nyt format - unwrap data-feltet
            console.log(`    ✓ PersistedData format detected (version: ${parsed.version})`);
            allData[pageKey] = parsed.data;
          } else {
            // Gammelt format (eller ukomplet data) - brug som er
            console.log(`    ⚠ Old format (no version field)`);
            allData[pageKey] = parsed;
          }
        }
      } catch (error) {
        console.error(`Fejl ved parsing af sessionStorage key '${key}':`, error);
        // Spring denne key over ved fejl
      }
    }
  }

  console.log(`Collected data keys: ${Object.keys(allData).join(', ')}`);
  console.groupEnd();

  return allData;
};

/**
 * Tjekker om datasættet indeholder egentligt brugerindhold.
 */
export const hasRealData = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const dataRecord = data as Record<string, unknown>;

  // Filtrer metadata-nøgler fra
  const contentKeys = Object.keys(dataRecord).filter(k => !k.startsWith('_'));

  if (contentKeys.length === 0) {
    return false;
  }

  // Tjek om mindst én sektion har meningsfuldt indhold
  for (const key of contentKeys) {
    const section = dataRecord[key];

    if (typeof section === 'object' && section !== null) {
      for (const value of Object.values(section as Record<string, unknown>)) {
        if (isMeaningfulValue(value)) {
          return true;
        }
      }
    }
  }

  return false;
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

  console.log(`Ryddet ${keysToRemove.length} mineo_* keys fra sessionStorage (beholdt ${keysToPreserve.size})`);
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

  const CURRENT_VERSION = PERSISTED_DATA_VERSION; // Matcher FormPersistenceContext

  console.group('[saveDataToSessionStorage] Gemmer data fra fil til sessionStorage');
  console.log(`Input data keys: ${Object.keys(data).join(', ')}`);

  // Gem hver sektion til sessionStorage i PersistedData-format
  for (const [pageKey, pageData] of Object.entries(data as Record<string, unknown>)) {
    // Spring metadata over
    if (pageKey.startsWith('_')) {
      console.log(`  Skipping metadata key: ${pageKey}`);
      continue;
    }

    try {
      // Wrap i PersistedData-struktur (matcher FormPersistenceContext)
      const persistedData: PersistedDataWrapper = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        data: pageData,
      };

      const storageKey = `mineo_${pageKey}`;
      sessionStorage.setItem(storageKey, JSON.stringify(persistedData));
      const fieldCount = (pageData && typeof pageData === 'object' && !Array.isArray(pageData))
        ? Object.keys(pageData as Record<string, unknown>).length
        : 0;
      console.log(`  ✓ Saved: ${storageKey} (${fieldCount} fields)`);
    } catch (error) {
      console.error(`Fejl ved gemning af ${pageKey} til sessionStorage:`, error);
      throw new Error(`Kunne ikke gemme ${pageKey}`);
    }
  }

  console.groupEnd();
};

