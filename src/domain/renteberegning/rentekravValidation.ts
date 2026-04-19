/**
 * Domain-funktioner til renteberegning
 *
 * Disse funktioner indeholder ren forretningslogik uden UI-afhængigheder.
 * De er deterministiske, testbare og kan bruges til både UI og PDF.
 */

import type { DanishDateString } from '../../types/branded';
import { danishToISO, isoToDanish, parseISODate, dateToISO } from '../../types/branded';
import type { Result } from '../../types/result';

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Fejltyper for dato-beregninger
 */
export type DateCalculationError =
  | 'MISSING_INPUT'          // Manglende påkrævet input
  | 'INVALID_DATE_FORMAT'    // Ugyldig datoformat
  | 'INVALID_DATE_VALUE'     // Ugyldig dato-værdi (fx 31. februar)
  | 'INVALID_UNIT'           // Ukendt tids-enhed
  | 'DATE_PARSE_ERROR';      // Generel parsing-fejl

/**
 * Fejltyper for beregnings-validering
 */
export type ValidationError =
  | 'MISSING_KRAVET_DATO'    // Manglende kravet-dato
  | 'INVALID_KRAVET_DATO'    // Ugyldig kravet-dato
  | 'MISSING_RENTEDATO'      // Manglende rentedato
  | 'MISSING_BEREGNING_DATO' // Manglende beregningsdato
  | 'INVALID_AMOUNT'         // Ugyldigt beløb (≤ 0 eller ikke-finit)
  | 'INVALID_DATE_ORDER';    // Kravet-dato efter beregningsdato

// ============================================================================
// DOMAIN TYPES
// ============================================================================

/**
 * Tids-enhed for tillægstid
 */
export type TimeUnit = 'dage' | 'uger' | 'maaneder';

/**
 * Input til rentedato-beregning
 *
 * VIGTIGT: enhed kan være null hvis tillægstid er irrelevant (≤0)
 * Domain-laget håndterer denne regel - UI skal sende rå data
 */
export type InterestDateInput = {
  readonly kravetDato: DanishDateString;
  readonly tillaegstid: number;
  readonly enhed: TimeUnit;
};

/**
 * Valideret input til renteberegning
 */
export type ValidatedInterestInput = {
  readonly beloeb: number;
  readonly rentedato: DanishDateString;
  readonly beregningsdato: DanishDateString;
};

// ============================================================================
// DATO-BEREGNING
// ============================================================================

/**
 * Beregner rentedato baseret på kravet-dato og tillægstid
 *
 * Forretningsregler:
 * - Hvis tillægstid ≤ 0: rentedato = kravet-dato
 * - Hvis tillægstid > 0: rentedato = kravet-dato + tillægstid (i valgt enhed)
 * - Enhed ignoreres hvis tillægstid ≤ 0
 */
export function calculateInterestDate(
  input: InterestDateInput
): Result<DanishDateString, DateCalculationError> {
  const { kravetDato, tillaegstid, enhed } = input;

  // Validér kravet-dato
  if (!kravetDato || !kravetDato.trim()) {
    return { success: false, error: 'MISSING_INPUT' };
  }

  // Konverter til ISO-format
  const isoKravetDato = danishToISO(kravetDato);
  if (!isoKravetDato) {
    return { success: false, error: 'INVALID_DATE_FORMAT' };
  }

  // Parser til Date-objekt
  const kravetDate = parseISODate(isoKravetDato);
  if (!kravetDate) {
    return { success: false, error: 'DATE_PARSE_ERROR' };
  }

  // FORRETNINGSREGEL: Hvis tillægstid ≤ 0, ignorer enhed og returner kravet-dato
  // Dette er domain-logik - UI skal IKKE håndtere denne regel
  if (tillaegstid <= 0) {
    return { success: true, value: kravetDato };
  }

  // Beregn ny dato baseret på enhed
  let resultDate: Date;

  switch (enhed) {
    case 'dage': {
      resultDate = new Date(kravetDate);
      resultDate.setUTCDate(resultDate.getUTCDate() + tillaegstid);
      break;
    }

    case 'uger': {
      resultDate = new Date(kravetDate);
      resultDate.setUTCDate(resultDate.getUTCDate() + (tillaegstid * 7));
      break;
    }

    case 'maaneder': {
      resultDate = new Date(kravetDate);
      // Normativt dokumenteret nuværende adfærd: månedstillæg følger JavaScripts
      // UTC-month rollover semantik. 31-01 + 1 måned bliver derfor 02-03 i skudår,
      // ikke klippet til sidste dag i februar. En egentlig "clip til månedsslut"
      // kræver en eksplicit domæneafgørelse.
      resultDate.setUTCMonth(resultDate.getUTCMonth() + tillaegstid);
      break;
    }

    default:
      return { success: false, error: 'INVALID_UNIT' };
  }

  // Konverter tilbage til dansk format
  const isoResult = dateToISO(resultDate);
  if (!isoResult) {
    return { success: false, error: 'DATE_PARSE_ERROR' };
  }

  const danishResult = isoToDanish(isoResult);
  if (!danishResult) {
    return { success: false, error: 'INVALID_DATE_FORMAT' };
  }

  return { success: true, value: danishResult };
}

// ============================================================================
// VALIDERING
// ============================================================================

/**
 * Validerer input til renteberegning
 *
 * Forretningsregler:
 * - Kravet-dato skal være udfyldt og gyldig
 * - Beløb skal være > 0 og finit
 * - Rentedato skal være udfyldt og gyldig
 * - Beregningsdato skal være udfyldt og gyldig
 * - Rentedato skal være ≤ beregningsdato
 */
export function validateInterestCalculation(
  kravetDato: DanishDateString | undefined,
  beloeb: number | undefined,
  rentedato: DanishDateString | undefined,
  beregningsdato: DanishDateString | undefined
): Result<ValidatedInterestInput, ValidationError> {
  // Validér kravet-dato
  if (!kravetDato || !kravetDato.trim()) {
    return { success: false, error: 'MISSING_KRAVET_DATO' };
  }

  if (!danishToISO(kravetDato)) {
    return { success: false, error: 'INVALID_KRAVET_DATO' };
  }

  // Validér beløb
  if (beloeb === undefined || beloeb <= 0 || !Number.isFinite(beloeb)) {
    return { success: false, error: 'INVALID_AMOUNT' };
  }

  // Validér rentedato
  if (!rentedato || !rentedato.trim()) {
    return { success: false, error: 'MISSING_RENTEDATO' };
  }

  // Validér beregningsdato
  if (!beregningsdato || !beregningsdato.trim()) {
    return { success: false, error: 'MISSING_BEREGNING_DATO' };
  }

  // Konverter til ISO for dato-sammenligning
  const isoRentedato = danishToISO(rentedato);
  const isoBeregningsdato = danishToISO(beregningsdato);

  if (!isoRentedato || !isoBeregningsdato) {
    return { success: false, error: 'INVALID_DATE_ORDER' };
  }

  // Tjek dato-rækkefølge
  if (isoRentedato > isoBeregningsdato) {
    return { success: false, error: 'INVALID_DATE_ORDER' };
  }

  return {
    success: true,
    value: {
      beloeb,
      rentedato,
      beregningsdato,
    },
  };
}
