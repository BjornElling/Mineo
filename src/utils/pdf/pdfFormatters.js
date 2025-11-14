/**
 * PDF Formaterings-funktioner
 *
 * Hjælpefunktioner til formatering af data i PDF-dokumenter
 */

/**
 * Formater beløb med dansk tusindtalsseparator
 * @param {number} amount - Beløb at formatere
 * @returns {string} Formateret beløb med "kr." suffix
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || amount === '') return '';
  return `${amount.toLocaleString('da-DK')} kr.`;
};

/**
 * Formater beløb per enhed (f.eks. kr./sygedag)
 * @param {number} amount - Beløb at formatere
 * @param {string} unit - Enhed (f.eks. "sygedag", "méngrad")
 * @returns {string} Formateret beløb med enhed
 */
export const formatCurrencyPerUnit = (amount, unit) => {
  if (amount === null || amount === undefined || amount === '') return '';
  return `${amount.toLocaleString('da-DK')} kr./${unit}`;
};

/**
 * Formater procent med dansk decimalseparator
 * @param {number} value - Procentværdi at formatere
 * @returns {string} Formateret procent med "%" suffix
 */
export const formatPercentage = (value) => {
  if (value === null || value === undefined || value === '') return '';
  return `${value.toString().replace('.', ',')} %`;
};

/**
 * Tjek om værdi er gyldig (ikke null, undefined eller tom streng)
 * @param {*} value - Værdi at tjekke
 * @returns {boolean} True hvis værdien er gyldig
 */
export const isValidValue = (value) => {
  return value !== null && value !== undefined && value !== '';
};

/**
 * Tjek om værdi er større end nul
 * @param {*} value - Værdi at tjekke
 * @returns {boolean} True hvis værdien er > 0
 */
export const isGreaterThanZero = (value) => {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  return !isNaN(num) && num > 0;
};

/**
 * Tjek om værdi er en ikke-tom streng
 * @param {*} value - Værdi at tjekke
 * @returns {boolean} True hvis værdien er en ikke-tom streng
 */
export const isNonEmptyString = (value) => {
  return typeof value === 'string' && value.trim() !== '';
};
