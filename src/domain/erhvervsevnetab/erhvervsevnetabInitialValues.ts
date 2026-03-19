import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export const ERHVERVSEVNETAB_INITIAL_VALUES = {
  beregningsdato: undefined,
  koen: undefined,
  aslAfgoerelser: [],
  ealEetPct: undefined,
  eetDifferencekravBilagSelection: {
    loebendeYdelser: true,
    kapitalisering: true,
    eetEfterEal: true,
    proformaKapitalisering: true,
    visUdvidetSpecifikation: false,
    visUdvidetSpecifikationLoebendeYdelserBilag: false,
  },
} satisfies PersistedSectionMap['erhvervsevnetab'];
