/**
 * Formattering-utilities til EOInspektion display-værdier
 *
 * VIGTIGT: Domain-funktioner returnerer rå værdier.
 * Disse funktioner bruges kun til at generere displayValue.
 */

import type { ISODateString, DanishDateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { formatAsAmount } from '../../utils/formatUtils';

/**
 * Formaterer ISO-dato til dansk format (dd-mm-åååå)
 *
 * VIGTIGT: Returnerer altid string (aldrig undefined).
 * Dette er en præsentations-kontrakt - undefined/null bliver til '-'.
 *
 * @param iso - ISO-dato eller null
 * @returns Formateret dato eller '-'
 */
export function formatIsoValue(iso: ISODateString | null): string {
  if (!iso) return '-';
  try {
    const danish = isoToDanish(iso);
    // isoToDanish kan returnere undefined - fallback til ISO-format
    return danish ?? iso;
  } catch {
    return iso; // Fallback til ISO hvis konvertering fejler
  }
}

/**
 * Formaterer dansk dato til display
 *
 * @param danish - Dansk dato eller null
 * @returns Formateret dato eller '-'
 */
export function formatDanishValue(danish: DanishDateString | null): string {
  if (!danish) return '-';
  return danish;
}

/**
 * Formaterer beløb til kontrol-/gennemsyns-display med dansk format.
 *
 * @param amount - Beløb (kr.) eller null
 * @returns Formateret beløb (fx "1.234,56") eller '-'
 */
export function formatAmountDisplay(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  if (!Number.isFinite(amount)) return '-';
  return formatAsAmount(amount, 2);
}

/**
 * Formaterer procent til dansk format
 *
 * @param pct - Procent (som decimal, fx 0.05 = 5%) eller null
 * @param decimals - Antal decimaler (default: 2)
 * @returns Formateret procent (fx "5,00%") eller '-'
 */
export function formatPercentFromDecimal(
  pct: number | null | undefined,
  decimals: number = 2
): string {
  if (pct === null || pct === undefined) return '-';
  if (!Number.isFinite(pct)) return '-';
  const percentage = pct * 100;
  return `${formatAsAmount(percentage, decimals)}%`;
}

export const formatPercent = formatPercentFromDecimal;

/**
 * Formaterer boolean til Ja/Nej eller custom labels
 *
 * @param value - Boolean værdi
 * @param labels - Custom labels [true-label, false-label] (default: ['Ja', 'Nej'])
 * @returns Formateret værdi
 */
export function formatBoolean(
  value: boolean,
  labels: [string, string] = ['Ja', 'Nej']
): string {
  return value ? labels[0] : labels[1];
}

/**
 * Formaterer heltal til dansk format med tusindtalsseparator
 *
 * @param value - Heltal eller null
 * @returns Formateret heltal (fx "1.234") eller '-'
 */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  if (!Number.isFinite(value)) return '-';
  return formatAsAmount(value, 0);
}

/**
 * Formaterer decimal til dansk format
 *
 * @param value - Decimal eller null
 * @param decimals - Antal decimaler (default: 2)
 * @returns Formateret decimal (fx "123,45") eller '-'
 */
export function formatDecimal(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined) return '-';
  if (!Number.isFinite(value)) return '-';
  return formatAsAmount(value, decimals);
}

/**
 * Formaterer tekst-værdi (fallback for ukomplekse værdier)
 *
 * @param value - Værdi eller null
 * @returns Formateret værdi eller '-'
 */
export function formatTextValue(value: string | null | undefined): string {
  if (!value || value.trim() === '') return '-';
  return value;
}

/**
 * Formaterer antal dage
 *
 * @param days - Antal dage
 * @returns Formateret tekst (fx "5 dage" eller "1 dag")
 */
export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return '-';
  if (days === 1) return '1 dag';
  return `${formatInteger(days)} dage`;
}
