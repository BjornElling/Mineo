import { moneyOre } from '../../../domain/money/money';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  buildSfggPeriode,
  computeSygeferiegodtgoerelse,
  findSfggSixMonthWarningEmploymentIds,
  sumLoenPlusLoen2PlusIkkePensLoenInRangesKroner,
} from '../../../domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse';
import {
  buildSfggReferenceperiodeCountLabel,
  formatSfggAfkortningPdfLine,
} from '../../../domain/erstatningsopgoerelse/helpers/sygeferiegodtgoerelseTexts';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';
import { createSfggIngenRow } from '../../utils/sfggTestSupport';

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
  tillaegAngivesSom: patch.tillaegAngivesSom ?? 'procent',
  fuldLoenUnderFerie: patch.fuldLoenUnderFerie ?? 'Ja',
  harAnciennitetstillaegEfterSkadedatoen: patch.harAnciennitetstillaegEfterSkadedatoen ?? false,
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
  loenudviklingManuelProcentsatsTableData: patch.loenudviklingManuelProcentsatsTableData ?? [],
});

describe('computeSygeferiegodtgoerelse', () => {
  it('formaterer arbejdsdage-label med kun ikke-nul fradrag', () => {
    expect(buildSfggReferenceperiodeCountLabel({
      loenPlusLoen2PlusIkkePensLoenKroner: 0,
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
      loenPlusLoen2PlusIkkePensLoenKroner: 0,
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
      loenPlusLoen2PlusIkkePensLoenKroner: 0,
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
      loenPlusLoen2PlusIkkePensLoenKroner: 0,
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

  it('formatterer 4-måneders-afkortningen til bilagets venstre/højre-linje', () => {
    expect(
      formatSfggAfkortningPdfLine({ aarsag: 'cap4mdr', verbum: 'bortfalder', dato: iso('2014-04-30') })
    ).toEqual({
      left: 'Skaden er før 01-01-2015 og retten er begrænset til 4 måneder, som ophørte',
      right: '30-04-2014',
    });
  });

  it('formatterer ansættelsesophør-afkortningen med det korrekte verbum', () => {
    expect(
      formatSfggAfkortningPdfLine({ aarsag: 'ansaettelsesophoer', verbum: 'bortfaldt', dato: iso('2024-02-15') })
    ).toEqual({
      left: 'Retten bortfaldt ved ansættelsesforholdets ophør',
      right: '15-02-2024',
    });
  });

  it('beregner referencesatsen ud fra løn (Løn+Løn2+IkkePensLoen) og kun FP-satsen', () => {
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggReferencesats.status).toBe('ok');
    if (result.perAnsaettelsesforhold[0]?.sfggReferencesats.status !== 'ok') {
      throw new Error('ReferenceSats forventedes beregnelig');
    }
    expect(result.perAnsaettelsesforhold[0].sfggReferencesats.value).toBe(5682);
    expect(result.perAnsaettelsesforhold[0].sfggReferencesatsFormula).toEqual({
      loenPlusLoen2PlusIkkePensLoenKroner: 10000,
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

  it('fratrækker feriepenge af sygeløn i SFGG-perioden uden øvrige løntillæg', () => {
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengekravOre).toBe(10000);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.feriepengeAfSygeloenOre).toBe(5682);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]?.beregnetSfggoereOre).toBe(4318);
  });

  it('medregner pension af feriepenge modtaget i perioden med den sats der gælder på hver enkelt dag', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'faellesoverenskomsten-dio-ii',
      feriePct: 12.5,
      loenperiode: 'dag',
      indtaegtsoplysningerTableData: [
        {
          id: 'loen-1',
          col0_maaned: '',
          col1_maaned: '',
          col0_uge: '',
          col1_uge: '',
          col0_dag: toISODateString('2023-05-31'),
          col1_dag: toISODateString('2023-05-31'),
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
          col0_dag: toISODateString('2023-06-01'),
          col1_dag: toISODateString('2023-06-01'),
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
          col0_dag: toISODateString('2023-06-02'),
          col1_dag: toISODateString('2023-06-02'),
          col2: asAmount(100),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') },
      tafRanges: [{ fra: iso('2023-05-31'), til: iso('2023-06-02') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2023-05-31'),
        til: iso('2023-05-31'),
        agPensionPct: 8,
        feriepengeAfSygeloenOre: moneyOre(1350),
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2023-06-01'),
        til: iso('2023-06-02'),
        agPensionPct: 10,
        feriepengeAfSygeloenOre: moneyOre(2750),
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.feriepengeModtagetFormula).toEqual({ totalOre: moneyOre(4100) });
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        satsOre: moneyOre(10000),
        agPensionPct: 10,
        feriepengekravOre: moneyOre(11000),
        beregnetSfggoereOre: moneyOre(11000),
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-16') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        feriepengekravOre: moneyOre(0),
        alleredeBetaltOre: moneyOre(10000),
        beregnetSfggoereOre: moneyOre(0),
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') },
      tafRanges: [{ fra: iso('2023-05-31'), til: iso('2023-06-02') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2023-05-31'),
        til: iso('2023-05-31'),
        agPensionPct: 8,
        feriepengekravOre: moneyOre(15790),
        alleredeBetaltOre: moneyOre(330),
      })
    );
    expect(result.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2023-06-01'),
        til: iso('2023-06-02'),
        agPensionPct: 10,
        feriepengekravOre: moneyOre(32164),
        alleredeBetaltOre: moneyOre(670),
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    values.sfggAnsaettelsesforhold = [{
      ...values.sfggAnsaettelsesforhold[0],
      sfggBeregningskilde: 'Overenskomst',
    }];

    const overenskomst = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
          col0_dag: undefined,
          col1_dag: undefined,
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
          col0_dag: undefined,
          col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    values.sfggAnsaettelsesforhold = [{
      ...values.sfggAnsaettelsesforhold[0],
      sfggReferenceperiodeFra: iso('2023-11-01'),
      sfggReferenceperiodeTil: iso('2023-12-31'),
    }];

    const novemberDecember = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2025-01-06') },
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
          col0_dag: toISODateString('2025-01-06'),
          col1_dag: toISODateString('2025-01-06'),
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
          col0_dag: toISODateString('2025-01-07'),
          col1_dag: toISODateString('2025-01-07'),
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
          col0_dag: toISODateString('2025-01-08'),
          col1_dag: toISODateString('2025-01-08'),
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2025-01-06') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-29') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
          col0_dag: undefined,
          col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2025-01-05') },
      tafRanges: [{ fra: iso('2025-01-05'), til: iso('2025-01-10') }],
    });

    expect(result.firstExcludedDate).toBe(iso('2025-01-05'));
    expect(result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === 'af-1')?.sfggFirstTafDayExcludedText).toBeNull();
    expect(result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === 'af-2')?.sfggFirstTafDayExcludedText).toBe(
      'Da skaden er fra 1. januar 2015, er der desuden først krav på sygeferiegodtgørelse fra anden sygedag.'
    );
    expect(result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === 'af-2')?.sfggAfkortninger).toEqual([]);
  });

  it('bevarer første TAF-dato i arbejdsdags-sporet når den første undtagne dag ikke er en arbejdsdag', () => {
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
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2025-06-09') },
      tafRanges: [{ fra: iso('2025-06-09'), til: iso('2025-06-13') }],
    });

    expect(result.firstExcludedDate).toBe(iso('2025-06-09'));
    expect(result.totalOre).toBe(40000);
    expect(result.perAnsaettelsesforhold[0]?.sfggFirstTafDayExcludedText).toBeNull();
    expect(result.perAnsaettelsesforhold[0]?.segments).toEqual([
      expect.objectContaining({
        fra: iso('2025-06-09'),
        til: iso('2025-06-13'),
        antalDage: 4,
      }),
    ]);
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2025-01-01') },
      tafRanges: [{ fra: iso('2025-01-01'), til: iso('2025-01-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggAfterEmployerSickPayText).toBe(
      'Der beregnes ikke sygeferiegodtgørelse på dage, hvor der betales arbejdsgiverbetalt sygeløn.'
    );
    expect(result.perAnsaettelsesforhold[0]?.sfggAfkortninger).toEqual([]);
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2014-01-01') },
      tafRanges: [{ fra: iso('2014-01-01'), til: iso('2014-12-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.capReachedDate).toBe(iso('2014-04-30'));
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
          col0_dag: undefined,
          col1_dag: undefined,
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
          col0_dag: undefined,
          col1_dag: undefined,
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
          col0_dag: undefined,
          col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2014-01-01') },
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
          col0_dag: undefined,
          col1_dag: undefined,
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
          col0_dag: undefined,
          col1_dag: undefined,
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
          col0_dag: undefined,
          col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2014-07-01') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2014-01-01') },
      tafRanges: [{ fra: iso('2014-01-01'), til: iso('2014-12-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggAfkortninger).toEqual([
      { aarsag: 'ansaettelsesophoer', verbum: 'bortfaldt', dato: iso('2014-02-15') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2014-01-01') },
      tafRanges: [{ fra: iso('2014-01-01'), til: iso('2014-12-31') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggAfkortninger).toEqual([
      { aarsag: 'cap4mdr', verbum: 'bortfalder', dato: iso('2014-04-30') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-03-15') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggAfkortninger).toEqual([
      { aarsag: 'ansaettelsesophoer', verbum: 'bortfalder', dato: iso('2024-02-15') },
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });

    const referencesats = result.perAnsaettelsesforhold[0]?.sfggReferencesats;
    expect(referencesats?.status).toBe('ok');
    expect(referencesats?.status === 'ok' ? referencesats.value : null).toBe(4464);
    expect(result.perAnsaettelsesforhold[0]?.sfggReferencesatsFormula).toEqual({
      loenPlusLoen2PlusIkkePensLoenKroner: 10000,
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

  it('frakobler ferielovsbaseret SFGG fra overenskomstens sygelønsregel', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
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

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-29'), til: iso('2024-02-06') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.segments.length).toBeGreaterThan(0);
    expect(result.perAnsaettelsesforhold[0]?.sfggAfterEmployerSickPayText).toBeNull();
  });

  it('er upåvirket af EO-beregningsperioden når SFGG beregnes ud fra egen referenceperiode', () => {
    const baseValues = createErstatningsopgoerelseInitialValues();
    baseValues.eoNummer = '2';
    baseValues.beregnesUdFra = 'Beregningsperiode';
    baseValues.tafBeregningsperiodeFra = iso('2023-01-01');
    baseValues.tafBeregningsperiodeTil = iso('2023-12-31');
    baseValues.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
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
    changedBeregningsperiodeValues.tafBeregningsperiodeFra = iso('2019-01-01');
    changedBeregningsperiodeValues.tafBeregningsperiodeTil = iso('2019-06-30');

    const tafRanges = [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }] as const;
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') };

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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-26'), til: iso('2024-03-05') }],
      loenudviklingPerAnsaettelse: new Map([
        ['af-1', {
          beregnedeSegmenter: [
            {
              kind: 'arbejdsdage',
              fra: iso('2024-02-26'),
              til: iso('2024-02-29'),
              arbejdsdage: 4,
              dagsloenOre: moneyOre(0),
              deltaPct: 0,
              amountOre: moneyOre(0),
            },
            {
              kind: 'arbejdsdage',
              fra: iso('2024-03-01'),
              til: iso('2024-03-05'),
              arbejdsdage: 3,
              dagsloenOre: moneyOre(0),
              deltaPct: 5.03,
              amountOre: moneyOre(0),
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
        satsOre: moneyOre(6910),
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
      loenudviklingPerAnsaettelse: new Map([
        ['af-1', {
          beregnedeSegmenter: [
            {
              kind: 'arbejdsdage',
              fra: iso('2024-02-01'),
              til: iso('2024-02-01'),
              arbejdsdage: 1,
              dagsloenOre: moneyOre(0),
              deltaPct: 5.03,
              amountOre: moneyOre(0),
            },
          ],
        }],
      ]),
    });

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        reguleringsindeks: 105.03,
        satsOre: moneyOre(5968),
      })
    );
  });

  it('bruger kun SFGG-berettigede dage i løngrundlaget for feriepengefradrag', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
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
    values.ferieperioder = [{ id: 'ferie-1', fra: iso('2024-01-30'), til: iso('2024-01-30') }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-29'), til: iso('2024-01-30') }],
    });

    const expectedLoenGrundlag = sumLoenPlusLoen2PlusIkkePensLoenInRangesKroner(
      values.loenindkomstAnsaettelsesforhold[0]!,
      [{ fra: iso('2024-01-29'), til: iso('2024-01-29') }],
      values.ferieperioder
    );

    expect(result.perAnsaettelsesforhold[0]?.segments).toHaveLength(1);
    expect(result.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2024-01-29'),
        til: iso('2024-01-29'),
        antalDage: 1,
        loenPlusLoen2PlusIkkePensLoenKroner: expectedLoenGrundlag,
      })
    );
  });

  it('beregner referencesatsen med 12,5 % og ignorerer en afvigende indtastet feriepengesats', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      // Brugeren har indtastet en overenskomstforhøjet feriepengesats (14,5 %), men
      // SFGG skal uanset dette beregnes med de lovbestemte 12,5 %.
      feriePct: 14.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });

    const entry = result.perAnsaettelsesforhold[0];
    expect(entry?.sfggReferencesats.status).toBe('ok');
    // Identisk med resultatet ved feriePct: 12.5 — beviser at den indtastede 14,5 % ikke bruges.
    expect(entry?.sfggReferencesats.status === 'ok' ? entry.sfggReferencesats.value : null).toBe(5682);
    expect(entry?.sfggReferencesatsFormula?.feriePctDecimal).toBe(0.125);
    expect(entry?.sfggReferencesatsFormula?.feriepengeKroner).toBe(1250);
    // Noten oplyser, at SFGG beregnes med 12,5 %, fordi den indtastede sats afviger.
    expect(entry?.sfggLovbestemtFeriepengeNote).toBe(
      'Satsen udgør 12,5 % af den ferieberettigede løn.'
    );
  });

  it('beregner fradraget for feriepenge af sygeløn med 12,5 % uanset indtastet feriepengesats', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 14.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
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
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    const entry = result.perAnsaettelsesforhold[0];
    // Identisk med feriePct: 12.5-tilfældet (5682) — den indtastede 14,5 % bruges ikke.
    expect(entry?.segments[0]?.feriepengeAfSygeloenOre).toBe(5682);
    expect(entry?.segments[0]?.beregnetSfggoereOre).toBe(4318);
    // Manuel sats er ikke "beregnet som procentdel af lønnen", så noten vises ikke.
    expect(entry?.sfggLovbestemtFeriepengeNote).toBeNull();
  });

  it('viser ikke 12,5 %-noten når den indtastede feriepengesats allerede er 12,5 %', () => {
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });

    expect(result.perAnsaettelsesforhold[0]?.sfggLovbestemtFeriepengeNote).toBeNull();
  });
});

