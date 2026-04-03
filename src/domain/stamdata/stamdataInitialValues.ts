import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export const STAMDATA_INITIAL_VALUES = {
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: '',
  skadelidteFodselsdato: undefined,
  skadestype: undefined,
  skadesdato: undefined,
} as const satisfies PersistedSectionMap['stamdata'];

