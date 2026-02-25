import { useMemo } from 'react';
import { usePersistedSection } from '../hooks/usePersistedSection';
import { computeErstatningsopgoerelseAggregationFromSnapshot } from './pipeline/erstatningsopgoerelseAggregationPipeline';
import type { AggregationResult } from '../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine';

// Beholdes bevidst: bruges af dedikerede aggregation-tests.
// Snapshot-kontrakten omfatter aktuelt kun committed EO-input.
export const useErstatningsopgoerelseAggregation = (isActive: boolean): AggregationResult | null => {
  const eoValues = usePersistedSection('erstatningsopgoerelse');

  return useMemo(() => {
    if (!isActive || !eoValues) return null;
    return computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eoValues,
    });
  }, [isActive, eoValues]);
};
