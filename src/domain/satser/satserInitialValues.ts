import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';
import { getCurrentYear } from '../../config/dateRanges';
import { resolveSatserDefaultAargang } from '../policies/satserCalculations';

// Default-årgangen på Satser-siden er det aktuelle år, hvis det ligger inden for det
// satsdækkede interval – ellers det højeste år ≤ det aktuelle inden for intervallet
// (dvs. maxYear).
//
// Her tages året BEVIDST som et øjebliksbillede ved app-load, modsat de øvrige
// `getCurrentYear`-forbrug: `SATSER_INITIAL_VALUES` er et initialværdi-objekt, og dets
// referenceidentitet skal være stabil på tværs af renders. En getter her ville give et nyt
// objekt (eller en skiftende default) midt i en session og dermed kunne overskrive
// brugerens valgte årgang. Grænsen for hvad brugeren MÅ indtaste er derimod live –
// den ejes af feltvalidatorerne, ikke af denne default.
export const SATSER_INITIAL_VALUES = {
  aargang: resolveSatserDefaultAargang(
    getCurrentYear(),
    satserAngivAarYearBounds.minYear,
    satserAngivAarYearBounds.maxYear
  ),
} satisfies PersistedSectionMap['satser'];