describe('computeSygeferiegodtgoerelse — feriepenge-fradrag og øre-invariant', () => {
  const janIncomeRow = (id: string, beloeb: number) => ({
    id,
    col0_maaned: '1',
    col1_maaned: '2024',
    col0_uge: '',
    col1_uge: '',
    col0_dag: undefined,
    col1_dag: undefined,
    col2: asAmount(beloeb),
    col3: undefined,
    col4: undefined,
    col5: undefined,
  });

  it('medregner feriepenge fra ansættelsesforhold uden ansættelse på skadestidspunktet i fradraget (G7)', () => {
    // G7: "Feriepenge modtaget i perioden" skal medregne indkomst fra SAMTLIGE arbejdsgivere, ikke
    // kun dem skadelidte var ansat hos på skadestidspunktet. Motoren bygger derfor kalkulatorerne
    // for feriepenge-fradraget fra ALLE ansættelsesforhold (ufiltreret), mens selve SFGG-kravet kun
    // beregnes for de aktive. En regression, der filtrerede kalkulatorerne på ansatPaaSkadestidspunktet,
    // ville få de to kørsler nedenfor til at give samme fradrag.
    const buildValues = (includeInactiveIncome: boolean): ErstatningsopgoerelseValues => {
      const values = createErstatningsopgoerelseInitialValues();
      values.eoNummer = '2';
      values.beregnesUdFra = 'Angivet dagsløn';
      values.loenindkomstAnsaettelsesforhold = [
        createEmployment({
          id: 'af-aktiv',
          feriePct: 12.5,
          indtaegtsoplysningerTableData: [janIncomeRow('loen-aktiv-jan', 10000)],
        }),
        createEmployment({
          id: 'af-inaktiv',
          ansatPaaSkadestidspunktet: false,
          feriePct: 12.5,
          indtaegtsoplysningerTableData: includeInactiveIncome ? [janIncomeRow('loen-inaktiv-jan', 20000)] : [],
        }),
      ];
      // Høj manuel dagssats sikrer, at bruttokravet langt overstiger feriepenge-fradraget, så
      // Math.min-cap'et ikke skjuler forskellen.
      values.sfggAnsaettelsesforhold = [
        {
          ansaettelsesforholdId: 'af-aktiv',
          sfggBeregningskilde: 'Manuelt angivet',
          sfggManuelDagssats: asAmount(5000),
          sfggManuelBeloebIHenholdTil: undefined,
          sfggManuelFoerstEfterSygeloen: 'Nej',
          sfggReferenceperiodeFra: undefined,
          sfggReferenceperiodeTil: undefined,
          sfggReferenceperiodeFravaersdageUdenLoen: 0,
          sfggSatsvalg: undefined,
          sfggAlleredeBetaltBeloeb: undefined,
        },
        createSfggIngenRow('af-inaktiv'),
      ];
      return values;
    };

    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') };
    const tafRanges = [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }];

    const withInactive = computeSygeferiegodtgoerelse({ values: buildValues(true), stamdata, tafRanges });
    const withoutInactive = computeSygeferiegodtgoerelse({ values: buildValues(false), stamdata, tafRanges });

    // Kun det aktive ansættelsesforhold producerer et selvstændigt SFGG-krav.
    expect(withInactive.perAnsaettelsesforhold.map((entry) => entry.ansaettelsesforholdId)).toEqual(['af-aktiv']);

    const dedWith = withInactive.perAnsaettelsesforhold[0]?.feriepengeModtagetFormula?.totalOre ?? 0;
    const dedWithout = withoutInactive.perAnsaettelsesforhold[0]?.feriepengeModtagetFormula?.totalOre ?? 0;
    // Det inaktive ansættelsesforholds indkomst i perioden løfter fradraget for det aktive.
    expect(dedWith).toBeGreaterThan(dedWithout);
  });

  it('floorer SFGG til 0 når feriepenge-fradraget overstiger kravet (G10 Math.min-cap)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      // Meget høj indkomst → feriepenge-fradraget overstiger langt den lave manuelle dagssats.
      indtaegtsoplysningerTableData: [janIncomeRow('loen-jan-2024', 100000)],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-1',
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: asAmount(1),
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
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }],
    });

    const entry = result.perAnsaettelsesforhold[0];
    expect(entry?.totalOre).toBe(0);
    // Aldrig negativ; fradraget cappes til bruttokravet, så SFGG lander på præcis 0.
    for (const segment of entry?.segments ?? []) {
      expect(segment.beregnetSfggoereOre).toBe(0);
      expect(segment.feriepengeAfSygeloenOre).toBe(segment.feriepengekravOre);
    }
    // Øre-invariant (G10): sum(feriepenge) + sum(SFGG) + sum(alleredeBetalt) = sum(brutto).
    const sum = (pick: (s: (typeof entry.segments)[number]) => number): number =>
      (entry?.segments ?? []).reduce((acc, segment) => acc + pick(segment), 0);
    expect(sum((s) => s.feriepengeAfSygeloenOre) + sum((s) => s.beregnetSfggoereOre) + sum((s) => s.alleredeBetaltOre))
      .toBe(sum((s) => s.feriepengekravOre));
  });

  it('opretholder øre-invarianten sum(feriepenge)+sum(SFGG)+sum(alleredeBetalt)=sum(brutto) med allerede betalt', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [janIncomeRow('loen-jan-2024', 10000)],
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
      sfggAlleredeBetaltBeloeb: asAmount(20),
    }];

    const result = computeSygeferiegodtgoerelse({
      values,
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    const entry = result.perAnsaettelsesforhold[0];
    expect(entry?.segments.length).toBeGreaterThan(0);
    const sum = (pick: (s: (typeof entry.segments)[number]) => number): number =>
      (entry?.segments ?? []).reduce((acc, segment) => acc + pick(segment), 0);
    // Alle tre fradrags-/kravkomponenter er i spil (allerede betalt > 0).
    expect(sum((s) => s.alleredeBetaltOre)).toBeGreaterThan(0);
    expect(sum((s) => s.feriepengeAfSygeloenOre) + sum((s) => s.beregnetSfggoereOre) + sum((s) => s.alleredeBetaltOre))
      .toBe(sum((s) => s.feriepengekravOre));
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
        col0_dag: undefined,
        col1_dag: undefined,
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

    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') };
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
        col0_dag: undefined,
        col1_dag: undefined,
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
      stamdata: { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });

    expect(result.totalOre).toBe(0);
    expect(result.perAnsaettelsesforhold).toHaveLength(0);
  });
});

