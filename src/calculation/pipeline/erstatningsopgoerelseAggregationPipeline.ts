import type { DeepReadonly } from '../../types/deepReadonly';
import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { RenteberegningOutput } from '../../domain/renteberegning/renteberegningEngine';
import type { TafEngineOutput } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import type { VarigeMenEngineOutput } from '../../domain/varigemen/varigeMenEngine';
import type { AggregatableComputed } from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import { adaptRenteForAggregation, adaptTafForAggregation, adaptVarigtMenForAggregation } from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import { ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY } from '../policy/erstatningsopgoerelse.policy';
import { aggregateErstatningsopgoerelse, type AggregationResult } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine';
import { amountValueToNumber } from '../../utils/expressionAmount';

export type ErstatningsopgoerelseAggregationInputs = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  renteOutput?: RenteberegningOutput | null;
  tafOutput?: TafEngineOutput | null;
  varigtMenOutput?: VarigeMenEngineOutput | null;
  eetOutput?: AggregatableComputed | null;
  svieSmerteOutput?: AggregatableComputed | null;
  loenindkomstOutput?: AggregatableComputed | null;
  offentligeYdelserOutput?: AggregatableComputed | null;
}>;

export const computeErstatningsopgoerelseAggregation = (
  input: ErstatningsopgoerelseAggregationInputs
): AggregationResult => {
  const computedOutputs: Record<string, AggregatableComputed> = {};
  const oevrigeKravRows = input.erstatningsopgoerelse.oevrigeKravPerioder ?? [];
  const oevrigeKravAmount = oevrigeKravRows.reduce((sum, row) => {
    const amount = amountValueToNumber(row.beloeb);
    return amount === undefined ? sum : sum + amount;
  }, 0);

  // NOTE: Aggregation is fail-closed; EET adapter/engine is a gating dependency.
  if (input.renteOutput) {
    const adapted = adaptRenteForAggregation(input.renteOutput);
    if (adapted) computedOutputs.rente = adapted;
  }
  if (input.tafOutput) {
    const adapted = adaptTafForAggregation(input.tafOutput);
    if (adapted) computedOutputs.taf = adapted;
  }
  if (input.varigtMenOutput) {
    const adapted = adaptVarigtMenForAggregation(input.varigtMenOutput);
    if (adapted) computedOutputs.varigtMen = adapted;
  }
  if (input.eetOutput) {
    computedOutputs.eet = input.eetOutput;
  }
  if (input.svieSmerteOutput) {
    computedOutputs.svieSmerte = input.svieSmerteOutput;
  }
  if (input.loenindkomstOutput) {
    computedOutputs.loenindkomst = input.loenindkomstOutput;
  }
  if (input.offentligeYdelserOutput) {
    computedOutputs.offentligeYdelser = input.offentligeYdelserOutput;
  }
  computedOutputs.oevrigeKrav = { amount: oevrigeKravAmount };

  return aggregateErstatningsopgoerelse({
    policy: ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY,
    computedOutputs,
  });
};
