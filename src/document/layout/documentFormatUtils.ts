import {
  formatCurrency,
  formatAsAmount,
  formatAsAmountTrimmed,
  formatReguleringPctSigned,
} from '../../utils/formatUtils';
import { roundByMethod } from '../../utils/rounding';
import {
  DOCUMENT_MAANEDER_DECIMALS,
  formatDocumentMaanederFixed,
  formatDocumentMaanederTrimmed,
} from '../../utils/documentMaanederFormatting';
import { resolveDocumentFileName, sanitizeFilenamePart } from '../documentFileName';
import { toKroner, type MoneyOre } from '../../domain/money/money';
import type { DocumentDownloadFormat } from '../documentFormat';

/**
 * Hårdt mellemrum mellem tal og enhed, så en PDF-/Word-linjeombrydning aldrig river
 * «1.234 kr.» over to linjer. Eksporteret, fordi EO-generatoren tidligere holdt sin egen
 * kopi – en divergens der ville være usynlig indtil ombrydningen.
 */
export const NBSP = '\u00A0';

// `sanitizeFilenamePart` er format-agnostisk og bor i den kanoniske dokument-filnavnsregel
// (`src/document/documentFileName.ts`). Re-eksporteres her, så de eksisterende PDF-call-sites
// kan importere den fra samme sted som `resolveDocumentArtifactFileName` uden at kende til document-laget.
export { sanitizeFilenamePart };

/**
 * Bygger filnavnet via den fælles regel med den endelige endelse valgt direkte fra formatet.
 * `defineDocument` giver generatorens filnavns-builder sessionens reelle format, så endelsen
 * (`.pdf`/`.docx`) vælges her og ikke omskrives bagefter. Direkte kald (tests, standalone-service)
 * kan udelade formatet og få PDF som neutral basis.
 */
export const resolveDocumentArtifactFileName = (
  baseTitle: string,
  isDraft: boolean,
  journalnr?: string,
  format: DocumentDownloadFormat = 'pdf'
): string => {
  return resolveDocumentFileName(
    baseTitle,
    isDraft,
    format,
    journalnr
  );
};

export const formatMaanederTrimmed = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return formatDocumentMaanederTrimmed(value);
};

/** Indsætter NBSP efter minus i negative beløb, så PDF-renderere ikke bryder midt i et negativt tal. */
const addNbspAfterMinus = (s: string): string => (s.startsWith('-') ? `-${NBSP}${s.slice(1)}` : s);

export const formatCurrencyFromOre = (ore: MoneyOre): string => {
  if (!Number.isFinite(ore)) return '-';
  return addNbspAfterMinus(formatCurrency(toKroner(ore)));
};

export const formatMoneyOreWithKr = (ore: MoneyOre): string => `${formatCurrencyFromOre(ore)}${NBSP}kr.`;

/** Formaterer øre-beløb uden decimaler når de er ,00 */
export const formatCurrencyFromOreTrimmed = (ore: MoneyOre): string => {
  const formatted = formatCurrencyFromOre(ore);
  // formatted kan starte med '-\u00A0', så tjek for ,00 i slutningen
  return formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted;
};

export const formatMoneyOreWithKrTrimmed = (ore: MoneyOre): string => `${formatCurrencyFromOreTrimmed(ore)}${NBSP}kr.`;

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
 * `deltaPct` afrundes til `decimals` decimaler (`halfAwayFromZero`, default 2); afrunder
 * den til `0`-faktor undertrykkes faktoren helt (returnerer `''`), så near-nul-regulering
 * ikke giver en støjende `"x (100 % + 0 %)"`-linje. Denne ene helper sikrer at
 * faktorteksten er ens i hovedopgørelsen, offentlige-ydelser-bilaget og TAF-fordelt-på-år.
 *
 * `decimals` overstyres til 4 for opreguleringsfaktoren i "TAF opreguleret til
 * beregningsåret", hvor faktoren bevidst vises (og beregnes) med fire decimaler. Ved 2
 * decimaler bevares den trimmede visning; ved flere vises et fast antal decimaler.
 */
export const formatReguleringFactorText = (deltaPct: number, decimals: number = 2): string => {
  if (!Number.isFinite(deltaPct)) return '';
  const rounded = roundByMethod(deltaPct, decimals, 'halfAwayFromZero');
  if (rounded === 0) return '';
  const pctText = decimals === 2 ? formatPercentDelta(rounded) : formatAsAmount(Math.abs(rounded), decimals);
  return ` x (100 % ${rounded > 0 ? '+' : '-'} ${pctText} %)`;
};

/**
 * Formaterer måneder med dokumentets fælles månedspræcision (ingen trimming af trailing zeros).
 * Trailing zeros bevares for visuel rækkekonsistens i tabeller, fx i EET-periodetabellen,
 * hvor "1,00000" og "2,50000" skal flugte i samme kolonne.
 * Brug formatMaanederTrimmed i stedet, hvis trailing zeros er uønskede.
 *
 * BEVIDST UNDTAGELSE fra "vist tal = beregnet tal"-princippet: antal måneder VISES med
 * dokumentets fælles månedspræcision, men beregningen bruger månederne i FULD præcision (jf.
 * `sumMaanedsbroekForInterval`). Det er den eneste tilladte afvigelse fra kravet om at
 * brugeren altid kan efterregne de viste tal. Beslutningen må ikke omgøres uden specifik
 * stillingtagen. Alle øvrige afrundede tal skal indgå i beregningen med netop den viste,
 * afrundede værdi.
 */
export const formatMaanederFixed = (value: number): string => formatDocumentMaanederFixed(value);

export { DOCUMENT_MAANEDER_DECIMALS };

/**
 * Formaterer et reguleringsprocent-tal med fortegn: "+ X,YZ %" eller "- X,YZ %".
 * Trailing zeros trimmes (fx "22,81 %" frem for "22,8100 %").
 *
 * Fortegnet vælges ud fra den *afrundede* størrelse, ikke den rå værdi: en lille
 * negativ værdi der afrundes til 0 (fx -0,00001) skal vises som "+ 0 %", ikke
 * "- 0 %" – et negativt fortegn på nul er misvisende i et tillidskritisk dokument.
 */
export const formatReguleringPct = formatReguleringPctSigned;

export { isSingularCount } from '../../utils/formatUtils';
export { formatCountWithUnit } from '../../utils/formatUtils';
/** Kanonisk kr.-formatering (0 som standard) – genbruges fra UI-laget for at undgå dobbelt sandhed. */
export { formatKr } from '../../utils/formatUtils';
