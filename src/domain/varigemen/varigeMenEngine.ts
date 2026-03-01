import type { VarigeMenValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { YearlyRate } from '../../data/regulationRates';
import type { DeepReadonly } from '../../types/deepReadonly';
import { beregnVarigeMenGodtgoerelseWithRates, type VarigeMenBeregningResult } from './varigeMenCalculations';

export type VarigeMenEngineInputSnapshot = DeepReadonly<{
  varigemen: VarigeMenValues;
  fodselsdato: ISODateString | undefined;
  skadestidspunkt: ISODateString | undefined;
  rates: YearlyRate;
}>;

export type VarigeMenEngineOutput = Readonly<{
  result: VarigeMenBeregningResult | null;
}>;

export const computeVarigeMenEngine = (input: VarigeMenEngineInputSnapshot): VarigeMenEngineOutput => {
  const result = beregnVarigeMenGodtgoerelseWithRates(
    input.varigemen,
    input.skadestidspunkt,
    input.rates,
    input.fodselsdato
  );

  // Missing inputs yield null; this is a deliberate domain decision, not an error state.
  return { result };
};
