import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  computeSygeferiegodtgoerelse,
  findSfggSixMonthWarningEmploymentIds,
} from '../../../domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse';
import {
  buildSfggReferenceperiodeCountLabel,
  parseSfggExplanatoryLine,
} from '../../../domain/erstatningsopgoerelse/helpers/sygeferiegodtgoerelseTexts';
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

  it('formaterer kalenderdage-label med feriedage og uden SH-dage', () => {
    expect(buildSfggReferenceperiodeCountLabel({
      ferieberettigetLoenKroner: 0,
      feriePctDecimal: 0,
      feriepengeKroner: 0,
      divisorDage: 28,
      divisorLabel: 'kalenderdage',
      kalenderdage: 31,
      hverdage: 23,
      shDage: 1,
      feriedage: 2,
      oevrigeFravaersdage: 1,
    })).toBe('Antal kalenderdage i perioden (31 kalenderdage - 2 feriedage - 1 fraværsdage u. løn) =');
  });

  it('parser bortfalder-varianten for 4-månedersforklaringen struktureret', () => {
    expect(
      parseSfggExplanatoryLine(
        'Retten til sygeferiegodtgørelse er tidsbegrænset til 4 måneder og bortfalder den 30-04-2014.'
      )
    ).toEqual({
      kind: 'four_month_cap',
      verb: 'bortfalder',
      date: '30-04-2014',
    });
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

  it('ignorerer stale referenceperiodefelter når SFGG beregnes manuelt', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmount(100),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2020-01-01'),
      sfggReferenceperiodeTil: iso('2020-12-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 200,
      sfggSatsvalg: 'Faglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengekravOre).toBe(10000);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.beregnetSfggoereOre).toBe(10000);
    expect(result.perAnsaettelsesforhold[0]?.sfggReferenceperiode).toBeNull();
  });

  it('ignorerer stale manuelle felter når SFGG beregnes efter Ferieloven', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
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
      sfggManuelDagssats: asAmount(9999),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Ja',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Faglaert-Koebenhavn',
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
  });

  it('medregner AG-pension i feriepengekravet uden at pensionsbidrag tælles med to gange', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      pensionPct: 10,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        satsOre: 10000,
        agPensionPct: 10,
        feriepengekravOre: 11000,
        beregnetSfggoereOre: 11000,
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.feriepengekravTotalOre).toBe(11000);
    expect(result.perAnsaettelsesforhold[0]?.totalOre).toBe(11000);
  });

  it('kaster ikke ved allerede betalt beløb når alle SFGG-vægte er nul', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmount(0),
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: asAmount(100),
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-16') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        feriepengekravOre: 0,
        alleredeBetaltOre: 10000,
        beregnetSfggoereOre: 0,
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.totalOre).toBe(0);
  });

  it('fordeler allerede betalt proportionalt med brutto inkl. AG-pension på tværs af segmenter', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'faellesoverenskomsten-dio-ii',
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
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: asAmount(10),
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2023-01-01') },
      tafRanges: [{ fra: iso('2023-05-31'), til: iso('2023-06-02') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2023-05-31'),
        til: iso('2023-05-31'),
        agPensionPct: 8,
        feriepengekravOre: 15790,
        alleredeBetaltOre: 330,
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2023-06-01'),
        til: iso('2023-06-02'),
        agPensionPct: 10,
        feriepengekravOre: 32164,
        alleredeBetaltOre: 670,
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.alleredeBetaltOre).toBe(1000);
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

  it('medregner ikke arbejdsdage i gab mellem diskontinuerte TAF-perioder', () => {
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
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-29') },
      tafRanges: [
        { fra: iso('2024-01-29'), til: iso('2024-01-31') },
        { fra: iso('2024-02-05'), til: iso('2024-02-06') },
      ],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toEqual([
      expect.objectContaining({
        fra: iso('2024-01-29'),
        til: iso('2024-01-31'),
        antalDage: 3,
      }),
      expect.objectContaining({
        fra: iso('2024-02-05'),
        til: iso('2024-02-06'),
        antalDage: 2,
      }),
    ]);
    expect(result.perAnsaettelsesforhold[0]?.feriepengekravTotalOre).toBe(50000);
  });

  it('splitter arbejdsdagsvisningen ved daterede feriedage i TAF-perioden', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment()];
    values.ferieperioder = [{
      id: 'ferie-1',
      fra: iso('2024-02-01'),
      til: iso('2024-02-02'),
    }];
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
      tafRanges: [{ fra: iso('2024-01-29'), til: iso('2024-02-06') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toEqual([
      expect.objectContaining({
        fra: iso('2024-01-29'),
        til: iso('2024-01-31'),
        antalDage: 3,
      }),
      expect.objectContaining({
        fra: iso('2024-02-03'),
        til: iso('2024-02-06'),
        antalDage: 2,
      }),
    ]);
  });

  it('viser kun linjen om første sygedag for ansættelsesforhold der faktisk mister den dag', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        navnPaaArbejdssted: 'Manuel dagssats',
      }),
      createEmployment({
        id: 'af-2',
        navnPaaArbejdssted: 'Ferielov',
        feriePct: 12.5,
        indtaegtsoplysningerTableData: [{
          id: 'loen-jan-2025',
          col0_maaned: '1',
          col1_maaned: '2025',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmount(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        }],
      }),
    ];
    values.sfggAnsaettelsesforhold = [
      {
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
      },
      {
        ansaettelsesforholdId: 'af-2',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2025-01-01'),
        sfggReferenceperiodeTil: iso('2025-01-31'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      },
    ];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2025-01-05') },
      tafRanges: [{ fra: iso('2025-01-05'), til: iso('2025-01-10') }],
    });

    expect(result.firstExcludedDate).toBe(iso('2025-01-05'));
    expect(result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === 'af-1')?.sfggFirstTafDayExcludedText).toBeNull();
    expect(result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === 'af-2')?.sfggFirstTafDayExcludedText).toBe(
      'Da skaden er fra 1. januar 2015, er der desuden først krav på sygeferiegodtgørelse fra anden sygedag.'
    );
    expect(result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === 'af-2')?.pdfExplanatoryLines).toEqual([]);
  });

  it('holder arbejdsgiverbetalt sygeløn som struktureret forklaring uden fri tekst-duplikat', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2025',
        col0_maaned: '1',
        col1_maaned: '2025',
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
      sfggManuelFoerstEfterSygeloen: 'Ja',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2025-01-01') },
      tafRanges: [{ fra: iso('2025-01-01'), til: iso('2025-01-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggAfterEmployerSickPayText).toBe(
      'Der beregnes ikke sygeferiegodtgørelse på dage, hvor der betales arbejdsgiverbetalt sygeløn.'
    );
    expect(result.perAnsaettelsesforhold[0]?.pdfExplanatoryLines).toEqual([]);
  });

  it('viser overenskomstforklaring om sygeløn når overenskomsten bortfalder under arbejdsgiverbetalt sygeløn', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-29'), til: iso('2024-02-06') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggAfterEmployerSickPayText).toBe(
      'I medfør af overenskomsten beregnes ikke sygeferiegodtgørelse på dage, hvor der betales sygeløn.'
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
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.fra).toBe(iso('2014-01-01'));
    expect(result.perAnsaettelsesforhold[0]?.segments.at(-1)?.til).toBe(iso('2014-04-30'));
  });

  it('lader arbejdsgiverbetalt sygeløn tælle med til præ-2015-4-månedersgrænsen selv om dagene ikke giver SFGG', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      indtaegtsoplysningerTableData: [
        {
          id: 'loen-jan-2014',
          col0_maaned: '1',
          col1_maaned: '2014',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmount(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'loen-feb-2014',
          col0_maaned: '2',
          col1_maaned: '2014',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmount(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'loen-mar-2014',
          col0_maaned: '3',
          col1_maaned: '2014',
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
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Ufaglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2014-01-01') },
      tafRanges: [{ fra: iso('2014-01-01'), til: iso('2014-06-30') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.capReachedDate).toBe(iso('2014-04-30'));
    expect(result.perAnsaettelsesforhold[0]?.segments).toEqual([
      expect.objectContaining({
        fra: iso('2014-04-01'),
        til: iso('2014-04-30'),
      }),
    ]);
  });

  it('medregner ikke SH-dage og daterede feriedage i præ-2015-4-månedersgrænsen for arbejdsdagsbaseret SFGG', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    values.ferieperioder = [{
      id: 'ferie-okt-2014',
      fra: iso('2014-10-01'),
      til: iso('2014-10-10'),
    }];
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      indtaegtsoplysningerTableData: [
        {
          id: 'loen-jul-2014',
          col0_maaned: '7',
          col1_maaned: '2014',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmount(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'loen-aug-2014',
          col0_maaned: '8',
          col1_maaned: '2014',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmount(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
        {
          id: 'loen-sep-2014',
          col0_maaned: '9',
          col1_maaned: '2014',
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
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: 'Ufaglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2014-07-01') },
      tafRanges: [{ fra: iso('2014-07-01'), til: iso('2014-12-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.capReachedDate).toBe(iso('2014-11-11'));
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        til: iso('2014-11-11'),
      })
    );
  });

  it('beholder kun den tidligste pdf-forklaring når både 4-månedersgrænse og ansættelsesophør er aktuelle', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      ansaettelsesforholdOphoert: true,
      sidsteArbejdsdag: iso('2014-02-15'),
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2014-01-01') },
      tafRanges: [{ fra: iso('2014-01-01'), til: iso('2014-12-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.pdfExplanatoryLines).toEqual([
      'Retten til sygeferiegodtgørelse bortfaldt den 15-02-2014 som følge af ansættelsesforholdets ophør.',
    ]);
  });

  it('bruger bortfalder i 4-månedersforklaringen når ophørsdatoen ligger efter opgørelsesdatoen', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.opgørelseLavetDen = iso('2014-03-01');
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2014-01-01') },
      tafRanges: [{ fra: iso('2014-01-01'), til: iso('2014-12-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.pdfExplanatoryLines).toEqual([
      'Retten til sygeferiegodtgørelse er tidsbegrænset til 4 måneder og bortfalder den 30-04-2014.',
    ]);
  });

  it('bruger bortfalder i ansættelsesophørsforklaringen når ophørsdatoen ligger efter opgørelsesdatoen', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.opgørelseLavetDen = iso('2024-02-01');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      ansaettelsesforholdOphoert: true,
      sidsteArbejdsdag: iso('2024-02-15'),
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-03-15') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.pdfExplanatoryLines).toEqual([
      'Retten til sygeferiegodtgørelse bortfalder den 15-02-2024 som følge af ansættelsesforholdets ophør.',
    ]);
  });

  it('beregner referencesats på kalenderdage når SFGG følger referenceperiode og TAF beregnes som måneder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.ferieperioder = [{
      id: 'ferie-jan-2024',
      fra: iso('2024-01-20'),
      til: iso('2024-01-21'),
    }];
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
    expect(result.perAnsaettelsesforhold[0]?.sfggReferencesats.value).toBe(4464);
    expect(result.perAnsaettelsesforhold[0]?.sfggReferencesatsFormula).toEqual({
      ferieberettigetLoenKroner: 10000,
      feriePctDecimal: 0.125,
      feriepengeKroner: 1250,
      divisorDage: 28,
      divisorLabel: 'kalenderdage',
      kalenderdage: 31,
      hverdage: 23,
      shDage: 1,
      feriedage: 2,
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
    values.ferieperioder = [{
      id: 'ferie-feb-2024',
      fra: iso('2024-02-03'),
      til: iso('2024-02-04'),
    }];
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
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.antalDage).toBe(5);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengekravOre).toBe(20835);
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

  it('viser arbejdsdagssegmenter med kalenderdagsgrænser ved satskift over nytår', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
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
      sfggSatsvalg: 'Ufaglaert-Koebenhavn',
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadesdato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-12-30'), til: iso('2025-01-03') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2024-12-30'),
        til: iso('2024-12-31'),
        antalDage: 2,
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2025-01-01'),
        til: iso('2025-01-03'),
        antalDage: 2,
      })
    );
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

  it('producerer 0 SFGG for ansættelsesforhold med ansatPaaSkadestidspunktet: false', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      ansatPaaSkadestidspunktet: false,
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
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(result.totalOre).toBe(0);
    expect(result.perAnsaettelsesforhold).toHaveLength(0);
  });
});
