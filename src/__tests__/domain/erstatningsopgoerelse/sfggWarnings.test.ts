import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeSygeferiegodtgoerelse } from '../../../domain/erstatningsopgoerelse/engines/sfggEngine';
import {
  buildSfggGammelReferenceperiodeBesked,
  buildSfggSeksMaanederBesked,
  findSfggSixMonthWarningEmploymentIds,
  harSfggSygeloenUdenLoenraekker,
  resolveSfggGamleReferenceperiodeAdvarsler,
} from '../../../domain/erstatningsopgoerelse/engines/sfggWarnings';
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
    tafRangesSidenSkaden: [{ fra: iso(tafFra), til: iso(tafFra) }],
    reguleringOpslagPerAnsaettelse: new Map(),
  });
  return { values, result };
};

describe('resolveSfggGamleReferenceperiodeAdvarsler', () => {
  it.each(['Manuelt angivet', 'Manuel procentsats'] as const)('advarer kun ud over 12 måneder ved %s', (form) => {
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaTabtArbejdsfortjeneste = 'Ja';
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2025-02-28');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({ loenudviklingBeregningsgrundlag: form })];
    values.sfggAnsaettelsesforhold = [{ ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven', sfggReferenceperiodeTil: iso('2024-01-28') }];
    const params = { values, stamdata: STAMDATA_INITIAL_VALUES };
    expect(resolveSfggGamleReferenceperiodeAdvarsler(params)).toEqual([
      { employmentId: 'af-1', reguleringsdato: iso('2025-02-28') },
    ]);
    values.sfggAnsaettelsesforhold[0].sfggReferenceperiodeTil = iso('2024-02-28');
    expect(resolveSfggGamleReferenceperiodeAdvarsler(params)).toEqual([]);
    values.sfggAnsaettelsesforhold[0].sfggReferenceperiodeTil = iso('2024-03-28');
    expect(resolveSfggGamleReferenceperiodeAdvarsler(params)).toEqual([]);
  });

  it('bruger det globale manuelle valg ved angivet løn og ignorerer manuel SFGG-sats', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaTabtArbejdsfortjeneste = 'Ja';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2025-02-28');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({ loenudviklingBeregningsgrundlag: 'Ingen' })];
    values.sfggAnsaettelsesforhold = [{ ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven', sfggReferenceperiodeTil: iso('2024-01-28') }];
    expect(resolveSfggGamleReferenceperiodeAdvarsler({ values, stamdata: STAMDATA_INITIAL_VALUES })).toEqual([
      { employmentId: 'af-1', reguleringsdato: iso('2025-02-28') },
    ]);
    values.sfggAnsaettelsesforhold[0].sfggBeregningskilde = 'Manuelt angivet';
    expect(resolveSfggGamleReferenceperiodeAdvarsler({ values, stamdata: STAMDATA_INITIAL_VALUES })).toEqual([]);
  });

  it('advarer ikke om en skjult referenceperiode (TAF-krav «Nej»)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaTabtArbejdsfortjeneste = 'Nej';
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2025-02-28');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({ loenudviklingBeregningsgrundlag: 'Manuelt angivet' })];
    values.sfggAnsaettelsesforhold = [{ ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven', sfggReferenceperiodeTil: iso('2024-01-28') }];
    expect(resolveSfggGamleReferenceperiodeAdvarsler({ values, stamdata: STAMDATA_INITIAL_VALUES })).toEqual([]);
  });

  it('navngiver reguleringsdatoen og konsekvensen (BB-324)', () => {
    expect(buildSfggGammelReferenceperiodeBesked(iso('2023-02-28'))).toBe(
      'Referenceperioden slutter mere end 12 måneder før reguleringsdatoen (28-02-2023) – satsen er regnet med lønnen på reguleringsdatoen uden regulering'
    );
  });
});

describe('buildSfggSeksMaanederBesked', () => {
  it('siger hvornår lønnen stopper, og hvor et ophør angives (BB-325)', () => {
    const { values } = buildWarningCase('2024-09-02');
    values.loenindkomstAnsaettelsesforhold[0] = { ...values.loenindkomstAnsaettelsesforhold[0]!, navnPaaArbejdssted: 'Firma A' };
    expect(buildSfggSeksMaanederBesked(values, values.loenindkomstAnsaettelsesforhold[0]!)).toBe(
      "Der er ikke registreret løn fra Firma A efter 31-01-2024. Er skadelidte opsagt, angives det under 'Opsagt fra stillingen' – retten til sygeferiegodtgørelse ophører da."
    );
  });

  it('udelader datoen uden registreret løn (BB-325, 2026-10-30)', () => {
    const { values } = buildWarningCase('2024-09-02', 0);
    values.loenindkomstAnsaettelsesforhold[0] = { ...values.loenindkomstAnsaettelsesforhold[0]!, navnPaaArbejdssted: 'Firma A' };
    expect(buildSfggSeksMaanederBesked(values, values.loenindkomstAnsaettelsesforhold[0]!)).toBe(
      "Der er ikke registreret løn fra Firma A. Er skadelidte opsagt, angives det under 'Opsagt fra stillingen' – retten til sygeferiegodtgørelse ophører da."
    );
  });
});

describe('harSfggSygeloenUdenLoenraekker', () => {
  const caseFor = (foerstEfterSygeloen: 'Ja' | 'Nej', medLoenIPerioden: boolean) => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      indtaegtsoplysningerTableData: medLoenIPerioden ? [{
        id: 'loen-mar-2024',
        col0_maaned: '3',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(30000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }] : [],
    })];
    values.sfggAnsaettelsesforhold = [{
      ...createSfggIngenRow('af-1'),
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmount(250),
      sfggManuelFoerstEfterSygeloen: foerstEfterSygeloen,
    }];
    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-03-01') },
      tafRanges: [{ fra: iso('2024-03-01'), til: iso('2024-05-31') }],
      tafRangesSidenSkaden: [{ fra: iso('2024-03-01'), til: iso('2024-05-31') }],
      reguleringOpslagPerAnsaettelse: new Map(),
    });
    return result.perAnsaettelsesforhold[0]!;
  };

  it('advarer, når «Ja» er valgt, men der ingen lønrækker er i erstatningsperioden (BB-326)', () => {
    expect(harSfggSygeloenUdenLoenraekker(caseFor('Ja', false))).toBe(true);
  });

  it('advarer ikke, når sygelønnen er trukket fra, eller valget er «Nej»', () => {
    expect(harSfggSygeloenUdenLoenraekker(caseFor('Ja', true))).toBe(false);
    expect(harSfggSygeloenUdenLoenraekker(caseFor('Nej', false))).toBe(false);
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

  it('regner uden registreret løn de seks måneder fra sygeferiegodtgørelsens første dag (BB-325)', () => {
    const kortVarig = buildWarningCase('2024-08-01', 0);
    expect(findSfggSixMonthWarningEmploymentIds(kortVarig)).toEqual([]);

    const langVarig = buildWarningCase('2024-08-01', 0);
    const [segment] = langVarig.result.perAnsaettelsesforhold[0]!.segments;
    const result = {
      ...langVarig.result,
      perAnsaettelsesforhold: [{
        ...langVarig.result.perAnsaettelsesforhold[0]!,
        segments: [segment!, { ...segment!, fra: iso('2025-02-02'), til: iso('2025-02-02') }],
      }],
    };
    expect(findSfggSixMonthWarningEmploymentIds({ values: langVarig.values, result })).toEqual(['af-1']);
  });

  it('tæller tillæg og arbejdsgiverpension som løn i Beløb-tilstand, ikke i Procent-tilstand (BB-325)', () => {
    const { values, result } = buildWarningCase('2024-08-01');
    const employment = values.loenindkomstAnsaettelsesforhold[0]!;
    const tillaegsraekke = {
      ...employment.indtaegtsoplysningerTableData[0]!,
      id: 'tillaeg-jul-2024',
      col0_maaned: '7',
      col2: undefined,
      fpFvShSoBeloeb: asAmount(500),
    };
    values.loenindkomstAnsaettelsesforhold = [{
      ...employment,
      indtaegtsoplysningerTableData: [...employment.indtaegtsoplysningerTableData, tillaegsraekke],
    }];
    expect(findSfggSixMonthWarningEmploymentIds({ values, result })).toEqual(['af-1']);

    values.loenindkomstAnsaettelsesforhold = [{ ...values.loenindkomstAnsaettelsesforhold[0]!, tillaegAngivesSom: 'beloeb' }];
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
