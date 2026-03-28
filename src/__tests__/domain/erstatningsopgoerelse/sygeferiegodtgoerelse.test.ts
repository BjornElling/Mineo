import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import {
  buildSfggReferenceperiodeCountLabel,
  computeSygeferiegodtgoerelse,
  findSfggSixMonthWarningEmploymentIds,
} from '../../../domain/erstatningsopgoerelse/sygeferiegodtgoerelse';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const createEmployment = (
  patch: Partial<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]> = {}
): ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] => ({
  id: patch.id ?? 'af-1',
  navnPaaArbejdssted: patch.navnPaaArbejdssted ?? 'Arbejdssted 1',
  harOverenskomst: patch.harOverenskomst ?? false,
  overenskomstId: patch.overenskomstId,
  overenskomstFilter: patch.overenskomstFilter ?? { loenmodtager: undefined, arbejdsgiver: undefined },
  ansatPaaSkadestidspunktet: patch.ansatPaaSkadestidspunktet ?? true,
  ansaettelsesforholdOphoert: patch.ansaettelsesforholdOphoert ?? false,
  sidsteArbejdsdag: patch.sidsteArbejdsdag,
  feriePct: patch.feriePct,
  fritvalgPct: patch.fritvalgPct,
  shSoPct: patch.shSoPct,
  storeBededagPct: patch.storeBededagPct,
  pensionPct: patch.pensionPct ?? 0,
  loenperiode: patch.loenperiode ?? 'maaned',
  fuldLoenUnderFerie: patch.fuldLoenUnderFerie ?? 'Ja',
  harAnciennitetstillaegEfterSkadesdatoen: patch.harAnciennitetstillaegEfterSkadesdatoen ?? false,
  anciennitetstillaegDato: patch.anciennitetstillaegDato,
  anciennitetstillaegSatsAngivesPer: patch.anciennitetstillaegSatsAngivesPer ?? 'Måned',
  anciennitetstillaegSats: patch.anciennitetstillaegSats,
  loenPaaHelligdage: patch.loenPaaHelligdage ?? 'Almindelig løn',
  saerligFraDatoRegulering: patch.saerligFraDatoRegulering,
  loenudviklingBeregningsgrundlag: patch.loenudviklingBeregningsgrundlag,
  loenudviklingStatistikModel: patch.loenudviklingStatistikModel,
  loenudviklingKRLSatstabel: patch.loenudviklingKRLSatstabel,
  loenudviklingManuelNavn: patch.loenudviklingManuelNavn ?? '',
  loenudviklingManuelTableData: patch.loenudviklingManuelTableData ?? [],
  offentligLoenType: patch.offentligLoenType ?? 'Månedsløn',
  offentligLoenTrin: patch.offentligLoenTrin,
  offentligLoenGruppe: patch.offentligLoenGruppe,
  offentligLoenEkstraGrundloen: patch.offentligLoenEkstraGrundloen,
  indtaegtsoplysningerTableData: patch.indtaegtsoplysningerTableData ?? [],
  ...patch,
});

