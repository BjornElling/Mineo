import type { DeepReadonly } from '../../types/deepReadonly';
import type {
  ErstatningsopgoerelseValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import { erstatningsopgoerelseSchema } from '../../schemas/formSchemas';
import type { AggregatableComputed } from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import {
  adaptMoneyOreForAggregation,
  adaptOevrigeKravForAggregation,
  adaptSvieSmerteForAggregation,
} from '../../domain/erstatningsopgoerelse/aggregationAdapters';
import { ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY } from '../policy/erstatningsopgoerelse.policy';
import { aggregateErstatningsopgoerelse, type AggregationResult } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine';
import { computeSvieSmerteEngine } from '../../domain/erstatningsopgoerelse/svieSmerteEngine';
import { isTafRowEmpty } from '../../domain/erstatningsopgoerelse/rowEmpty';
import { logError } from '../../utils/logger';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { computeTafNettoBeregning } from '../../domain/erstatningsopgoerelse/tafNettoBeregning';

export type ErstatningsopgoerelseAggregationInputs = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  tafOutput?: AggregatableComputed | null;
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
    computedOutputs.taf = input.tafOutput;
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

  const tafOutput = shouldComputeTaf
    ? tryCompute(() => {
      // Snapshot-input er DeepReadonly; vi parser gennem schema for at få et sikkert,
      // runtime-valideret mutable EO-objekt til downstream beregninger.
      const mutableEoValues = erstatningsopgoerelseSchema.parse(snapshot.erstatningsopgoerelse);
      // Stamdata er valgfrit i snapshot; downstream-beregninger håndterer
      // undefined skadesdato/skadestype defensivt og kaster ved ufuldstændigt input.
      const safeStamdata: StamdataValues = {
        ...STAMDATA_INITIAL_VALUES,
        ...(snapshot.stamdata ?? {}),
      };
      const tafNetto = computeTafNettoBeregning(mutableEoValues, safeStamdata);
      const adapted = adaptMoneyOreForAggregation(tafNetto.tabtArbejdsfortjenesteOre);
      if (!adapted) {
        throw new Error('TAF-netto kunne ikke konverteres til aggregation-beløb');
      }
      return adapted;
    })
    : ({ amount: 0 } as const);

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
