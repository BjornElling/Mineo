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

    const renteOutput =
      renteberegningValues && stamdataValues
        ? computeRenteberegning({
            renteberegning: renteberegningValues,
            referenceRates,
            surchargeRates,
          })
        : null;

    const tafOutput =
      eoValues.tafPerioder && eoValues.ferieperioder
        ? computeTafEngine({
            erstatningsopgoerelse: eoValues,
            tafPerioder: eoValues.tafPerioder,
            ferieperioder: eoValues.ferieperioder,
          })
        : null;

    const varigtMenOutput = varigeMenValues
      ? computeVarigeMenEngine({
          varigemen: varigeMenValues,
          skadestidspunkt: stamdataValues?.skadesdato,
          rates: varigeMenPrGrad,
        })
      : null;

    return computeErstatningsopgoerelseAggregation({
      erstatningsopgoerelse: eoValues,
      renteOutput,
      tafOutput,
      varigtMenOutput,
    });
  }, [isActive, eoValues, renteberegningValues, stamdataValues, varigeMenValues]);
};
