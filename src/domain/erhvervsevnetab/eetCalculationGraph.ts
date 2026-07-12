import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  reguleringssats,
} from '../../data/lovbestemteRates';
import { coerceToISODateString, type ISODateString } from '../../types/branded';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';
import {
  composeEetDifferencekravCalculation,
  filterAslRowsKnownAtBeregningsdato,
  type EetDifferencekravCalculationResult,
  type EetDifferencekravInput,
} from './eetDifferencekravCalculation';
import { computeEetEalCalculation } from './eetEalCalculation';
import { computeEetKapitaliseringCalculation } from './eetKapitaliseringCalculation';
import { computeEetLoebendeYdelser } from './eetLoebendeYdelserCalculation';

export type EetDifferencekravGraphInput = Omit<EetDifferencekravInput, 'dependencies'>;

/**
 * Bygger differencekravets beregningsgraf eksplicit. Difference-aggregatoren må ikke selv
 * starte søsterberegninger, fordi deres filtrerede input og ophørsdato ellers skjules i et
 * tilsyneladende rent aggregatorkald.
 */
export const computeEetDifferencekravCalculation = (
  input: EetDifferencekravGraphInput
): EetDifferencekravCalculationResult => {
  const beregningsdato = coerceToISODateString(input.erhvervsevnetab.beregningsdato);
  const filteredErhvervsevnetab = {
    ...input.erhvervsevnetab,
    aslAfgoerelser: [...filterAslRowsKnownAtBeregningsdato(
      input.erhvervsevnetab.aslAfgoerelser,
      beregningsdato
    )],
  };

  const ealResult = computeEetEalCalculation({
    erhvervsevnetab: filteredErhvervsevnetab,
    skadedato: input.skadedato,
    skadelidteFodselsdato: input.skadelidteFodselsdato,
    reguleringssats,
    erhvervsevnetabEalMax,
    aarsloenAslMax,
  });
  const kapResult = computeEetKapitaliseringCalculation({
    erhvervsevnetab: filteredErhvervsevnetab,
    skadedato: input.skadedato,
    skadelidteFodselsdato: input.skadelidteFodselsdato,
  });

  let dagFoerBeregningsdato: ISODateString | null = null;
  let loebendeResult: ReturnType<typeof computeEetLoebendeYdelser> | null = null;
  if (beregningsdato) {
    dagFoerBeregningsdato = getDayBeforeIso(beregningsdato) ?? null;
    if (dagFoerBeregningsdato) {
      loebendeResult = computeEetLoebendeYdelser({
        erhvervsevnetab: {
          ...filteredErhvervsevnetab,
          beregningsdato: dagFoerBeregningsdato,
        },
        skadedato: input.skadedato,
        skadelidteFodselsdato: input.skadelidteFodselsdato,
      });
    }
  }

  return composeEetDifferencekravCalculation({
    ...input,
    dependencies: {
      filteredErhvervsevnetab,
      ealResult,
      kapResult,
      loebendeResult,
      dagFoerBeregningsdato,
    },
  });
};
