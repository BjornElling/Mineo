import { aggregationPolicySchema } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationPolicy';

export const ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY_RAW = {
  outputMode: 'lineItems',
  lineRounding: { method: 'none', precision: 0 },
  totalRounding: { when: 'onlyTotal', method: 'halfAwayFromZero', precision: 0 },
  lines: [
    {
      id: 'taf',
      computedSourceId: 'taf',
      computedValuePath: 'amount',
      strategy: 'computedOnly',
      sign: 'positive',
    },
    {
      id: 'svieSmerte',
      computedSourceId: 'svieSmerte',
      computedValuePath: 'amount',
      strategy: 'computedOnly',
      sign: 'positive',
    },
    {
      id: 'loenindkomst',
      computedSourceId: 'loenindkomst',
      computedValuePath: 'amount',
      strategy: 'computedOnly',
      sign: 'positive',
    },
    {
      id: 'offentligeYdelser',
      computedSourceId: 'offentligeYdelser',
      computedValuePath: 'amount',
      strategy: 'computedOnly',
      sign: 'negative',
    },
    {
      id: 'oevrigeKrav',
      computedSourceId: 'oevrigeKrav',
      computedValuePath: 'amount',
      strategy: 'computedOnly',
      sign: 'positive',
    },
  ],
} as const;

export const ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY = aggregationPolicySchema.parse(
  ERSTATNINGSOPGOERELSE_AGGREGATION_POLICY_RAW
);
