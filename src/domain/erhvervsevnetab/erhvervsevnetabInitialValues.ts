import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export const ERHVERVSEVNETAB_INITIAL_VALUES = {
  beregningsdato: undefined,
  koen: undefined,
  aslAfgoerelser: [],
  aslAarsloen: undefined,
  ealAarsloen: undefined,
  ealEetPct: undefined,
} satisfies PersistedSectionMap['erhvervsevnetab'];
