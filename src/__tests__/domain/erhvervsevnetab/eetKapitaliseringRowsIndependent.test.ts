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
  tidligereKapitaliseringsdato: null,
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
  it('bevarer den almindelige aldersrække uden en tidligere kapitalisering', () => {
    const rows = buildKapitaliseringAfgoerelseRows(baseAfgoerelse(), { koen: undefined, koenRowMode: 'always' });
    expect(rows).toContainEqual({ kind: 'labelValue', label: 'Alder ved kapitalisering', value: '59 år, 1 måneder' });
    expect(rows.some((row) => row.kind === 'labelValue' && row.label === 'Tidligere kapitaliseringsdato')).toBe(false);
  });

  it('navngiver den tidligere dato og alder ved genoptagelse på både skærm og i dokument', () => {
    const rows = buildKapitaliseringAfgoerelseRows({
      ...baseAfgoerelse(),
      kapitaliseringsdato: toISODateString('2021-10-01'),
      tidligereKapitaliseringsdato: toISODateString('2019-06-01'),
      alderAar: 63,
      alderMaaneder: 11,
    }, { koen: undefined, koenRowMode: 'whenPresent' });
    expect(rows).toEqual(expect.arrayContaining([
      { kind: 'labelValue', label: 'Kapitaliseringsdato', value: '01-10-2021' },
      { kind: 'labelValue', label: 'Tidligere kapitaliseringsdato', value: '01-06-2019' },
      { kind: 'labelValue', label: 'Alder ved tidligere kapitalisering', value: '63 år, 11 måneder' },
    ]));
    expect(rows.some((row) => row.kind === 'labelValue' && row.label === 'Alder ved kapitalisering')).toBe(false);
  });

  it('navngiver afgørelsens alder ved direkte særfaktor og en senere kapitaliseringsdato', () => {
    const rows = buildKapitaliseringAfgoerelseRows({
      ...baseAfgoerelse(),
      afgoerelsesdato: toISODateString('2021-10-01'),
      kapitaliseringsdato: toISODateString('2022-01-01'),
      kapitaliseretPgaUnderToAarTilFp: true,
      alderAar: 66,
      alderMaaneder: 3,
    }, { koen: undefined, koenRowMode: 'always' });
    expect(rows).toContainEqual({ kind: 'labelValue', label: 'Alder ved afgørelsen', value: '66 år, 3 måneder' });
    expect(rows.some((row) => row.kind === 'labelValue' && row.label === 'Tidligere kapitaliseringsdato')).toBe(false);
    expect(rows.some((row) => row.kind === 'labelValue' && row.label === 'Alder ved kapitalisering')).toBe(false);
  });

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
