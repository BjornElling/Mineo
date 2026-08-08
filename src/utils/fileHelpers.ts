import { coerceToDanishDateString } from '../types/branded';
import { loadDefaultDirectoryHandle, verifyDirectoryHandle } from './fileHandleStorage';
import { logError, logWarning } from './logger';
import type { AppSettings } from '../settings/appSettingsSchema';

// Konstanter for filhåndtering
const MAX_FILENAME_LENGTH = 150;
const FALLBACK_FILENAME = 'Erstatningsopgørelse';
const EO_FILENAME_PREFIX = 'Mineo';

// Windows-reserverede filnavne
const RESERVED_NAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

/**
 * Renser filnavn for krydsplatforms-kompatibilitet.
 * Fjerner ugyldige tegn og håndterer Windows-reserverede navne.
 *
 * @param {string} name - Filnavn der skal renses
 * @param {string} fallback - Fallback-navn hvis input er ugyldigt
 * @returns {string} Renset filnavn
 */
export const sanitizeFilename = (name: string | null | undefined, fallback = FALLBACK_FILENAME): string => {
  if (!name || typeof name !== 'string') {
    return fallback;
  }

  // Behold kun alfanumeriske tegn, mellemrum, bindestreger, underscores og punktummer
  let safe = name
    .split('')
    .filter(c => /[a-zA-Z0-9æøåÆØÅ \-_.]/.test(c))
    .join('');

  // Reducer multiple mellemrum til ét
  safe = safe.replace(/\s+/g, ' ').trim();

  // Fjern trailing punktummer og mellemrum (ugyldigt i Windows)
  safe = safe.replace(/[\s.]+$/, '');

  if (!safe) {
    return fallback;
  }

  // Tjek for Windows-reserverede navne
  if (RESERVED_NAMES.has(safe.toLowerCase())) {
    safe = `${safe}_`;
  }

  // Begræns længde for at undgå filesystem-problemer
  if (safe.length > MAX_FILENAME_LENGTH) {
    safe = safe.substring(0, MAX_FILENAME_LENGTH).replace(/[\s.]+$/, '');
  }

  return safe || fallback;
};

/**
 * Genererer beskrivende filnavn baseret på stamdata.
 * Format: Mineo - [Skadelidte] - [Skadestype] - [Dato]
 * Fallback: Mineo - [Journalnr] - "Erstatningsopgørelse"
 *
 * @param {Object} data - Sagsdata med stamdata
 * @returns {string} Genereret filnavn (uden extension)
 */
type FilenameSource = Readonly<{
  stamdata?: Readonly<{
    skadelidte?: string;
    skadestype?: string;
    skadedato?: string;
    journalnr?: string;
  }>;
}>;

export const generateFilename = (data: FilenameSource | null | undefined): string => {
  try {
    const stamdata = data?.stamdata || {};

    const skadelidte = (stamdata.skadelidte || '').trim();
    const skadestype = (stamdata.skadestype || '').trim();
    const skadedato = (stamdata.skadedato || '').trim();
    const journalnr = (stamdata.journalnr || '').trim();

    // Filtrer placeholder-værdier fra
    const validSkadestype = (skadestype && skadestype !== 'Vælg skadestype')
      ? skadestype
      : '';

    // Byg filnavn fra tilgængelige komponenter
    const parts: string[] = [EO_FILENAME_PREFIX];
    if (skadelidte) parts.push(sanitizeFilename(skadelidte));
    if (validSkadestype) parts.push(sanitizeFilename(validSkadestype));
    if (skadedato) {
      const formattedSkadedato = coerceToDanishDateString(skadedato);
      parts.push(sanitizeFilename(formattedSkadedato ?? skadedato));
    }

    if (parts.length === 0) {
      // Hvis ingen primære felter er udfyldt, brug journalnr hvis tilgængeligt
      if (journalnr) {
        return `${EO_FILENAME_PREFIX} - ${sanitizeFilename(journalnr)} - ${FALLBACK_FILENAME}`;
      }
      return `${EO_FILENAME_PREFIX} - ${FALLBACK_FILENAME}`;
    }

    const filename = parts.join(' - ');
    return sanitizeFilename(filename) || FALLBACK_FILENAME;

  } catch (error) {
    logError('Fejl ved filnavns-generering', { context: 'generateFilename', error: error instanceof Error ? error : undefined });
    return FALLBACK_FILENAME;
  }
};

/**
 * Trigger fil-download i browser
 *
 * @param {string} content - Fil-indhold
 * @param {string} filename - Filnavn (inkl. extension)
 * @param {string} mimeType - MIME type for filen
 */
export const downloadFile = (content: string, filename: string, mimeType = 'application/octet-stream'): void => {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    // Cleanup. `a.remove()` er en no-op hvis noden allerede er fjernet (fx ved en re-render),
    // modsat removeChild der ville kaste.
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 100);

  } catch (error) {
    logError('Fejl ved fil-download', { context: 'downloadFile', error: error instanceof Error ? error : undefined });
    throw new Error('Kunne ikke downloade fil');
  }
};

/**
 * Læser fil fra bruger-valgt fil
 *
 * @param {File} file - Fil-objekt fra input
 * @returns {Promise<string>} Fil-indhold som tekst
 */