describe('computeSygeferiegodtgoerelse', () => {
  it('formaterer arbejdsdage-label med kun ikke-nul fradrag', () => {
    expect(buildSfggReferenceperiodeCountLabel({
      ferieberettigetLoenKroner: 0,
      feriePctDecimal: 0,
      feriepengeKroner: 0,
      divisorDage: 16,
      divisorLabel: 'arbejdsdage',
      kalenderdage: 0,
      hverdage: 21,
      shDage: 2,
      feriedage: 1,
      oevrigeFravaersdage: 2,
    })).toBe('Antal arbejdsdage (21 hverdage - 2 SH-dage - 3 ferie- og fraværsdage) =');

    expect(buildSfggReferenceperiodeCountLabel({
      ferieberettigetLoenKroner: 0,
      feriePctDecimal: 0,
      feriepengeKroner: 0,
      divisorDage: 18,
      divisorLabel: 'arbejdsdage',
      kalenderdage: 0,
      hverdage: 21,
      shDage: 0,
      feriedage: 1,
      oevrigeFravaersdage: 2,
    })).toBe('Antal arbejdsdage (21 hverdage - 3 ferie- og fraværsdage) =');
  });

  it('formaterer kalenderdage-label uden SH-dage', () => {
    expect(buildSfggReferenceperiodeCountLabel({
      ferieberettigetLoenKroner: 0,
      feriePctDecimal: 0,
      feriepengeKroner: 0,
      divisorDage: 30,
      divisorLabel: 'kalenderdage',
      kalenderdage: 31,
      hverdage: 23,
      shDage: 1,
      feriedage: 0,
      oevrigeFravaersdage: 1,
    })).toBe('Antal kalenderdage i perioden (31 kalenderdage - 1 fraværsdage u. løn) =');
  });

  it('beregner referencesatsen ud fra ferieberettiget løn og kun FP-satsen', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      fritvalgPct: 5,
      shSoPct: 4,
      storeBededagPct: 1,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggReferencesats.status).toBe('ok');
    if (result.perAnsaettelsesforhold[0]?.sfggReferencesats.status !== 'ok') {
      throw new Error('ReferenceSats forventedes beregnelig');
    }
    expect(result.perAnsaettelsesforhold[0].sfggReferencesats.value).toBe(5682);
    expect(result.perAnsaettelsesforhold[0].sfggReferencesatsFormula).toEqual({
      ferieberettigetLoenKroner: 10000,
      feriePctDecimal: 0.125,
      feriepengeKroner: 1250,
      divisorDage: 22,
      divisorLabel: 'arbejdsdage',
      kalenderdage: 31,
      hverdage: 23,
      shDage: 1,
      feriedage: 0,
      oevrigeFravaersdage: 0,
    });
  });

  it('fratrækker kun feriepenge af sygeløn efter FP-satsen i SFGG-perioden', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      fritvalgPct: 5,
      shSoPct: 4,
      storeBededagPct: 1,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
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
      sfggReferenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengekravOre).toBe(10000);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengeAfSygeloenOre).toBe(5682);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.beregnetSfggoereOre).toBe(4318);
  });

  it('samler SFGG-segmenter på tværs af weekender når satsen er uændret', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmount(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-29'), til: iso('2024-02-09') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.fra).toBe(iso('2024-01-29'));
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.til).toBe(iso('2024-02-09'));
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.antalDage).toBe(10);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengekravOre).toBe(100000);
    expect(result.perAnsaettelsesforhold[0]?.feriepengekravTotalOre).toBe(100000);
    expect(result.perAnsaettelsesforhold[0]?.totalOre).toBe(100000);
  });

  it('ignorerer hængende sfggSatsvalg ved direkte ikke-differentieret overenskomst-SFGG', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'transportoverenskomsten-atl',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Faglaert-Provinsen',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-26'), til: iso('2024-03-05') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.satsOre).toBe(14620);
    expect(result.perAnsaettelsesforhold[0]?.segments[1]?.satsOre).toBe(15152);
  });

  it('genbruger samme referenceperiode ved skift fra Ferieloven til Overenskomst med ferielov-model', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      feriePct: 12.5,
      fritvalgPct: 5,
      shSoPct: 4,
      storeBededagPct: 1,
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2023-12-01'),
      sfggReferenceperiodeTil: iso('2023-12-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const ferieloven = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    values.sfggAnsaettelsesforhold = [{
      ...values.sfggAnsaettelsesforhold[0],
      sfggBeregningskilde: 'Overenskomst',
    }];

    const overenskomst = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(overenskomst.perAnsaettelsesforhold[0]?.sfggReferenceperiode).toEqual(
      ferieloven.perAnsaettelsesforhold[0]?.sfggReferenceperiode
    );
    expect(overenskomst.perAnsaettelsesforhold[0]?.sfggReferencesats).toEqual(
      ferieloven.perAnsaettelsesforhold[0]?.sfggReferencesats
    );
    expect(overenskomst.totalOre).toBe(ferieloven.totalOre);
  });

  it('ændret referenceperiode ændrer SFGG-resultatet for Overenskomst med ferielov-model', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      feriePct: 12.5,
      fritvalgPct: 5,
      shSoPct: 4,
      storeBededagPct: 1,
      indtaegtsoplysningerTableData: [
        {
          id: 'loen-nov-2023',
          col0_maaned: '11',
          col1_maaned: '2023',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmount(5000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'loen-dec-2023',
          col0_maaned: '12',
          col1_maaned: '2023',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmount(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2023-12-01'),
      sfggReferenceperiodeTil: iso('2023-12-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const decemberOnly = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    values.sfggAnsaettelsesforhold = [{
      ...values.sfggAnsaettelsesforhold[0],
      sfggReferenceperiodeFra: iso('2023-11-01'),
      sfggReferenceperiodeTil: iso('2023-12-31'),
    }];

    const novemberDecember = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(novemberDecember.perAnsaettelsesforhold[0]?.sfggReferencesats).not.toEqual(
      decemberOnly.perAnsaettelsesforhold[0]?.sfggReferencesats
    );
    expect(novemberDecember.totalOre).not.toBe(decemberOnly.totalOre);
  });

  it('udelader den første TAF-dag ved første erstatningsopgørelse fra og med 1. januar 2015', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmount(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2025-01-06') },
      tafRanges: [{ fra: iso('2025-01-06'), til: iso('2025-01-10') }],
    });

    expect(result.firstExcludedDate).toBe(iso('2025-01-06'));
    expect(result.totalOre).toBe(40000);
    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.antalDage).toBe(4);
  });

  it('lader første dag efter arbejdsgiverbetalt sygeløn indgå, når første sygedag allerede er undtaget efter 1. januar 2015-reglen', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenperiode: 'dag',
      indtaegtsoplysningerTableData: [
        {
          id: 'loen-1',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '06-01-2025',
          col1_dag: '06-01-2025',
          col2: asAmount(100),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'loen-2',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '07-01-2025',
          col1_dag: '07-01-2025',
          col2: asAmount(100),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'loen-3',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '08-01-2025',
          col1_dag: '08-01-2025',
          col2: asAmount(100),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Ufaglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2025-01-06') },
      tafRanges: [{ fra: iso('2025-01-06'), til: iso('2025-01-10') }],
    });

    expect(result.firstExcludedDate).toBe(iso('2025-01-06'));
    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2025-01-09'),
        til: iso('2025-01-10'),
        antalDage: 2,
      })
    );
  });

  it('afkorter præ-2015-forløb ved 4 måneder beregnet på kalenderdage når TAF beregnes som måneder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmount(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2014-01-01') },
      tafRanges: [{ fra: iso('2014-01-01'), til: iso('2014-12-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.capReachedDate).toBe(iso('2014-04-30'));
    expect(result.perAnsaettelsesforhold[0]?.capRows).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.fra).toBe(iso('2014-01-02'));
    expect(result.perAnsaettelsesforhold[0]?.segments.at(-1)?.til).toBe(iso('2014-04-30'));
  });

  it('beregner referencesats på kalenderdage når SFGG følger referenceperiode og TAF beregnes som måneder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 1,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggReferencesats.status).toBe('ok');
    expect(result.perAnsaettelsesforhold[0]?.sfggReferencesats.value).toBe(4167);
    expect(result.perAnsaettelsesforhold[0]?.sfggReferencesatsFormula).toEqual({
      ferieberettigetLoenKroner: 10000,
      feriePctDecimal: 0.125,
      feriepengeKroner: 1250,
      divisorDage: 30,
      divisorLabel: 'kalenderdage',
      kalenderdage: 31,
      hverdage: 23,
      shDage: 1,
      feriedage: 0,
      oevrigeFravaersdage: 1,
    });
  });

  it('er upåvirket af EO-beregningsperioden når SFGG beregnes ud fra egen referenceperiode', () => {
    const baseValues = createErstatningsopgoerelseInitialValues();
    baseValues.eoNummer = '2';
    baseValues.beregnesUdFra = 'Beregningsperiode';
    baseValues.periodeTilBeregningFra = iso('2023-01-01');
    baseValues.periodeTilBeregningTil = iso('2023-12-31');
    baseValues.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    baseValues.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 1,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const changedBeregningsperiodeValues = structuredClone(baseValues);
    changedBeregningsperiodeValues.periodeTilBeregningFra = iso('2019-01-01');
    changedBeregningsperiodeValues.periodeTilBeregningTil = iso('2019-06-30');

    const tafRanges = [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }] as const;
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') };

    const baseResult = computeSygeferiegodtgoerelse({
      values: baseValues,
      stamdata,
      tafRanges,
    });
    const changedBeregningsperiodeResult = computeSygeferiegodtgoerelse({
      values: changedBeregningsperiodeValues,
      stamdata,
      tafRanges,
    });

    expect(changedBeregningsperiodeResult).toEqual(baseResult);
  });

  it('bevarer arbejdsdage for manuelt angivet SFGG selv når TAF beregnes som måneder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-29'), til: iso('2024-02-04') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.antalDage).toBe(5);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengekravOre).toBe(50000);
  });

  it('skifter til kalenderdage i selve SFGG-beregningen når referenceperiode-sporet kombineres med TAF beregnet som måneder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 1,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-29'), til: iso('2024-02-04') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.antalDage).toBe(7);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengekravOre).toBe(29169);
  });

  it('bruger kalenderdage kun i referenceperiode-sporet og ikke i manuelt spor ved weekend-only TAF-periode', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];

    const weekendTafRange = [{ fra: iso('2024-02-03'), til: iso('2024-02-04') }];

    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const ferielovResult = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: weekendTafRange,
    });

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

    const manuelResult = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: weekendTafRange,
    });

    expect(ferielovResult.perAnsaettelsesforhold[0]?.segments[0]?.antalDage).toBe(2);
    expect(ferielovResult.perAnsaettelsesforhold[0]?.totalOre).toBeGreaterThan(0);
    expect(manuelResult.perAnsaettelsesforhold[0]?.segments).toEqual([]);
    expect(manuelResult.perAnsaettelsesforhold[0]?.sfggReferencesats.status).toBe('not_calculable');
  });

  it('genbruger lønudviklingsindeks i SFGG-segmenter og splitter ved reguleringsskift', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2023-12-01'),
      sfggReferenceperiodeTil: iso('2023-12-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-26'), til: iso('2024-03-05') }],
      loenudviklingPerAnsaettelse: new Map([
        ['af-1', {
          beregnedeSegmenter: [
            {
              kind: 'arbejdsdage',
              fra: iso('2024-02-26'),
              til: iso('2024-02-29'),
              arbejdsdage: 4,
              dagsloenOre: 0,
              deltaPct: 0,
              amountOre: 0,
            },
            {
              kind: 'arbejdsdage',
              fra: iso('2024-03-01'),
              til: iso('2024-03-05'),
              arbejdsdage: 3,
              dagsloenOre: 0,
              deltaPct: 5.03,
              amountOre: 0,
            },
          ],
        }],
      ]),
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2024-02-26'),
        til: iso('2024-02-29'),
        reguleringsindeks: 100,
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2024-03-01'),
        til: iso('2024-03-05'),
        reguleringsindeks: 105.03,
        satsOre: 6910,
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.satsOre).toBe(6579);
  });

  it('opregner referencesatsen med segmentets procentvise indeksfaktor i øre for overenskomstbaseret ferielovs-SFGG', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Overenskomst',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
      loenudviklingPerAnsaettelse: new Map([
        ['af-1', {
          beregnedeSegmenter: [
            {
              kind: 'arbejdsdage',
              fra: iso('2024-02-01'),
              til: iso('2024-02-01'),
              arbejdsdage: 1,
              dagsloenOre: 0,
              deltaPct: 5.03,
              amountOre: 0,
            },
          ],
        }],
      ]),
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        reguleringsindeks: 105.03,
        satsOre: 5968,
      })
    );
  });
});

describe('findSfggSixMonthWarningEmploymentIds', () => {
  it('markerer ansættelsesforhold hvor SFGG fortsætter mere end 6 måneder efter sidste lønindkomst', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: asAmount(10000),
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
      sfggReferenceperiodeFravaersdageUdenLoen: 0, // 0 svarer til parsed schema-default (ingen fraværsdage uden løn)
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') };
    const tafRanges = [{ fra: iso('2024-08-01'), til: iso('2024-08-31') }];
    const sfggResult = computeSygeferiegodtgoerelse({ values, stamdata, tafRanges, loenudviklingPerAnsaettelse: new Map() });
    const warningIds = findSfggSixMonthWarningEmploymentIds({
      values,
      result: sfggResult,
    });

    expect(warningIds).toEqual(['af-1']);
  });
});
