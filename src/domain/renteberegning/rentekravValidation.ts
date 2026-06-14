/**
 * Domain-funktioner til renteberegning
 *
 * Disse funktioner indeholder ren forretningslogik uden UI-afhængigheder.
 * De er deterministiske, testbare og kan bruges til både UI og PDF.
 */

import type { ISODateString } from '../../types/branded';
import { isISODateString, parseISODate, dateToISO } from '../../types/branded';
import type { Result } from '../../types/result';
import { addMonths } from '../../utils/dateUtils';
import { MIN_INTEREST_DATE, MIN_SURCHARGE_DATE } from '../../data/interestRates';

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
  | 'INVALID_DATE_ORDER'     // Kravet-dato efter beregningsdato
  | 'DATE_BEFORE_RATE_COVERAGE'; // Rentedato før tilgængelige rente-/tillægssatser

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
  readonly kravetDato: ISODateString;
  readonly tillaegstid: number;
  readonly enhed: TimeUnit;
};

/**
 * Valideret input til renteberegning
 */
export type ValidatedInterestInput = {
  readonly beloeb: number;
  readonly rentedato: ISODateString;
  readonly beregningsdato: ISODateString;
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
): Result<ISODateString, DateCalculationError> {
  const { kravetDato, tillaegstid, enhed } = input;

  // Validér kravet-dato
  if (!kravetDato || !kravetDato.trim()) {
    return { success: false, error: 'MISSING_INPUT' };
  }

  // Parser til Date-objekt (UTC-dag)
  const kravetDate = parseISODate(kravetDato);
  if (!kravetDate) {
    return { success: false, error: 'DATE_PARSE_ERROR' };
  }

  // FORRETNINGSREGEL: Hvis tillægstid ≤ 0, ignorer enhed og returner kravet-dato
  // Dette er domain-logik - UI skal IKKE håndtere denne regel
  if (tillaegstid <= 0) {
    return { success: true, value: kravetDato };
  }

  // Beregn ny dato baseret på enhed
  let resultDate = new Date(kravetDate.getTime());

  switch (enhed) {
    case 'dage': {
      resultDate.setUTCDate(resultDate.getUTCDate() + tillaegstid);
      break;
    }

    case 'uger': {
      resultDate.setUTCDate(resultDate.getUTCDate() + (tillaegstid * 7));
      break;
    }

    case 'maaneder': {
      // Månedstillæg bruger den kanoniske addMonths (dateUtils), der clamper til
      // sidste dag i mål-måneden. "1 måned efter 31. januar" bliver derfor udgangen
      // af februar (28/29-02), ikke begyndelsen af marts. Dette er ÉN sandhed for
      // "læg X måneder til en dato" på tværs af kodebasen (ingen rå setUTCMonth-rollover).
      resultDate = addMonths(resultDate, tillaegstid);
      break;
    }

    default:
      return { success: false, error: 'INVALID_UNIT' };
  }

  const isoResult = dateToISO(resultDate);
  if (!isoResult) {
    return { success: false, error: 'DATE_PARSE_ERROR' };
  }

  return { success: true, value: isoResult };
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
  kravetDato: ISODateString | undefined,
  beloeb: number | undefined,
  rentedato: ISODateString | undefined,
  beregningsdato: ISODateString | undefined
): Result<ValidatedInterestInput, ValidationError> {
  // Validér kravet-dato
  if (!kravetDato || !kravetDato.trim()) {
    return { success: false, error: 'MISSING_KRAVET_DATO' };
  }

  if (!isISODateString(kravetDato)) {
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

  if (!isISODateString(rentedato) || !isISODateString(beregningsdato)) {
    return { success: false, error: 'INVALID_DATE_ORDER' };
  }

  // ISO-strenge (åååå-mm-dd) er leksikografisk sammenlignelige som datoer.
  if (rentedato < MIN_INTEREST_DATE || rentedato < MIN_SURCHARGE_DATE) {
    return { success: false, error: 'DATE_BEFORE_RATE_COVERAGE' };
  }

  // Tjek dato-rækkefølge
  if (rentedato > beregningsdato) {
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