export const readFile = (file: File | null | undefined): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    if (!file) {
      reject(new Error('Ingen fil valgt'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
        return;
      }
      reject(new Error('Kunne ikke læse fil'));
    };

    reader.onerror = () => {
      reject(new Error('Kunne ikke læse fil'));
    };

    reader.readAsText(file);
  });
};

/**
 * Åbner fil-vælger dialog
 *
 * @param {string} accept - Accept-attribut (fx ".eo")
 * @returns {Promise<File>} Valgt fil eller null hvis annulleret
 */
export const selectFile = (accept = '.eo'): Promise<File | null> => {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const file = target?.files?.[0] ?? null;
      document.body.removeChild(input);
      resolve(file);
    };

    // Håndter annullering
    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
};

// ============================================================================
// Default directory resolver (single source of truth)
// ============================================================================

/**
 * Resultat fra resolveDefaultDirectoryHandle
 */
export interface ResolvedDirectory {
  /** Directory handle der skal bruges til startIn */
  handle: FileSystemDirectoryHandle | null;
  /** Well-known directory identifier (bruges som fallback) */
  wellKnown: 'desktop';
  /** Om dette er fallback til desktop */
  isFallback: boolean;
}

/**
 * Resolver den autoritative standard-placering for GEM/HENT-operationer.
 *
 * VIGTIGT: Denne funktion er single source of truth for:
 * - Gem-operationer (fileSave.ts)
 * - Hent-operationer (fileLoad.ts)
 *
 * Den er derimod IKKE visningens kilde. Fladen bruger
 * `resolveDefaultDirectoryLocation` (`utils/file/defaultDirectoryLocation.ts`), fordi de to
 * svarer på hvert sit spørgsmål: denne må requestere permissions og skal derfor kun kaldes fra
 * en brugerhandling, mens visningen kaldes ved mount og re-render og skal være passiv.
 *
 * Typen bar tidligere også et `displayName` — «til UI» ifølge sin egen kommentar, men uden en
 * eneste læser i produktionskoden. Det gjorde fil-laget til en anden, tavs mening om et
 * brugersynligt navn, som fladen samtidig stavede anderledes. Navnet bor nu ét sted.
 *
 * Logik (rækkefølgen er afgørende):
 * 1. Hvis settings.defaultDirectoryHandleId findes:
 *    - Slå op via IndexedDB
 *    - Hvis ikke fundet → fallback til desktop
 *    - Hvis fundet: check queryPermission
 *    - Hvis permission ikke er granted: forsøg requestPermission
 *    - Hvis stadig ikke granted → fallback til desktop
 * 2. Fallback: Returnér 'desktop' som well-known identifier
 *
 * INGEN side effects (ingen settings-update). Funktionen er ren + deterministisk.
 *
 * @param settings AppSettings (optional - bruges til at tjekke om bruger har valgt en placering)
 * @returns ResolvedDirectory med handle eller fallback
 */
export const resolveDefaultDirectoryHandle = async (
  settings?: AppSettings
): Promise<ResolvedDirectory> => {
  // Fallback-resultat (bruges hvis ingen brugervalgt placering eller den er ugyldig)
  const desktopFallback: ResolvedDirectory = {
    handle: null,
    wellKnown: 'desktop',
    isFallback: true,
  };

  // Hvis ingen settings eller ingen brugervalgt placering, brug fallback
  if (!settings?.defaultDirectoryHandleId) {
    return desktopFallback;
  }

  try {
    // Forsøg at hente directory handle fra IndexedDB
    const handle = await loadDefaultDirectoryHandle();

    if (!handle) {
      // Handle ikke fundet i IndexedDB (muligvis slettet)
      // Forventelig fallback-situation: logges som info (ikke warning).
      return desktopFallback;
    }

    // Verificér at handle stadig er gyldigt og har permission
    // Pickerens `startIn` kræver kun, at mappen fortsat kan bruges som læsbar startplacering.
    // Selve gem-operationen anmoder senere om nødvendig filskrivetilladelse på den valgte fil.
    const isValid = await verifyDirectoryHandle(handle, {
      mode: 'read',
      allowRequestPermission: true,
    });

    if (!isValid) {
      // Handle er ugyldigt (mappe slettet, permission nægtet, etc.)
      // Forventelig fallback-situation: logges som info (ikke warning).
      return desktopFallback;
    }

    // Handle er gyldigt - returnér det
    return {
      handle,
      wellKnown: 'desktop', // Fallback identifier hvis handle fejler ved brug
      isFallback: false,
    };

  } catch (error) {
    // Uventet fejl - log og brug fallback
    logWarning('Fejl ved resolve af standard-placering - falder tilbage til skrivebord', {
      context: 'resolveDefaultDirectoryHandle',
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    return desktopFallback;
  }
};

/**
 * Returnerer startIn-værdi til File System Access API baseret på resolved directory.
 * Denne funktion bruges i fileSystemAccess.ts til at bestemme startIn-værdien.
 *
 * @param resolved ResolvedDirectory fra resolveDefaultDirectoryHandle
 * @returns FileSystemDirectoryHandle eller 'desktop' string
 */
export const getStartInValue = (
  resolved: ResolvedDirectory
): FileSystemDirectoryHandle | 'desktop' => {
  if (resolved.handle && !resolved.isFallback) {
    return resolved.handle;
  }
  return resolved.wellKnown;
};
