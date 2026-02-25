import type { DeepReadonly } from '../../types/deepReadonly';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { TafEngineOutput } from './tafBeregningsEngine';
import type { SvieSmerteEngineOutput } from './svieSmerteEngine';
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
