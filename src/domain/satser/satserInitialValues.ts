import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';
import { CURRENT_YEAR } from '../../config/dateRanges';
import { resolveSatserDefaultAargang } from '../policies/satserCalculations';

// Default-årgangen på Satser-siden er det aktuelle år, hvis det ligger inden for det
// satsdækkede interval — ellers det højeste år ≤ det aktuelle inden for intervallet
// (dvs. maxYear). CURRENT_YEAR er en stabil modul-konstant (udledt af dags dato ved
// app-load), så SATSER_INITIAL_VALUES bevarer den stabile reference usePersistedForm kræver.
export const SATSER_INITIAL_VALUES = {
  aargang: resolveSatserDefaultAargang(
    CURRENT_YEAR,
    satserAngivAarYearBounds.minYear,
    satserAngivAarYearBounds.maxYear
  ),
} satisfies PersistedSectionMap['satser'];
