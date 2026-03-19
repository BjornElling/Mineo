import type { RentekravRow } from '../../schemas/formSchemas';
import type { DanishDateString, ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import { calculateProcessInterest } from './procesrenteCalculator';
import { calculateInterestDate, validateInterestCalculation, type InterestDateInput } from './rentekravValidation';
import { amountValueToNumber } from '../../utils/expressionAmount';

// Legacy per-row engine til tabelkontekst.
// Bruger `calculateProcessInterest` (globale satser + intern afrunding) for bagudkompatibel adfærd.
// Den aggregerede, rates-injicerede engine findes i `renteberegningEngine.ts`.

export type InterestCalculationIssue = Readonly<{
  message: string;
  context: string;
  error?: unknown;
}>;

export type ValidatedRentekravContext = Readonly<{
  actualInterestDate: DanishDateString;
  kravetDato: DanishDateString;
  beloeb: number;
  beregningsdato: DanishDateString;
  calculatedInterest: number;
}>;

export type RentekravCalculationResult = Readonly<{
  context: ValidatedRentekravContext | null;
  issue: InterestCalculationIssue | null;
  actualInterestDate: DanishDateString | null;
}>;

export const calculateActualInterestDate = (rowValues: RentekravRow): DanishDateString | null => {
  const danishDate = isoToDanish(rowValues.renterFra);
  if (!danishDate) return null;

  const tillaegstid = rowValues.tillaegstid ?? 0;
  const input: InterestDateInput = {
    kravetDato: danishDate,
    tillaegstid,
    enhed: rowValues.enhed,
  };

  const result = calculateInterestDate(input);
  if (!result.success) return null;
  return result.value;
};

export const computeRentekravCalculation = (
  committedRow: RentekravRow,
  beregningsdato: ISODateString | undefined
): RentekravCalculationResult => {
  const actualInterestDate = calculateActualInterestDate(committedRow);

  if (!actualInterestDate || !beregningsdato || !committedRow.renterFra) {
    return { context: null, issue: null, actualInterestDate };
  }

  const kravetDato = isoToDanish(committedRow.renterFra);
  const danishBeregningsdato = isoToDanish(beregningsdato);
  if (!kravetDato || !danishBeregningsdato) {
    return { context: null, issue: null, actualInterestDate };
  }

  const validationResult = validateInterestCalculation(
    kravetDato,
    amountValueToNumber(committedRow.belob),
    actualInterestDate,
    danishBeregningsdato
  );
  if (!validationResult.success) {
    return { context: null, issue: null, actualInterestDate };
  }

  try {
    const validated = validationResult.value;
    const calculatedInterest = calculateProcessInterest(validated.beloeb, validated.rentedato, validated.beregningsdato);
    if (calculatedInterest === null) {
      return {
        context: null,
        issue: { message: 'Renteberegning returnerede null', context: 'renteberegning.computeRentekravCalculation' },
        actualInterestDate,
      };
    }

    return {
      context: {
        actualInterestDate,
        kravetDato,
        beloeb: validated.beloeb,
        beregningsdato: validated.beregningsdato,
        calculatedInterest,
      },
      issue: null,
      actualInterestDate,
    };
  } catch (error) {
    return {
      context: null,
      issue: { message: 'Fejl ved renteberegning', context: 'renteberegning.computeRentekravCalculation', error },
      actualInterestDate,
    };
  }
};
