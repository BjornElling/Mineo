/**
 * Delte formateringshjælpere for EET-PDF-generatorer.
 *
 * Bruges af differencekravPdf, loebendeYdelserPdf, kapitaliseringPdf og EetEfterEalPdf.
 */

import { formatAsAmount, formatAsAmountTrimmed } from '../formatUtils';

export const formatKrEet = (value: number, decimals = 0): string =>
  `${formatAsAmount(value, decimals)} kr.`;

export const formatJaNejEet = (value: boolean): string => (value ? 'Ja' : 'Nej');

/**
 * Formaterer en kapitaliseringsfaktor med op til 3 decimaler, trailing zeros trimmes.
 * Eksempel: 9.5 → "9,5", 8.000 → "8", 7.123 → "7,123"
 */
export const formatFaktorEet = (value: number): string => formatAsAmountTrimmed(value, 3);
