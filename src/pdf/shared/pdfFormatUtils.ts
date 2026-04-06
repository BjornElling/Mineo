import { formatCurrency, formatAsAmount, formatAsAmountTrimmed } from '../../utils/formatUtils';
import { roundByMethod } from '../../utils/rounding';
import { round4 } from '../../utils/roundingShortcuts';

const NBSP = '\u00A0';

const replaceControlChars = (value: string): string => {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const code = ch.charCodeAt(0);
    out += code <= 31 ? '_' : ch;
  }
  return out;
};

export const sanitizeFilenamePart = (value: string): string => {
  return replaceControlChars(value)
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Kanonisk filnavnsregel for PDF-downloads.
 *
 * Resultat:
 * - `{journalnr} - {baseTitle}.pdf` når journalnr er udfyldt
 * - `{baseTitle}.pdf` når journalnr er tomt
 * - ` (udkast)` indsættes lige før `.pdf` når `isDraft=true`
 *
 * Både `journalnr` og `baseTitle` saniteres altid for Windows-ulovlige tegn:
 * `< > : " / \ | ? *` samt kontroltegn.
 */
export const resolvePdfFileName = (baseTitle: string, isDraft: boolean, journalnr?: string): string => {
  const safeJournalnr = typeof journalnr === 'string' ? sanitizeFilenamePart(journalnr.trim()) : '';
  const prefix = safeJournalnr !== '' ? `${safeJournalnr} - ` : '';
  const safeTitle = sanitizeFilenamePart(baseTitle);
  return `${prefix}${safeTitle}${isDraft ? ' (udkast)' : ''}.pdf`;
};

export const formatMaanederTrimmed = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const rounded = roundByMethod(value, 4, 'halfAwayFromZero');
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

/** Indsætter NBSP efter minus i negative beløb, så PDF-renderere ikke bryder midt i et negativt tal. */
const addNbspAfterMinus = (s: string): string => (s.startsWith('-') ? `-${NBSP}${s.slice(1)}` : s);

export const formatCurrencyFromOre = (ore: number): string => {
  if (!Number.isFinite(ore)) return '-';
  return addNbspAfterMinus(formatCurrency(ore / 100));
};

export const formatMoneyOreWithKr = (ore: number): string => `${formatCurrencyFromOre(ore)}${NBSP}kr.`;

/** Formaterer øre-beløb uden decimaler når de er ,00 */
export const formatCurrencyFromOreTrimmed = (ore: number): string => {
  const formatted = formatCurrencyFromOre(ore);
  // formatted kan starte med '-\u00A0', så tjek for ,00 i slutningen
  return formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted;
};

export const formatMoneyOreWithKrTrimmed = (ore: number): string => `${formatCurrencyFromOreTrimmed(ore)}${NBSP}kr.`;

export const formatCurrencyPerUnit = (amount: number | null | undefined, unit: string): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  return `${addNbspAfterMinus(formatCurrency(amount))}${NBSP}kr./${unit}`;
};

export const formatPercentDelta = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  const rounded = roundByMethod(abs, 2, 'halfAwayFromZero');
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

/** Formaterer kroner-beløb til PDF med NBSP efter minus ved negative tal. */
export const formatCurrencyForPdf = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return addNbspAfterMinus(formatCurrency(value));
};

/** Formaterer beløb (fri precision) til PDF med NBSP efter minus ved negative tal. */
export const formatAmountForPdf = (value: number | null | undefined, precision: number = 2): string => {
  const s = formatAsAmount(value, precision);
  return addNbspAfterMinus(s);
};

/**
 * Formaterer måneder med præcis 4 decimaler (ingen trimming af trailing zeros).
 * Trailing zeros bevares for visuel rækkekonsistens i tabeller, fx i EET-periodetabellen,
 * hvor "1,0000" og "2,5000" skal flugte i samme kolonne.
 * Brug formatMaanederTrimmed i stedet, hvis trailing zeros er uønskede.
 */
export const formatMaaneder4 = (value: number): string => formatAsAmount(round4(value), 4);

/**
 * Formaterer et reguleringsprocent-tal med fortegn: "+ X,YZ %" eller "- X,YZ %".
 * Trailing zeros trimmes (fx "22,81 %" frem for "22,8100 %").
 */
export const formatReguleringPct = (value: number): string => {
  const inner = formatAsAmountTrimmed(round4(Math.abs(value)), 4);
  return `${value >= 0 ? '+' : '-'} ${inner} %`;
};

/** Formaterer et kr.-beløb med valgfrit antal decimaler (0 som standard). */
export const formatKr = (value: number, decimals = 0): string =>
  `${formatAsAmount(value, decimals)} kr.`;

export { isSingularCount } from '../../utils/formatUtils';
export { formatCountWithUnit } from '../../utils/formatUtils';
