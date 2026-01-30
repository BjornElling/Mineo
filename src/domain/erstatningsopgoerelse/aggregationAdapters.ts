import type { DeepReadonly } from '../../types/deepReadonly';
import type { RenteberegningOutput } from '../renteberegning/renteberegningEngine';
import type { TafEngineOutput } from './tafBeregningsEngine';
import type { VarigeMenEngineOutput } from '../varigemen/varigeMenEngine';

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
