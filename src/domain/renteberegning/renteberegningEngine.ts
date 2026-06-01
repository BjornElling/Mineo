import type { RateEntry } from '../../data/interestRates';
import type { RentekravRow, RenteberegningValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { DeepReadonly } from '../../types/deepReadonly';
import { dateToISO } from '../../types/branded';
import {
  calculateProcessInterestBreakdownWithRates,
  findLatestReferenceRatePeriodEnd,
  type ProcessInterestPeriod,
} from './procesrenteCalculator';
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
  periods: ReadonlyArray<ProcessInterestPeriod> | null;
}>;

export type RenteberegningOutput = Readonly<{
  rows: ReadonlyArray<RentekravResult>;
}>;

const roundInterest = (value: number): number => {
  return roundByMethod(value, 2, 'halfAwayFromZero');
};

type RentekravComputation = Readonly<{
  id: string;
  actualInterestDate: ISODateString | null;
  calculatedInterest: number | null;
  periods: ReadonlyArray<ProcessInterestPeriod> | null;
}>;

const resolveActualInterestDateIso = (rowValues: RentekravRow): ISODateString | null => {
  const renterFra = rowValues.renterFra;
  if (!renterFra) return null;

  const tillaegstid = rowValues.tillaegstid ?? 0;
  const input: InterestDateInput = {
    kravetDato: renterFra,
    tillaegstid,
    enhed: rowValues.enhed,
  };

  const result = calculateInterestDate(input);
  if (!result.success) return null;
  return result.value;
};

const calculateRowInterest = (
  rowValues: RentekravRow,
  beregningsdato: ISODateString | undefined,
  refRates: ReadonlyArray<RateEntry>,
  surRates: ReadonlyArray<RateEntry>
): RentekravComputation => {
  const actualInterestDate = resolveActualInterestDateIso(rowValues);
  const renterFra = rowValues.renterFra;
  if (!actualInterestDate || !beregningsdato || !renterFra) {
    return { id: rowValues.id, actualInterestDate, calculatedInterest: null, periods: null };
  }

  const validationResult = validateInterestCalculation(
    renterFra,
    amountValueToNumber(rowValues.belob),
    actualInterestDate,
    beregningsdato
  );
  if (!validationResult.success) {
    return { id: rowValues.id, actualInterestDate, calculatedInterest: null, periods: null };
  }

  const validated = validationResult.value;
  const breakdown = (() => {
    try {
      return calculateProcessInterestBreakdownWithRates(
        validated.beloeb,
        validated.rentedato,
        validated.beregningsdato,
        refRates,
        surRates
      );
    } catch {
      return null;
    }
  })();

  return {
    id: rowValues.id,
    actualInterestDate,
    calculatedInterest: breakdown === null ? null : roundInterest(breakdown.totalInterest),
    periods: breakdown?.periods ?? null,
  };
};

export const computeRenteberegning = (input: RenteberegningInputSnapshot): RenteberegningOutput => {
  const { renteberegning, referenceRates: refRates, surchargeRates: surRates } = input;
  const beregningsdato = renteberegning.beregningsdato;

  const rows = renteberegning.rentekravRows.map((row) => {
    const result = (() => {
      try {
        return calculateRowInterest(row, beregningsdato, refRates, surRates);
      } catch {
        return {
          id: row.id,
          actualInterestDate: resolveActualInterestDateIso(row),
          calculatedInterest: null,
          periods: null,
        } satisfies RentekravComputation;
      }
    })();
    return {
      id: result.id,
      actualInterestDate: result.actualInterestDate,
      calculatedInterest: result.calculatedInterest,
      periods: result.periods,
    };
  });

  return { rows };
};

// Entry point pr. række til table-rendering. Callers skal sende det samme rate-snapshot,
// som de bruger til batch-beregninger, for at bevare determinisme på tværs af UI og tests.
export type RentekravRowResult = Readonly<{
  actualInterestDate: ISODateString | null;
  calculatedInterest: number | null;
  pdfContext: Readonly<{
    beloeb: number;
    actualInterestDate: ISODateString;
    beregningsdato: ISODateString;
    periods: ReadonlyArray<ProcessInterestPeriod>;
    latestReferenceRateDate: ISODateString | null;
    /** Autoritativt afrundet samlet rente for rækken (matcher tabellens "Beregnet rente"). */
    calculatedInterest: number;
  }> | null;
}>;

export const computeRentekravRow = (
  committedRow: RentekravRow,
  beregningsdato: ISODateString | undefined,
  refRates: ReadonlyArray<RateEntry>,
  surRates: ReadonlyArray<RateEntry>,
): RentekravRowResult => {
  let result: RentekravComputation;
  try {
    result = calculateRowInterest(committedRow, beregningsdato, refRates, surRates);
  } catch {
    return { actualInterestDate: resolveActualInterestDateIso(committedRow), calculatedInterest: null, pdfContext: null };
  }

  if (result.calculatedInterest === null || !result.actualInterestDate || !beregningsdato || result.periods === null) {
    return { actualInterestDate: result.actualInterestDate, calculatedInterest: null, pdfContext: null };
  }

  const beloeb = amountValueToNumber(committedRow.belob);
  if (beloeb === undefined) {
    return { actualInterestDate: result.actualInterestDate, calculatedInterest: null, pdfContext: null };
  }

  const latestReferenceRateDate = (() => {
    try {
      const latest = findLatestReferenceRatePeriodEnd(refRates);
      return latest ? (dateToISO(latest) ?? null) : null;
    } catch {
      return null;
    }
  })();

  return {
    actualInterestDate: result.actualInterestDate,
    calculatedInterest: result.calculatedInterest,
    pdfContext: {
      beloeb,
      actualInterestDate: result.actualInterestDate,
      beregningsdato,
      periods: result.periods,
      latestReferenceRateDate,
      calculatedInterest: result.calculatedInterest,
    },
  };
};
