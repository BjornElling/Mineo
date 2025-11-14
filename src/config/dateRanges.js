/**
 * Central konfiguration af dato-afgrænsninger for MINEO
 * 
 * ÅRLIG OPDATERING:
 * Opdater MAX_YEAR én gang om året for at udvide alle datofelter automatisk
 */

// Aktuel år (opdater årligt)
export const MAX_YEAR = 2025;

// Minimums-år for arbejdsskadesatser
export const MIN_YEAR = 2005;

// Minimums-datoer (historiske grænser)
export const MIN_SKADESDATO = '2005-01-01';

// Dagens dato (beregnes dynamisk)
export const TODAY = new Date().toISOString().split('T')[0];

/**
 * Formaterer ISO-dato til dansk format (dd-mm-åååå)
 * @param {string} isoDate - ISO-formateret dato (åååå-mm-dd)
 * @returns {string} Dansk-formateret dato (dd-mm-åååå)
 */
export const formatToDanish = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
};

/**
 * Formaterer dansk dato til ISO-format (åååå-mm-dd)
 * @param {string} danishDate - Dansk-formateret dato (dd-mm-åååå)
 * @returns {string} ISO-formateret dato (åååå-mm-dd)
 */
export const formatToISO = (danishDate) => {
  if (!danishDate) return '';
  const [day, month, year] = danishDate.split('-');
  return `${year}-${month}-${day}`;
};

/**
 * Dato-intervaller til brug i forskellige komponenter
 */
export const dateRanges = {
  skadesdato: {
    min: MIN_SKADESDATO,
    max: TODAY,
    placeholder: 'dd-mm-åååå'
  },
  // Tilføj flere dato-intervaller her efterhånden
};
