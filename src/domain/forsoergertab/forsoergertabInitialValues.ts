import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export const FORSOERGERTAB_INITIAL_VALUES = {
  efterladteFodselsdato: undefined,
  beregningsdato: undefined,
  virkningsdato: undefined,
  koen: undefined,
  tilkendtForPeriodeAar: undefined,
} satisfies PersistedSectionMap['forsoergertab'];
