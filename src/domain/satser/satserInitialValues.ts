import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { satserAngivAarYearBounds } from '../../data/lovbestemteRates';

export const SATSER_INITIAL_VALUES = {
  aargang: satserAngivAarYearBounds.maxYear,
} as const satisfies PersistedSectionMap['satser'];
