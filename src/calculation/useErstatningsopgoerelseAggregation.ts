import React from 'react';
import { usePersistedSection } from '../hooks/usePersistedSection';
import { computeRenteberegning } from '../domain/renteberegning/renteberegningEngine';
import { computeTafEngine } from '../domain/erstatningsopgoerelse/tafBeregningsEngine';
import { computeVarigeMenEngine } from '../domain/varigemen/varigeMenEngine';
import { computeErstatningsopgoerelseAggregation } from './pipeline/erstatningsopgoerelseAggregationPipeline';
import { getInterestRates } from '../data/interestRates';
import { varigeMenPrGrad } from '../data/regulationRates';
import type { AggregationResult } from '../domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine';

export const useErstatningsopgoerelseAggregation = (isActive: boolean): AggregationResult | null => {
  const stamdataValues = usePersistedSection('stamdata');
  const eoValues = usePersistedSection('erstatningsopgoerelse');
  const renteberegningValues = usePersistedSection('renteberegning');
  const varigeMenValues = usePersistedSection('varigemen');

  return React.useMemo(() => {
    if (!isActive || !eoValues) return null;

    const { referenceRates, surchargeRates } = getInterestRates();
    const tryCompute = <T>(context: string, compute: () => T): T | null => {
      try {
        return compute();
      } catch (error) {
        // Bevidst fail-closed i produktion: vi returnerer null-delresultat frem for at kaste i render-fasen.
        // Fejlen logges kun i DEV for at undgå produktionsstøj med potentielt følsomme data.
        if (import.meta.env.DEV) {
          console.warn(`Beregning afbrudt (${context}):`, error);
        }
        return null;
      }
    };

    const renteOutput =
      renteberegningValues && stamdataValues
        ? tryCompute('renteberegning', () =>
          computeRenteberegning({
            renteberegning: renteberegningValues,
            referenceRates,
            surchargeRates,
          })
        )
        : null;

    const tafOutput =
      eoValues.tafPerioder && eoValues.ferieperioder
        ? tryCompute('taf', () =>
          computeTafEngine({
            erstatningsopgoerelse: eoValues,
            tafPerioder: eoValues.tafPerioder,
            ferieperioder: eoValues.ferieperioder,
          })
        )
        : null;

    const varigtMenOutput = varigeMenValues
      ? tryCompute('varigt-men', () =>
        computeVarigeMenEngine({
          varigemen: varigeMenValues,
          skadestidspunkt: stamdataValues?.skadesdato,
          rates: varigeMenPrGrad,
        })
      )
      : null;

    return tryCompute('erstatningsopgoerelse-aggregation', () =>
      computeErstatningsopgoerelseAggregation({
        erstatningsopgoerelse: eoValues,
        renteOutput,
        tafOutput,
        varigtMenOutput,
      })
    );
  }, [isActive, eoValues, renteberegningValues, stamdataValues, varigeMenValues]);
};
