import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeSygeferiegodtgoerelse } from '../../../domain/erstatningsopgoerelse/engines/sfggEngine';
import { findSfggSixMonthWarningEmploymentIds, findSfggManualReferenceWarningEmploymentIds } from '../../../domain/erstatningsopgoerelse/engines/sfggWarnings';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  asSfggAmount as asAmount,
  createSfggEmployment as createEmployment,
  createSfggIngenRow,
  sfggIso as iso,
} from '../../utils/sfggTestSupport';

const buildWarningCase = (tafFra: string, incomeValue = 10000) => {
  const values = createErstatningsopgoerelseInitialValues();
  values.eoNummer = '2';
  values.loenindkomstAnsaettelsesforhold = [createEmployment({
    indtaegtsoplysningerTableData: [{
      id: 'loen-jan-2024',
      col0_maaned: '1',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: asAmount(incomeValue),
      col3: undefined,
      col4: undefined,
      col5: undefined,
    }],
  })];
  values.sfggAnsaettelsesforhold = [{
    ansaettelsesforholdId: 'af-1',
    sfggBeregningskilde: 'Manuelt angivet',
    sfggManuelDagssats: asAmount(100),
    sfggManuelBeloebIHenholdTil: undefined,
    sfggManuelFoerstEfterSygeloen: 'Nej',
    sfggReferenceperiodeFra: undefined,
    sfggReferenceperiodeTil: undefined,
    sfggReferenceperiodeFravaersdageUdenLoen: 0,
    sfggSatsvalg: undefined,
    sfggAlleredeBetaltBeloeb: undefined,
  }];
  const result = computeSygeferiegodtgoerelse({
    values,
    stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
    tafRanges: [{ fra: iso(tafFra), til: iso(tafFra) }],
    reguleringOpslagPerAnsaettelse: new Map(),
  });
  return { values, result };
};

describe('findSfggManualReferenceWarningEmploymentIds', () => {
  it.each(['Manuelt angivet', 'Manuel procentsats'] as const)('advarer kun ud over 12 måneder ved %s', (form) => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2025-02-28');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({ loenudviklingBeregningsgrundlag: form })];
    values.sfggAnsaettelsesforhold = [{ ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven', sfggReferenceperiodeTil: iso('2024-01-28') }];
    const params = { values, stamdata: STAMDATA_INITIAL_VALUES };
    expect(findSfggManualReferenceWarningEmploymentIds(params)).toEqual(['af-1']);
    values.sfggAnsaettelsesforhold[0].sfggReferenceperiodeTil = iso('2024-02-28');
    expect(findSfggManualReferenceWarningEmploymentIds(params)).toEqual([]);
    values.sfggAnsaettelsesforhold[0].sfggReferenceperiodeTil = iso('2024-03-28');
    expect(findSfggManualReferenceWarningEmploymentIds(params)).toEqual([]);
  });

  it('bruger det globale manuelle valg ved angivet løn og ignorerer manuel SFGG-sats', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2025-02-28');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({ loenudviklingBeregningsgrundlag: 'Ingen' })];
    values.sfggAnsaettelsesforhold = [{ ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven', sfggReferenceperiodeTil: iso('2024-01-28') }];
    expect(findSfggManualReferenceWarningEmploymentIds({ values, stamdata: STAMDATA_INITIAL_VALUES })).toEqual(['af-1']);
    values.sfggAnsaettelsesforhold[0].sfggBeregningskilde = 'Manuelt angivet';
    expect(findSfggManualReferenceWarningEmploymentIds({ values, stamdata: STAMDATA_INITIAL_VALUES })).toEqual([]);
  });
});

describe('findSfggSixMonthWarningEmploymentIds', () => {
  it('markerer ansættelsesforhold hvor SFGG fortsætter mere end 6 måneder efter sidste lønindkomst', () => {
    const { values, result } = buildWarningCase('2024-08-01');

    expect(findSfggSixMonthWarningEmploymentIds({ values, result })).toEqual(['af-1']);
  });

  it('advarer ikke på selve seksmånedersgrænsen, men gør det dagen efter', () => {
    const atThreshold = buildWarningCase('2024-07-31');
    const afterThreshold = buildWarningCase('2024-08-01');

    expect(findSfggSixMonthWarningEmploymentIds(atThreshold)).toEqual([]);
    expect(findSfggSixMonthWarningEmploymentIds(afterThreshold)).toEqual(['af-1']);
  });

  it('ignorerer ansættelsesforhold uden positiv registreret lønindkomst', () => {
    const { values, result } = buildWarningCase('2024-08-01', 0);

    expect(findSfggSixMonthWarningEmploymentIds({ values, result })).toEqual([]);
  });

  it('ignorerer en positiv men ugyldig lønrække', () => {
    const { values, result } = buildWarningCase('2024-08-01');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      indtaegtsoplysningerTableData: [{
        id: 'ugyldig-maaned',
        col0_maaned: '13',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];

    expect(findSfggSixMonthWarningEmploymentIds({ values, result })).toEqual([]);
  });

  it('ignorerer ansættelsesforhold uden beregnet SFGG-resultat', () => {
    const { values, result } = buildWarningCase('2024-08-01');

    expect(findSfggSixMonthWarningEmploymentIds({
      values,
      result: { ...result, perAnsaettelsesforhold: [] },
    })).toEqual([]);
  });
});
