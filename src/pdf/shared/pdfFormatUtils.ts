import { formatCurrency } from '../../utils/formatUtils';
import { roundByMethod } from '../../utils/rounding';

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

export const formatCurrencyFromOre = (ore: number): string => {
  if (!Number.isFinite(ore)) return '-';
  return formatCurrency(ore / 100);
};

export const formatMoneyOreWithKr = (ore: number): string => `${formatCurrencyFromOre(ore)}${NBSP}kr.`;

/** Formaterer øre-beløb uden decimaler når de er ,00 */
export const formatCurrencyFromOreTrimmed = (ore: number): string => {
  const formatted = formatCurrencyFromOre(ore);
  return formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted;
};

export const formatMoneyOreWithKrTrimmed = (ore: number): string => `${formatCurrencyFromOreTrimmed(ore)}${NBSP}kr.`;

export const formatCurrencyPerUnit = (amount: number | null | undefined, unit: string): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  return `${formatCurrency(amount)}${NBSP}kr./${unit}`;
};

export const formatPercentDelta = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  const rounded = roundByMethod(abs, 2, 'halfAwayFromZero');
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export { isSingularCount } from '../../utils/formatUtils';
export { formatCountWithUnit } from '../../utils/formatUtils';
