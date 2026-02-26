import type { DeepReadonly } from '../../types/deepReadonly';
import type { OevrigeKravRow } from '../../schemas/formSchemas';
import type { SvieSmerteEngineOutput } from './svieSmerteEngine';
import { parseOevrigeKravBeloeb } from './oevrigeKravAmountParser';

export type AggregatableComputed = Readonly<{
  amount: number;
}>;

export const adaptMoneyOreForAggregation = (ore: unknown): AggregatableComputed | null => {
  if (typeof ore !== 'number' || !Number.isFinite(ore) || !Number.isInteger(ore)) return null;
  return { amount: ore / 100 };
};

export const adaptSvieSmerteForAggregation = (
  output: DeepReadonly<SvieSmerteEngineOutput>
): AggregatableComputed | null => {
  return adaptMoneyOreForAggregation(output.totalOre);
};

export const adaptOevrigeKravForAggregation = (
  rows: DeepReadonly<ReadonlyArray<OevrigeKravRow>>
): AggregatableComputed | null => {
  const parsed = parseOevrigeKravBeloeb(rows);
  if (!parsed) return null;
  return adaptMoneyOreForAggregation(parsed.totalOre);
};
