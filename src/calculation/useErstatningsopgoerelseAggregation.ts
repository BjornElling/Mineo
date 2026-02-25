import { useMemo } from 'react';
import { usePersistedSection } from '../hooks/usePersistedSection';
import { computeErstatningsopgoerelseAggregationFromSnapshot } from './pipeline/erstatningsopgoerelseAggregationPipeline';
import type { AggregationResult } from '../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine';

// Beholdes bevidst: computeErstatningsopgoerelseAggregation bruges af dedikerede pipeline-tests.
// Snapshot-entrypointet bruger committed EO-input + stamdata og orkestrerer interne engines.
export const useErstatningsopgoerelseAggregation = (isActive: boolean): AggregationResult | null => {
  const eoValues = usePersistedSection('erstatningsopgoerelse');
  const stamdataValues = usePersistedSection('stamdata');

  return useMemo(() => {
    if (!isActive || !eoValues) return null;
    return computeErstatningsopgoerelseAggregationFromSnapshot({
      erstatningsopgoerelse: eoValues,
      stamdata: stamdataValues
        ? {
            skadesdato: stamdataValues.skadesdato,
            skadestype: stamdataValues.skadestype,
          }
        : null,
    });
  }, [isActive, eoValues, stamdataValues]);
};
