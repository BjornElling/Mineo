import type { DeepReadonly } from '../../types/deepReadonly';
import type {
  ErstatningsopgoerelseValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import type { TafEngineOutput } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import type { AggregatableComputed } from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import {
  adaptOevrigeKravForAggregation,
  adaptSvieSmerteForAggregation,
  adaptTafForAggregation,
} from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import { ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY } from '../policy/erstatningsopgoerelse.policy';
import { aggregateErstatningsopgoerelse, type AggregationResult } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine';
import { computeTafEngine } from '../../domain/erstatningsopgoerelse/tafBeregningsEngine';
import { computeSvieSmerteEngine } from '../../domain/erstatningsopgoerelse/svieSmerteEngine';
import { computeTafBeregningsenhed } from '../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { isTafRowEmpty } from '../../domain/erstatningsopgoerelse/rowEmpty';
import { logError } from '../../utils/logger';

export type ErstatningsopgoerelseAggregationInputs = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  tafOutput?: TafEngineOutput | null;
  svieSmerteOutput?: AggregatableComputed | null;
}>;

export type ErstatningsopgoerelseAggregationSnapshot = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  stamdata?: Pick<StamdataValues, 'skadesdato' | 'skadestype'> | null;
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
  // oevrigeKrav beregnes fra committed EO-input via den kanoniske parser/summeringsfunktion
  // (parseOevrigeKravBeloeb) brugt af adapteren; ingen separat engine-spor.
  const oevrigeKrav = adaptOevrigeKravForAggregation(input.erstatningsopgoerelse.oevrigeKravPerioder ?? []);
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
      : {
          beregningsenhed: computeTafBeregningsenhed(snapshot.erstatningsopgoerelse),
          rows: [],
        };

  const svieSmerteOutput = tryCompute(() =>
    computeSvieSmerteEngine({
      erstatningsopgoerelse: snapshot.erstatningsopgoerelse,
      stamdata: snapshot.stamdata,
    })
  );
  const svieSmerteAggregated = svieSmerteOutput ? adaptSvieSmerteForAggregation(svieSmerteOutput) : null;

  return tryCompute(() =>
    computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: snapshot.erstatningsopgoerelse,
      tafOutput,
      svieSmerteOutput: svieSmerteAggregated,
    })
  );
};