describe('buildSfggPeriode', () => {
  const base = {
    tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }],
    firstExcludedDate: null,
    employmentHadFirstExcludedDate: false,
    capReachedDate: null,
    ansaettelsesophorDate: null,
    foerstEfterSygeloen: false,
    employment: createEmployment(),
    ferieperioder: [] as ErstatningsopgoerelseValues['ferieperioder'],
  };

  it('uden afkortninger fratrækker kun ferie fra visningsperioden', () => {
    const periode = buildSfggPeriode({
      ...base,
      ferieperioder: [{ id: 'ferie-1', fra: iso('2024-01-10'), til: iso('2024-01-12') }],
    });
    expect(periode.afkortninger).toEqual([]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
    expect(periode.eligibleRanges).toEqual([
      { fra: iso('2024-01-01'), til: iso('2024-01-09') },
      { fra: iso('2024-01-13'), til: iso('2024-01-31') },
    ]);
  });

  it('fjerner første sygedag og registrerer foersteSygedag-afkortning', () => {
    const periode = buildSfggPeriode({
      ...base,
      firstExcludedDate: iso('2024-01-01'),
      employmentHadFirstExcludedDate: true,
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'foersteSygedag' }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-02'), til: iso('2024-01-31') }]);
  });

  it('registrerer ikke foersteSygedag når ansættelsesforholdet ikke havde den udeladte dag', () => {
    const periode = buildSfggPeriode({
      ...base,
      firstExcludedDate: iso('2024-01-01'),
      employmentHadFirstExcludedDate: false,
    });
    expect(periode.afkortninger).toEqual([]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
  });

  it('klipper ved 4-måneders-loftet og registrerer cap4mdr med dato', () => {
    const periode = buildSfggPeriode({ ...base, capReachedDate: iso('2024-01-15') });
    expect(periode.afkortninger).toEqual([{ aarsag: 'cap4mdr', dato: iso('2024-01-15') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
  });

  it('klipper ved ansættelsesophør og registrerer ansaettelsesophoer med dato', () => {
    const periode = buildSfggPeriode({ ...base, ansaettelsesophorDate: iso('2024-01-20') });
    expect(periode.afkortninger).toEqual([{ aarsag: 'ansaettelsesophoer', dato: iso('2024-01-20') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-20') }]);
  });

  it('angiver kun loftet når det nås før eller samtidig med ophør, men klipper ved begge', () => {
    const periode = buildSfggPeriode({
      ...base,
      capReachedDate: iso('2024-01-10'),
      ansaettelsesophorDate: iso('2024-01-20'),
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'cap4mdr', dato: iso('2024-01-10') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-10') }]);
  });

  it('angiver ophør når det ligger før loftet', () => {
    const periode = buildSfggPeriode({
      ...base,
      capReachedDate: iso('2024-01-25'),
      ansaettelsesophorDate: iso('2024-01-15'),
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'ansaettelsesophoer', dato: iso('2024-01-15') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
  });

  it('fratrækker arbejdsgiverbetalt sygeløn og registrerer sygeloen når der er overlap', () => {
    const employment = createEmployment({
      loenperiode: 'maaned',
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
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
    });
    const periode = buildSfggPeriode({ ...base, foerstEfterSygeloen: true, employment });
    expect(periode.afkortninger).toEqual([{ aarsag: 'sygeloen' }]);
    expect(periode.visningsperiode).toEqual([]);
  });

  it('registrerer ikke sygeloen når der ikke er sygelønsoverlap', () => {
    const periode = buildSfggPeriode({ ...base, foerstEfterSygeloen: true });
    expect(periode.afkortninger).toEqual([]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
  });

  it('angiver loftet når det nås præcis samtidig med ophør (samme dato)', () => {
    // Grænsetilfældet cap === ophør: den gensidige udelukkelse (`capReachedDate <= ansaettelsesophorDate`)
    // skal lade loftet vinde, ikke ophøret.
    const periode = buildSfggPeriode({
      ...base,
      capReachedDate: iso('2024-01-15'),
      ansaettelsesophorDate: iso('2024-01-15'),
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'cap4mdr', dato: iso('2024-01-15') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
  });

  it('registrerer ikke sygeloen når sygelønsperioden først ligger efter loft-klippet', () => {
    // Sygelønnen (20.-31. jan) overlapper KUN den oprindelige periode, ikke den loft-klippede
    // (1.-15. jan). Overlap-tjekket sker bevidst EFTER klippet, så der må ikke registreres en
    // sygeloen-afkortning. Fanger en regression, der flytter overlap-tjekket før loft-klippet.
    const employment = createEmployment({
      loenperiode: 'dag',
      indtaegtsoplysningerTableData: [{
        id: 'loen-sen-jan-2024',
        col0_maaned: '',
        col1_maaned: '',
        col0_uge: '',
        col1_uge: '',
        col0_dag: iso('2024-01-20'),
        col1_dag: iso('2024-01-31'),
        col2: asAmount(10000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    });
    const periode = buildSfggPeriode({
      ...base,
      capReachedDate: iso('2024-01-15'),
      foerstEfterSygeloen: true,
      employment,
    });
    expect(periode.afkortninger).toEqual([{ aarsag: 'cap4mdr', dato: iso('2024-01-15') }]);
    expect(periode.visningsperiode).toEqual([{ fra: iso('2024-01-01'), til: iso('2024-01-15') }]);
  });

  it('bevarer rækkefølgen første-sygedag → loft → sygeløn i afkortnings-listen', () => {
    const employment = createEmployment({
      loenperiode: 'maaned',
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
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
    });
    const periode = buildSfggPeriode({
      ...base,
      firstExcludedDate: iso('2024-01-01'),
      employmentHadFirstExcludedDate: true,
      capReachedDate: iso('2024-01-20'),
      foerstEfterSygeloen: true,
      employment,
    });
    expect(periode.afkortninger.map((a) => a.aarsag)).toEqual(['foersteSygedag', 'cap4mdr', 'sygeloen']);
  });
});
