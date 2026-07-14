import { roundByMethod } from './rounding';

const LOG2_10 = Math.log2(10);
const MAX_DECIMAL_PRECISION = 15;

/**
 * Afgør om et decimaltal kan konverteres til `number` uden at miste enheder på
 * inputtets erklærede mindsteenhed. `precision` styrer altid binary64-gridgrænsen;
 * afsluttende decimalnuller kan fjernes fra selve significanden, men må ikke sænke
 * den erklærede præcision eller gøre grænsen kunstigt lempeligere.
 */
const getExclusiveSafeScaledBoundary = (precision: number): bigint | null => {
  if (!Number.isInteger(precision) || precision < 0 || precision > MAX_DECIMAL_PRECISION) return null;

  // Under 2^E er binary64-afstanden højst 2^(E-53). E vælges, så afstanden
  // er mindre end eller lig decimalfeltets mindsteenhed 10^-precision.
  // Udtrykket er positivt for den tilladte precision 0-15, så trunc svarer til floor
  // uden at omgå projektets centrale afrundingsregel for domæneberegninger.
  const magnitudeExponent = Math.trunc(53 - precision * LOG2_10);
  const scaledBinaryExponent = magnitudeExponent + precision;
  if (scaledBinaryExponent < 0) return null;
  return (2n ** BigInt(scaledBinaryExponent)) * (5n ** BigInt(precision));
};

export const hasSafeDecimalDigits = (
  integerDigits: string,
  decimalDigits: string,
  precision: number
): boolean => {
  if (!/^\d+$/.test(integerDigits) || !/^\d*$/.test(decimalDigits)) return false;
  const normalizedDecimal = decimalDigits.replace(/0+$/, '');
  if (normalizedDecimal.length > precision) return false;

  const scaledDigits = `${integerDigits}${normalizedDecimal.padEnd(precision, '0')}`
    .replace(/^0+(?=\d)/, '') || '0';
  return isSafeScaledInteger(BigInt(scaledDigits), precision);
};

/** Et heltal er kun canonical, når JavaScript kan bevare det uden afrunding. */
export const isSafeCanonicalInteger = (value: number): boolean => Number.isSafeInteger(value);

/**
 * Et frit `number` uden en erklæret decimalpræcision skal være endeligt og ligge
 * inden for JavaScripts sikre numeriske størrelsesorden. Decimalers konkrete
 * mindsteenhed kontrolleres med `isSafeCanonicalDecimal`, når den er kendt.
 */
export const isSafeCanonicalNumber = (value: number): boolean =>
  Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;

/**
 * Beløb gemmes som `number`, men deres autoritative mindste enhed er den valgte
 * decimalpræcision. Den skalerede heltalsværdi skal derfor være et sikkert heltal.
 */
export const isSafeCanonicalDecimal = (value: number, precision: number): boolean => {
  if (!Number.isFinite(value) || !Number.isInteger(precision) || precision < 0) return false;
  const factor = 10 ** precision;
  if (!Number.isFinite(factor)) return false;

  // Almindelige decimaler som 0,29 kan give 28,999999999999996 ved skalering.
  // Roundtrip gennem den canonical mindsteenhed skelner denne støj fra en reel
  // ekstra decimalplads som i 1,234 ved precision 2.
  const scaledValue = value * factor;
  const canonicalScaledInteger = roundByMethod(scaledValue, 0, 'halfAwayFromZero');
  if (!Number.isSafeInteger(canonicalScaledInteger)) return false;
  if (!isSafeScaledInteger(BigInt(canonicalScaledInteger), precision)) return false;

  const canonicalValue = canonicalScaledInteger / factor;
  if (Object.is(value, canonicalValue)) return true;

  const representationTolerance = Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(canonicalValue));
  return Math.abs(value - canonicalValue) <= representationTolerance;
};

/** BigInt-modstykket bruges før en eksakt rational værdi konverteres til `number`. */
export const isSafeScaledInteger = (value: bigint, precision: number): boolean => {
  const exclusiveBoundary = getExclusiveSafeScaledBoundary(precision);
  if (exclusiveBoundary === null) return false;
  const absolute = value < 0n ? -value : value;
  return absolute < exclusiveBoundary;
};
