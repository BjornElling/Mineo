import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export const VARIGE_MEN_INITIAL_VALUES = {
  mengrad: undefined,
  beregningsdato: undefined,
} as const satisfies PersistedSectionMap['varigemen'];
