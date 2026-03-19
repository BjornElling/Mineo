import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export const FORSOERGERTAB_INITIAL_VALUES = {
  beregningsdato: undefined,
  virkningsdato: undefined,
  tilkendtForPeriodeAar: undefined,
} satisfies PersistedSectionMap['forsoergertab'];
