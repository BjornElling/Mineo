import type { DeepReadonly } from '../../types/deepReadonly';
import type { OevrigeKravRow } from '../../schemas/formSchemas';
import type { TafEngineOutput } from './tafBeregningsEngine';
import type { SvieSmerteEngineOutput } from './svieSmerteEngine';
import { parseOevrigeKravBeloeb } from './oevrigeKravAmountParser';

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

export const adaptTafForAggregation = (
  output: DeepReadonly<TafEngineOutput>
): AggregatableComputed | null => {
  const amount = sumFinite(output.rows.map((row) => row.value));
  return amount === null ? null : { amount };
};

export const adaptSvieSmerteForAggregation = (
  output: DeepReadonly<SvieSmerteEngineOutput>
): AggregatableComputed | null => {
  const ore = output.totalOre;
  if (typeof ore !== 'number' || !Number.isFinite(ore) || !Number.isInteger(ore)) return null;
  return { amount: ore / 100 };
};

export const adaptOevrigeKravForAggregation = (
  rows: DeepReadonly<ReadonlyArray<OevrigeKravRow>>
): AggregatableComputed | null => {
  const parsed = parseOevrigeKravBeloeb(rows);
  if (!parsed) return null;
  return { amount: parsed.totalOre / 100 };
};
