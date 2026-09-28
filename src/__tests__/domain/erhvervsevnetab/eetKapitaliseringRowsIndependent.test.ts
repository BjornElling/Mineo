import {
  buildKapitaliseringAfgoerelseRows,
  SAERFAKTOR_UNDER_TO_AAR_LABEL,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringRows';
import type { EetKapitaliseringAfgoerelseComputation } from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import { fromKroner } from '../../../domain/money/money';
import { toISODateString } from '../../../types/branded';

const baseAfgoerelse = (): EetKapitaliseringAfgoerelseComputation => ({
  rowId: 'rows-independent',
  afgoerelsesdato: toISODateString('2024-01-15'),
  kapitaliseringsdato: toISODateString('2024-02-01'),
  eetPct: 25,
  kapitaliseringspct: 25,
  grundloenOre: fromKroner(332955),
  erstatningsniveauPct: 83,
  amBidragPct: 8,
  grundydelseOre: fromKroner(63561.11),
  grundydelse2024Ore: fromKroner(105320.76),
  opreguleringTil2024PctRounded4: 65.7,
  aarsydelseGrundlagOre: fromKroner(105320.76),
  aarsydelseReguleringsPctRounded4: null,
  aarsydelseOre: fromKroner(105320.76),
  kapitaliseringsfaktor: 5.479,
  kapitalbelobOre: fromKroner(577053),
  saerfaktor: 1.245,
  kapitaliseretPgaUnderToAarTilFp: false,
  faktorMaanedsAfhaengig: true,
  alderAar: 59,
  alderMaaneder: 1,
  kapitaliseringsbekendtgoerelseLabel: 'Vejl. 9820/2023, tabel F',
  tabelLabel: 'F',
  folkepensionsalderLabel: '68 år',
  koenOpdelt: false,
});

describe('buildKapitaliseringAfgoerelseRows – defensive visningsfacitter', () => {
  it('viser bindestreg, når særfaktoren mangler i ≤2-årsgrenen', () => {
    const rows = buildKapitaliseringAfgoerelseRows({
      ...baseAfgoerelse(),
      kapitaliseretPgaUnderToAarTilFp: true,
      saerfaktor: null,
    }, {
      koen: 'Kvinde',
      koenRowMode: 'whenPresent',
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'labelValue',
        label: SAERFAKTOR_UNDER_TO_AAR_LABEL,
        value: '-',
      }),
    ]));
  });

  it('viser en tom kønsrække, når UI-tilstanden kræver rækken uden kønsværdi', () => {
    const rows = buildKapitaliseringAfgoerelseRows({
      ...baseAfgoerelse(),
      koenOpdelt: true,
    }, {
      koen: undefined,
      koenRowMode: 'always',
    });

    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'labelValue',
        label: 'Køn',
        value: '',
      }),
    ]));
  });
});
