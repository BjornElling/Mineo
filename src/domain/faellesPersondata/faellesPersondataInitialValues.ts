import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export const FAELLES_PERSONDATA_INITIAL_VALUES = {
  skadelidteFodselsdato: undefined,
} as const satisfies PersistedSectionMap['faellesPersondata'];
