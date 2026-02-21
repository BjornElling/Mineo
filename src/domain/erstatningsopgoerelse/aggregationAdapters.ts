import type { DeepReadonly } from '../../types/deepReadonly';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { RenteberegningOutput } from '../renteberegning/renteberegningEngine';
import type { TafEngineOutput } from './tafBeregningsEngine';
import type { VarigeMenEngineOutput } from '../varigemen/varigeMenEngine';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { isOevrigeKravRowEmpty } from './rowEmpty';

export type AggregatableComputed = Readonly<{
  amount: number;
}>;

const sumFinite = (values: ReadonlyArray<number | null | undefined>): number | null => {
  let total = 0;
  for (const value of values) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    total += value;
  }
  return total;
};

export const adaptRenteForAggregation = (
  output: DeepReadonly<RenteberegningOutput>
): AggregatableComputed | null => {
  const amount = sumFinite(output.rows.map((row) => row.calculatedInterest));
  return amount === null ? null : { amount };
};

export const adaptTafForAggregation = (
  output: DeepReadonly<TafEngineOutput>
): AggregatableComputed | null => {
  const amount = sumFinite(output.rows.map((row) => row.value));
  return amount === null ? null : { amount };
};

export const adaptVarigtMenForAggregation = (
  output: DeepReadonly<VarigeMenEngineOutput>
): AggregatableComputed | null => {
  if (!output.result) return null;
  const amount = output.result.beregnetGodtgoerelse;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  return { amount };
};

export const adaptOevrigeKravForAggregation = (
  erstatningsopgoerelse: DeepReadonly<ErstatningsopgoerelseValues>
): AggregatableComputed | null => {
  const rows = (erstatningsopgoerelse.oevrigeKravPerioder ?? []).filter((row) => !isOevrigeKravRowEmpty(row));
  const amounts = rows.map((row) => {
    const value = amountValueToNumber(row.beloeb);
    return value === undefined ? null : value;
  });
  const amount = sumFinite(amounts);
  return amount === null ? null : { amount };
};
