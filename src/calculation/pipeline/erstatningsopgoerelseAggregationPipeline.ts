import type { DeepReadonly } from '../../types/deepReadonly';
import type {
  ErstatningsopgoerelseValues,
} from '../../schemas/formSchemas';
import type { TafEngineOutput } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import type { AggregatableComputed } from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import {
  adaptOevrigeKravForAggregation,
  adaptTafForAggregation,
} from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import { ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY } from '../policy/erstatningsopgoerelse.policy';
import { aggregateErstatningsopgoerelse, type AggregationResult } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine';
import { computeTafEngine } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import { isTafRowEmpty } from '../../domain/erstatningsopgoerelse/rowEmpty';
import { logError } from '../../utils/logger';

export type ErstatningsopgoerelseAggregationInputs = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  tafOutput?: TafEngineOutput | null;
  svieSmerteOutput?: AggregatableComputed | null;
  loenindkomstOutput?: AggregatableComputed | null;
  offentligeYdelserOutput?: AggregatableComputed | null;
}>;

export type ErstatningsopgoerelseAggregationSnapshot = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  svieSmerteOutput?: AggregatableComputed | null;
  loenindkomstOutput?: AggregatableComputed | null;
  offentligeYdelserOutput?: AggregatableComputed | null;
}>;

const tryCompute = <T>(compute: () => T): T | null => {
  try {
    return compute();
  } catch (error) {
    logError('Beregning fejlede i aggregation pipeline', {
      context: 'calculation.erstatningsopgoerelseAggregationPipeline',
      error: error instanceof Error ? error : undefined,
    });
    return null;
  }
};

export const computeErstatningsopgoerelseAggregation = (
  input: ErstatningsopgoerelseAggregationInputs
): AggregationResult => {
  const computedOutputs: Record<string, AggregatableComputed> = {};

  if (input.tafOutput) {
    const adapted = adaptTafForAggregation(input.tafOutput);
    if (adapted) computedOutputs.taf = adapted;
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
  const oevrigeKrav = adaptOevrigeKravForAggregation(input.erstatningsopgoerelse);
  if (oevrigeKrav) {
    computedOutputs.oevrigeKrav = oevrigeKrav;
  }

  return aggregateErstatningsopgoerelse({
    policy: ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY,
    computedOutputs,
  });
};

export const computeErstatningsopgoerelseAggregationFromSnapshot = (
  snapshot: ErstatningsopgoerelseAggregationSnapshot
): AggregationResult | null => {
  const shouldComputeTaf =
    snapshot.erstatningsopgoerelse.beregnesTabtArbejdsfortjeneste === 'Ja' &&
    snapshot.erstatningsopgoerelse.tafPerioder.some((row) => !isTafRowEmpty(row));

  const tafOutput =
    shouldComputeTaf
      ? tryCompute(() =>
        computeTafEngine({
          erstatningsopgoerelse: snapshot.erstatningsopgoerelse,
          tafPerioder: snapshot.erstatningsopgoerelse.tafPerioder,
          ferieperioder: snapshot.erstatningsopgoerelse.ferieperioder,
        })
      )
      : null;

  return tryCompute(() =>
    computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: snapshot.erstatningsopgoerelse,
      tafOutput,
      svieSmerteOutput: snapshot.svieSmerteOutput,
      loenindkomstOutput: snapshot.loenindkomstOutput,
      offentligeYdelserOutput: snapshot.offentligeYdelserOutput,
    })
  );
};
