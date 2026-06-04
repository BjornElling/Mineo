import { formatCurrency, formatAsAmount, formatAsAmountTrimmed } from '../../utils/formatUtils';
import { roundByMethod } from '../../utils/rounding';
import { round4 } from '../../utils/roundingShortcuts';
import { resolveDocumentFileName, sanitizeFilenamePart } from '../../document/documentFileName';

const NBSP = '\u00A0';

// `sanitizeFilenamePart` er format-agnostisk og bor i den kanoniske dokument-filnavnsregel
// (`src/document/documentFileName.ts`). Re-eksporteres her, så de eksisterende PDF-call-sites
// kan importere den fra samme sted som `resolvePdfFileName` uden at kende til document-laget.
export { sanitizeFilenamePart };

/**
 * Bygger et PDF-filnavn via den fælles dokument-filnavnsregel (`resolveDocumentFileName`).
 *
 * PDF-generatorerne kender altid kun PDF-endelsen, fordi de bygger filnavnet før det
 * aktive output-format kendes. Den faktiske endelse afgøres ved download: PDF beholder
 * `.pdf`, mens Word-writeren mapper til `.docx` ud fra det aktive dokument-format. Reglen
 * (journalnr-præfiks, ` (udkast)`, sanitering) er fælles for begge formater — kun endelsen
 * adskiller sig (jf. `document-format-contract.md` §4.4).
 */
export const resolvePdfFileName = (baseTitle: string, isDraft: boolean, journalnr?: string): string => {
  return resolveDocumentFileName(baseTitle, isDraft, 'pdf', journalnr);
};

export const formatMaanederTrimmed = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const rounded = roundByMethod(value, 4, 'halfAwayFromZero');
  return formatAsAmountTrimmed(rounded, 4);
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

/**
 * Formaterer en enhedssats som `123 kr./enhed`.
 *
 * `decimals` bruges kun når PDF'en bevidst skal vise en anden præcision end den
 * kanoniske 2-decimal-standard, fx hele kroner i satstabeller.
 */
export const formatCurrencyPerUnit = (
  amount: number | null | undefined,
  unit: string,
  decimals: number = 2
): string => {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  return `${addNbspAfterMinus(formatAsAmount(amount, decimals))}${NBSP}kr./${unit}`;
};

export const formatPercentDelta = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  const rounded = roundByMethod(abs, 2, 'halfAwayFromZero');
  return formatAsAmountTrimmed(rounded, 2);
};

/**
 * Bygger den kanoniske regulerings-faktortekst til segment-linjer i EO-/TAF-PDF'er:
 * `" x (100 % + X,XX %)"` / `" x (100 % - X,XX %)"`.
 *
 * `deltaPct` afrundes til 2 decimaler (`halfAwayFromZero`); afrunder den til `0,00 %`
 * undertrykkes faktoren helt (returnerer `''`), så near-nul-regulering ikke giver en
 * støjende `"x (100 % + 0,00 %)"`-linje. Denne ene helper sikrer at faktorteksten er
 * ens i hovedopgørelsen, offentlige-ydelser-bilaget og TAF-fordelt-på-år.
 */
export const formatReguleringFactorText = (deltaPct: number): string => {
  if (!Number.isFinite(deltaPct)) return '';
  const rounded = roundByMethod(deltaPct, 2, 'halfAwayFromZero');
  if (rounded === 0) return '';
  return ` x (100 % ${rounded > 0 ? '+' : '-'} ${formatPercentDelta(rounded)} %)`;
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
 *
 * Fortegnet vælges ud fra den *afrundede* størrelse, ikke den rå værdi: en lille
 * negativ værdi der afrundes til 0 (fx -0,00001) skal vises som "+ 0 %", ikke
 * "- 0 %" — et negativt fortegn på nul er misvisende i et tillidskritisk dokument.
 */
export const formatReguleringPct = (value: number): string => {
  const rounded = round4(Math.abs(value));
  const inner = formatAsAmountTrimmed(rounded, 4);
  const sign = value < 0 && rounded !== 0 ? '-' : '+';
  return `${sign} ${inner} %`;
};

export { isSingularCount } from '../../utils/formatUtils';
export { formatCountWithUnit } from '../../utils/formatUtils';
/** Kanonisk kr.-formatering (0 som standard) — genbruges fra UI-laget for at undgå dobbelt sandhed. */
export { formatKr } from '../../utils/formatUtils';
