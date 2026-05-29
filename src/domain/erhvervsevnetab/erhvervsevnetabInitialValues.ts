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
    merErstatningPensionsalder: true,
    visUdvidetSpecifikation: false,
    visUdvidetSpecifikationLoebendeYdelserBilag: false,
  },
  endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: true,
  indregnMerErstatningVedForhoejetPensionsalder: true,
} satisfies PersistedSectionMap['erhvervsevnetab'];
