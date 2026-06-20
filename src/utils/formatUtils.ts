/**
 * Formatting utilities
 *
 * Centraliserede funktioner til formatering af tal, beløb og procenter.
 */

import { roundByMethod } from './rounding';
import { round4 } from './roundingShortcuts';
import { isWithinTolerance } from './numberComparison';
import { INPUT_UNIT_SUFFIX, appendInputUnitSuffix } from './inputUnit';

export const isSingularCount = (value: number): boolean => isWithinTolerance(value, 1);

/**
 * Gør første tegn i en streng til stort efter danske locale-regler (`da-DK`).
 * Tom streng returneres uændret. Brug denne kanoniske helper frem for ad hoc
 * `charAt(0).toUpperCase()`, så dansk-specifikke tegn håndteres ensartet.
 */
export const capitalizeFirstCharDa = (value: string): string =>
  value.length === 0 ? value : `${value.charAt(0).toLocaleUpperCase('da-DK')}${value.slice(1)}`;

export const formatCountWithUnit = (count: number, singular: string, plural: string): string =>
  `${formatAsAmountTrimmed(count, 2)} ${isSingularCount(count) ? singular : plural}`;

/**
 * Formaterer tal til dansk valuta-format
 */
export const formatCurrency = (num: number | undefined | null): string => {
  return formatAsAmount(num, 2);
};

/**
 * Kanonisk visning af et beløb som tekst MED enheden "kr." — det read-only-modstykke til det
 * adornment, redigerbare beløbsfelter viser (jf. `InputUnitAdornment`). Enheden hentes fra det ene
 * sande sted (`INPUT_UNIT_SUFFIX.currency`), ikke en parallel inline-streng, så alle beløbsvisninger
 * (PDF, Word og afledte grid-celler) deler præcis samme enhed. Brug denne i afledte/read-only
 * beløbsceller frem for `formatAsAmount`/`formatCurrency`, der bevidst er enhedsløse.
 */
export const formatKr = (value: number, precision: 0 | 2 = 0): string =>
  appendInputUnitSuffix(formatAsAmount(value, precision), INPUT_UNIT_SUFFIX.currency);

/**
 * Formaterer tal til dansk beløbsformat med valgfri precision.
 */
export const formatAsAmount = (value: number | null | undefined, precision: number = 2): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '';
  }

  const resolvedPrecision = Number.isFinite(precision) ? Math.max(0, Math.min(6, Math.trunc(precision))) : 2;
  const rounded = roundByMethod(value, resolvedPrecision, 'halfAwayFromZero');
  const isNegative = rounded < 0;
  const absoluteValue = Math.abs(rounded);

  const [integerPart, decimalPart = ''] = absoluteValue.toFixed(resolvedPrecision).split('.');
  const formatted = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (resolvedPrecision === 0) {
    return `${isNegative ? '-' : ''}${formatted}`;
  }
  return `${isNegative ? '-' : ''}${formatted},${decimalPart.padEnd(resolvedPrecision, '0')}`;
};

export const formatAsAmountTrimmed = (value: number | null | undefined, precision: number = 2): string => {
  const formatted = formatAsAmount(value, precision);
  if (formatted === '' || !formatted.includes(',')) {
    return formatted;
  }
  return formatted.replace(/,?0+$/, '');
};

/**
 * Formaterer procent-tal til dansk format
 * VIGTIGT: Procent-format følger en bevidst anden visningsregel end formatAsAmount:
 * trailing .00/.0 fjernes for mere kompakt UI-visning (fx "10 %" i stedet for "10,00 %").
 */
export const formatPercent = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return '';
  if (!Number.isFinite(num)) return '';

  const rounded = roundByMethod(num, 2, 'halfAwayFromZero');
  const formatted = rounded
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1')
    .replace('.', ',');
  return `${formatted} %`;
};

/**
 * Formaterer et procentpoint-tal med op til 4 decimaler (afrundet halfAwayFromZero) og
 * trimmede trailing nuller. Tilføjer IKKE selv "%"-suffiks — kalderen styrer enhedsvisningen.
 * Bruges af EET-aldersreduktion/EAL og forsørgertab til kompakt procentvisning.
 */
export const formatPercentTrimmedFromRounded4 = (value: number): string => {
  return formatAsAmountTrimmed(round4(value), 4);
};
