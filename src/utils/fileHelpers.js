// Konstanter for filhåndtering
const MAX_FILENAME_LENGTH = 150;
const FALLBACK_FILENAME = 'Erstatningsopgørelse';

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
export const sanitizeFilename = (name, fallback = FALLBACK_FILENAME) => {
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
 * Format: [Skadelidte] - [Skadestype] - [Dato]
 * Fallback: [Journalnr] - "Erstatningsopgørelse"
 *
 * @param {Object} data - Sagsdata med stamdata
 * @returns {string} Genereret filnavn (uden extension)
 */
export const generateFilename = (data) => {
  try {
    const stamdata = data?.stamdata || {};

    const skadelidte = (stamdata.skadelidte || '').trim();
    const skadestype = (stamdata.skadestype || '').trim();
    const skadesdato = (stamdata.skadesdato || '').trim();
    const journalnr = (stamdata.journalnr || '').trim();

    // Filtrer placeholder-værdier fra
    const validSkadestype = (skadestype && skadestype !== 'Vælg skadestype')
      ? skadestype
      : '';

    // Byg filnavn fra tilgængelige komponenter
    const parts = [];
    if (skadelidte) parts.push(sanitizeFilename(skadelidte));
    if (validSkadestype) parts.push(sanitizeFilename(validSkadestype));
    if (skadesdato) parts.push(sanitizeFilename(skadesdato));

    if (parts.length === 0) {
      // Hvis ingen primære felter er udfyldt, brug journalnr hvis tilgængeligt
      if (journalnr) {
        return `${sanitizeFilename(journalnr)} - ${FALLBACK_FILENAME}`;
      }
      return FALLBACK_FILENAME;
    }

    const filename = parts.join(' - ');
    return sanitizeFilename(filename) || FALLBACK_FILENAME;

  } catch (error) {
    console.error('Fejl ved filnavns-generering:', error);
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
export const downloadFile = (content, filename, mimeType = 'application/octet-stream') => {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

  } catch (error) {
    console.error('Fejl ved fil-download:', error);
    throw new Error('Kunne ikke downloade fil');
  }
};

/**
 * Læser fil fra bruger-valgt fil
 *
 * @param {File} file - Fil-objekt fra input
 * @returns {Promise<string>} Fil-indhold som tekst
 */
export const readFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Ingen fil valgt'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      resolve(e.target.result);
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
export const selectFile = (accept = '.eo') => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    input.onchange = (e) => {
      const file = e.target.files?.[0];
      document.body.removeChild(input);
      resolve(file || null);
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
