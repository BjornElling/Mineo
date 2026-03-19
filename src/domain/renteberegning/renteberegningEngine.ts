import type { RateEntry } from '../../data/interestRates';
import type { RentekravRow, RenteberegningValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { DeepReadonly } from '../../types/deepReadonly';
import { danishToISO, isoToDanish } from '../../types/branded';
import { calculateProcessInterestWithRates } from './procesrenteCalculator';
import { calculateInterestDate, validateInterestCalculation, type InterestDateInput } from './rentekravValidation';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { roundByMethod } from '../../utils/rounding';

// Autoritativ aggregation engine:
// satser injiceres eksplicit som input-snapshot, og afrunding sker centralt her.

export type RenteberegningInputSnapshot = DeepReadonly<{
  renteberegning: RenteberegningValues;
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
}>;

export type RentekravResult = Readonly<{
  id: string;
  actualInterestDate: ISODateString | null;
  calculatedInterest: number | null;
}>;

export type RenteberegningOutput = Readonly<{
  rows: ReadonlyArray<RentekravResult>;
}>;

const roundInterest = (value: number): number => {
  return roundByMethod(value, 2, 'halfAwayFromZero');
};

const resolveActualInterestDateIso = (rowValues: RentekravRow): ISODateString | null => {
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
  return danishToISO(result.value) ?? null;
};

const calculateRowInterest = (
  rowValues: RentekravRow,
  beregningsdato: ISODateString | undefined,
  referenceRates: ReadonlyArray<RateEntry>,
  surchargeRates: ReadonlyArray<RateEntry>
): RentekravResult => {
  const actualInterestDate = resolveActualInterestDateIso(rowValues);
  const renterFra = rowValues.renterFra;
  if (!actualInterestDate || !beregningsdato || !renterFra) {
    return { id: rowValues.id, actualInterestDate, calculatedInterest: null };
  }

  const danishRenterFra = isoToDanish(renterFra);
  const danishBeregningsdato = isoToDanish(beregningsdato);
  if (!danishRenterFra || !danishBeregningsdato) {
    return { id: rowValues.id, actualInterestDate, calculatedInterest: null };
  }

  const validationResult = validateInterestCalculation(
    danishRenterFra,
    amountValueToNumber(rowValues.belob),
    isoToDanish(actualInterestDate) ?? undefined,
    danishBeregningsdato
  );
  if (!validationResult.success) {
    return { id: rowValues.id, actualInterestDate, calculatedInterest: null };
  }

  const validated = validationResult.value;
  const calculatedInterest = calculateProcessInterestWithRates(
    validated.beloeb,
    validated.rentedato,
    validated.beregningsdato,
    referenceRates,
    surchargeRates
  );

  return {
    id: rowValues.id,
    actualInterestDate,
    calculatedInterest: calculatedInterest === null ? null : roundInterest(calculatedInterest),
  };
};

export const computeRenteberegning = (input: RenteberegningInputSnapshot): RenteberegningOutput => {
  const { renteberegning, referenceRates, surchargeRates } = input;
  const beregningsdato = renteberegning.beregningsdato;

  // Row order does not affect calculations; output preserves input order for stable rendering.
  const rows = renteberegning.rentekravRows.map((row) =>
    calculateRowInterest(row, beregningsdato, referenceRates, surchargeRates)
  );

  return { rows };
};
