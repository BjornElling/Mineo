import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export const STAMDATA_INITIAL_VALUES = {
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: '',
  skadestype: undefined,
  skadesdato: undefined,
  fodselsdato: undefined,
} as const satisfies PersistedSectionMap['stamdata'];

