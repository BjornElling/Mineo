import { createSfggIngenRow } from '../../utils/sfggTestSupport';
import { moneyOre } from '../../../domain/money/money';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { applyAutoSatsFields } from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import * as indtaegtPerioderModule from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { buildIndkomstSkadestidspunkt } from '../../../domain/erstatningsopgoerelse/engines/indkomstSkadestidspunktBeregning';
import { buildLoenudviklingBeregning } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { computeSygeferiegodtgoerelse } from '../../../domain/erstatningsopgoerelse/engines/sfggEngine';
import { computeTafNettoBeregning } from '../../../domain/erstatningsopgoerelse/engines/tafNettoBeregning';
import { buildOffentligeYdelserReguleringTableData } from '../../../domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import { buildSfggReguleringOpslagMap } from '../../../domain/erstatningsopgoerelse/engines/tafNettoBeregning';
import { computeTafBeregningsenhed } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
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
  tillaegAngivesSom: patch.tillaegAngivesSom ?? 'procent',
  fuldLoenUnderFerie: patch.fuldLoenUnderFerie ?? 'Ja',
  harAnciennitetstillaegEfterSkadedatoen: patch.harAnciennitetstillaegEfterSkadedatoen ?? false,
  anciennitetstillaegDato: patch.anciennitetstillaegDato,
  anciennitetstillaegSatsAngivesPer: patch.anciennitetstillaegSatsAngivesPer ?? 'Måned',
  anciennitetstillaegSats: patch.anciennitetstillaegSats,
  loenPaaHelligdage: patch.loenPaaHelligdage ?? 'Almindelig løn',
  beregnStoreBededagstillaeg: patch.beregnStoreBededagstillaeg ?? false,
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
  offentligLoenEkstraGrundloenAngivesPer: patch.offentligLoenEkstraGrundloenAngivesPer ?? 'Måned',
  indtaegtsoplysningerTableData: patch.indtaegtsoplysningerTableData ?? [],
  ...patch,
  loenudviklingManuelProcentsatsTableData: patch.loenudviklingManuelProcentsatsTableData ?? [],
});

describe('computeTafNettoBeregning', () => {
  it('regulerer SFGG fra referenceperioden med SBLON2 uanset lønnens senere basisdato', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(40000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2025-01-01');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Statistik';
    values.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel = 'SBLON2 (Danmarks Statistik)';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      indtaegtsoplysningerTableData: [{ id: 'reference', col0_maaned: '1', col1_maaned: '2022', col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined, col2: asAmount(62000), col3: undefined, col4: undefined, col5: undefined }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven',
      sfggReferenceperiodeFra: iso('2022-01-01'), sfggReferenceperiodeTil: iso('2022-01-31'),
    }];
    const result = computeTafNettoBeregning(values, { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2022-01-01') }, {
      tafRanges: [2022, 2023, 2024, 2025].map((year) => ({ fra: iso(`${year}-02-01`), til: iso(`${year}-02-07`) })),
    });
    // 250 × [111,9; 115,7; 119,6; 125,4] / 111,9, afrundet til øre.
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments.map((segment) => segment.satsOre))
      .toEqual([25000, 25849, 26720, 28016]);
    values.sfggAnsaettelsesforhold[0].sfggBeregningskilde = 'Manuelt angivet';
    values.sfggAnsaettelsesforhold[0].sfggManuelDagssats = asAmount(250);
    const manuel = computeTafNettoBeregning(values, { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2022-01-01') }, {
      tafRanges: [2022, 2023, 2024, 2025].map((year) => ({ fra: iso(`${year}-02-01`), til: iso(`${year}-02-07`) })),
    });
    expect(manuel.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments.map((segment) => segment.satsOre))
      .toEqual([25000, 25000, 25000, 25000]);
  });

  it('bruger direkte overenskomstsats uden yderligere regulering selv når lønnen følger KRL', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.dagsloenenUdgoer = asAmount(1000);
    values.angivetDagsloenOpreguleresFraDato = iso('2023-01-01');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    values.eoAngivetLoenLoenudvikling.loenudviklingKRLSatstabel = 'KTO (kommuner)';
    values.loenindkomstAnsaettelsesforhold = [createEmployment({ harOverenskomst: true, overenskomstId: 'bygge-anlaeg' })];
    values.sfggAnsaettelsesforhold = [{ ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Overenskomst', sfggSatsvalg: 'Ufaglaert-Koebenhavn' }];
    const result = computeTafNettoBeregning(values, { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') }, {
      tafRanges: [{ fra: iso('2024-01-15'), til: iso('2024-01-15') }],
    });
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[0])
      .toMatchObject({ satsOre: 18445, reguleringsindeks: null, agPensionPct: 10.15 });
  });

  it('bevarer A4-reguleringen for seks SFGG-dage når løse feriedage fjerner hele TAF-segmentet', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.dagsloenenUdgoer = asAmount(1000);
    values.angivetDagsloenOpreguleresFraDato = iso('2023-01-01');
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    values.eoAngivetLoenLoenudvikling.loenudviklingKRLSatstabel = 'KTO (kommuner)';
    values.tafPerioder = [{ id: 'taf', fra: iso('2024-09-23'), til: iso('2024-10-04'), loseFeriedage: 6 }];
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      indtaegtsoplysningerTableData: [{ id: 'reference', col0_maaned: '1', col1_maaned: '2023', col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined, col2: asAmount(10000), col3: undefined, col4: undefined, col5: undefined }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven',
      sfggReferenceperiodeFra: iso('2023-01-01'), sfggReferenceperiodeTil: iso('2023-01-31'),
    }];
    const result = computeTafNettoBeregning(values, { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') }, {
      tafRanges: [{ fra: iso('2024-09-23'), til: iso('2024-10-04') }],
    });
    expect(result.loenudvikling?.beregnedeSegmenter.map((segment) => segment.fra)).toEqual([iso('2024-10-01')]);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[0]).toMatchObject({
      fra: iso('2024-09-23'), til: iso('2024-09-30'), antalDage: 6,
      reguleringsindeks: 105.6, satsOre: 6000, feriepengekravOre: 36000,
    });
  });

  it('bevarer A3-ydelsesdelen på 132.912 kr. og samme TAF-netto ved ombytning af jobkort', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2022-01-01');
    values.tafBeregningsperiodeTil = iso('2022-12-31');
    values.regulerOffentligeYdelser = 'Ja';
    values.loenindkomstAnsaettelsesforhold = ['2022-12-31', '2024-06-01'].map((dato, index) => createEmployment({
      id: `af-${index}`, feriePct: 0, pensionPct: 0, fuldLoenUnderFerie: 'Ja',
      loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
      saerligFraDatoRegulering: iso(dato),
      indtaegtsoplysningerTableData: [{ id: `loen-${index}`, col0_maaned: '1', col1_maaned: '2022', col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined, col2: asAmount(10000), col3: undefined, col4: undefined, col5: undefined }],
    }));
    values.offentligeYdelserRows = [{ id: 'dagpenge', fraDato: iso('2022-01-01'), tilDato: iso('2022-12-31'), ydelse: asAmount(120000), tillaeg: undefined, ydelsestype: 'dagpenge' }];
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-15') };
    const options = { tafRanges: [{ fra: iso('2025-01-01'), til: iso('2025-12-31') }] };
    const foer = computeTafNettoBeregning(values, stamdata, options);
    values.loenindkomstAnsaettelsesforhold.reverse();
    const efter = computeTafNettoBeregning(values, stamdata, options);
    expect(foer.offentligeYdelserUdvikling?.total).toEqual({ status: 'ok', value: 13291200 });
    expect(efter.offentligeYdelserUdvikling?.total).toEqual({ status: 'ok', value: 13291200 });
    expect(foer.tabtArbejdsfortjenesteOre).toBe(15443442);
    expect(efter.tabtArbejdsfortjenesteOre).toBe(15443442);
  });

  it('regulerer SFGG med jobbets Statistik selv om lønnen kun findes i SFGG-referenceperioden', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2023-01-01');
    values.tafBeregningsperiodeTil = iso('2023-01-31');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: 'SBLON2 (Danmarks Statistik)',
      indtaegtsoplysningerTableData: [{ id: 'reference', col0_maaned: '1', col1_maaned: '2022', col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined, col2: asAmount(62000), col3: undefined, col4: undefined, col5: undefined }],
    })];
    values.offentligeYdelserRows = [{ id: 'dagpenge', fraDato: iso('2023-01-01'), tilDato: iso('2023-01-31'), ydelse: asAmount(12000), tillaeg: undefined, ydelsestype: 'dagpenge' }];
    values.sfggAnsaettelsesforhold = [{
      ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven',
      sfggReferenceperiodeFra: iso('2022-01-01'), sfggReferenceperiodeTil: iso('2022-01-31'),
    }];
    const result = computeTafNettoBeregning(values, { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-02-01') }, {
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });
    expect(result.loenudvikling?.loenudviklingTotal).toEqual({ status: 'ok', value: 0 });
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[0])
      .toMatchObject({ satsOre: 26720, reguleringsindeks: 106.88 });
    values.loenindkomstAnsaettelsesforhold.push(createEmployment({
      id: 'af-bp', loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [{ id: 'loen-bp', col0_maaned: '1', col1_maaned: '2023', col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined, col2: asAmount(1000), col3: undefined, col4: undefined, col5: undefined }],
    }));
    const medAndetJob = computeTafNettoBeregning(values, { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-02-01') }, {
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });
    expect(medAndetJob.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[0])
      .toMatchObject({ satsOre: 26720, reguleringsindeks: 106.88 });
    values.loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag = 'KL-lønaftaler';
    const klUdenLoengrundlag = computeTafNettoBeregning(values, { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-02-01') }, {
      tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-01') }],
    });
    expect(klUdenLoengrundlag.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[0])
      .toMatchObject({ satsOre: 26036, reguleringsindeks: null, klTrin: [
        { dato: iso('2022-10-01'), pct: 2.55, retning: 'frem', loenFoer: 250, loenEfter: 256.38 },
        { dato: iso('2023-04-01'), pct: 0.3, retning: 'frem', loenFoer: 256.38, loenEfter: 257.15 },
        { dato: iso('2023-10-01'), pct: 1.25, retning: 'frem', loenFoer: 257.15, loenEfter: 260.36 },
      ] });
  });

  it('fremskriver offentlige ydelser fra beregningsperioden som positiv hypotetisk TAF-indkomst', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.regulerOffentligeYdelser = 'Ja';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [];
    values.offentligeYdelserRows = [{
      id: 'dagpenge-jan-2024',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-31'),
      ydelse: asAmount(3100),
      tillaeg: undefined,
      ydelsestype: 'dagpenge',
    }];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2025-01-01'), til: iso('2025-01-31') }] }
    );

    expect(result.loenudvikling?.loenudviklingTotal).toEqual({ status: 'ok', value: 0 });
    expect(result.offentligeYdelserUdvikling?.reguleringsBaseIso).toBe(iso('2024-01-31'));
    expect(result.offentligeYdelserUdvikling?.entries).toHaveLength(1);
    expect(result.offentligeYdelserUdvikling?.entries[0]).toEqual(expect.objectContaining({
      typeKey: 'dagpenge',
      label: 'Dagpenge',
      total: { status: 'ok', value: 322090 },
    }));
    const segment = result.offentligeYdelserUdvikling?.entries[0]?.beregnedeSegmenter[0];
    expect(segment).toEqual(expect.objectContaining({
      kind: 'maaneder',
      fra: iso('2025-01-01'),
      til: iso('2025-01-31'),
      maanedsloenOre: moneyOre(310000),
      amountOre: moneyOre(322090),
    }));
    expect(segment?.deltaPct).toBeCloseTo(3.9, 10);
    expect(result.tabtArbejdsfortjenesteOre).toBe(322090);
  });

  it('medtager offentlige ydelser uden regulering når regulering er slået fra', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.regulerOffentligeYdelser = 'Nej';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [];
    values.offentligeYdelserRows = [{
      id: 'dagpenge-jan-2024',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-31'),
      ydelse: asAmount(3100),
      tillaeg: undefined,
      ydelsestype: 'dagpenge',
    }];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2025-01-01'), til: iso('2025-01-31') }] }
    );

    expect(result.offentligeYdelserUdvikling?.reguleringsLabel).toBe('Ingen');
    expect(result.offentligeYdelserUdvikling?.total).toEqual({ status: 'ok', value: 310000 });
    expect(result.tabtArbejdsfortjenesteOre).toBe(310000);
  });

  it('bygger reguleringstabel for offentlige ydelser med årlig og akkumuleret regulering', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [];
    values.offentligeYdelserRows = [{
      id: 'dagpenge-jan-2024',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-31'),
      ydelse: asAmount(3100),
      tillaeg: undefined,
      ydelsestype: 'dagpenge',
    }];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2025-01-01'), til: iso('2026-01-31') }] }
    );

    expect(result.offentligeYdelserUdvikling).not.toBeNull();
    let table: ReturnType<typeof buildOffentligeYdelserReguleringTableData> | undefined;
    expect(() => {
      table = result.offentligeYdelserUdvikling
        ? buildOffentligeYdelserReguleringTableData(result.offentligeYdelserUdvikling)
        : null;
    }).not.toThrow();

    expect(table).toEqual({
      columns: ['Reguleringsdato', 'Regulering', 'Akkumuleret regulering'],
      rows: [
        ['01-01-2025', '3,9 %', '3,9 %'],
        ['01-01-2026', '4,8 %', '8,89 %'],
      ],
    });
  });

  it('forankrer offentlige ydelser i beregningsperiodens slutdato trods et jobs særlige dato', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      loenudviklingBeregningsgrundlag: 'Statistik',
      loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
      saerligFraDatoRegulering: iso('2024-07-01'),
    })];
    values.offentligeYdelserRows = [{
      id: 'dagpenge-jan-2024',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-31'),
      ydelse: asAmount(3100),
      tillaeg: undefined,
      ydelsestype: 'dagpenge',
    }];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2025-01-01'), til: iso('2025-01-31') }] }
    );

    expect(result.offentligeYdelserUdvikling?.reguleringsBaseIso).toBe(iso('2024-01-31'));
    expect(result.offentligeYdelserUdvikling?.entries[0]?.beregnedeSegmenter[0]?.deltaPct).toBeCloseTo(3.9, 10);
  });

  it('bevarer ydelsesgrundlaget når første ansættelsesforhold har Ingen', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.regulerOffentligeYdelser = 'Ja';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-ingen',
        loenudviklingBeregningsgrundlag: 'Ingen',
      }),
      createEmployment({
        id: 'af-statistik',
        navnPaaArbejdssted: 'Arbejdssted 2',
        loenudviklingBeregningsgrundlag: 'Statistik',
        loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
        saerligFraDatoRegulering: iso('2024-07-01'),
      }),
    ];
    values.offentligeYdelserRows = [{
      id: 'dagpenge-jan-2024',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-31'),
      ydelse: asAmount(3100),
      tillaeg: undefined,
      ydelsestype: 'dagpenge',
    }];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2025-01-01'), til: iso('2025-01-31') }] }
    );

    expect(result.offentligeYdelserUdvikling?.reguleringsBaseIso).toBe(iso('2024-01-31'));
    expect(result.offentligeYdelserUdvikling?.entries[0]?.beregnedeSegmenter[0]?.deltaPct).toBeCloseTo(3.9, 10);
  });

  it('behandler midlertidigt EET som øvrige offentlige ydelser i hypotetisk TAF-indkomst', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [];
    values.offentligeYdelserRows = [{
      id: 'midlertidigt-eet-jan-2024',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-31'),
      ydelse: asAmount(4200),
      tillaeg: undefined,
      ydelsestype: 'midlertidigt_eet',
    }];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2025-01-01'), til: iso('2025-01-31') }] }
    );

    expect(result.offentligeYdelserUdvikling?.entries[0]).toEqual(expect.objectContaining({
      typeKey: 'midlertidigt_eet',
      label: 'Midlertidigt EET',
      total: { status: 'ok', value: 436380 },
    }));
    expect(result.tabtArbejdsfortjenesteOre).toBe(436380);
  });

  it('bruger «Ansættelsesforhold 1» som fallback for en arbejdsgiver uden navn', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen',
    };
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      navnPaaArbejdssted: '   ',
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(1000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }] }
    );

    expect(result.tafIndtaegter?.entries).toContainEqual({ label: 'Ansættelsesforhold 1', amountOre: moneyOre(100000) });
  });

  it('samler begge ydelsestyper der udløser TAF-forbehold', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen',
    };
    values.loenindkomstAnsaettelsesforhold = [
      createEmployment({ id: 'af-forbehold', loenudviklingBeregningsgrundlag: 'Ingen' }),
    ];
    values.offentligeYdelserRows = [
      {
        id: 'kontanthjaelp-jan-2024',
        fraDato: iso('2024-01-01'),
        tilDato: iso('2024-01-31'),
        ydelse: asAmount(1000),
        tillaeg: undefined,
        ydelsestype: 'kontanthjaelp',
      },
      {
        id: 'ressourceforloebsydelse-jan-2024',
        fraDato: iso('2024-01-01'),
        tilDato: iso('2024-01-31'),
        ydelse: asAmount(500),
        tillaeg: undefined,
        ydelsestype: 'ressourceforloebsydelse',
      },
    ];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }] }
    );

    expect(result.tafIndtaegter?.forbeholdYdelsestyper).toEqual([
      'kontanthjaelp',
      'ressourceforloebsydelse',
    ]);
  });

  it('bruger arbejdsdage-divisor og arbejdsdage i TAF-perioden for offentlige ydelser', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.regulerOffentligeYdelser = 'Nej';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-05');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      id: 'af-arbejdsdage',
      loenperiode: 'dag',
      loenPaaHelligdage: 'SH-udbetaling',
      beregnStoreBededagstillaeg: false,
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '',
        col1_maaned: '',
        col0_uge: '',
        col1_uge: '',
        col0_dag: toISODateString('2024-01-02'),
        col1_dag: toISODateString('2024-01-05'),
        col2: asAmount(1),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.offentligeYdelserRows = [{
      id: 'sygedagpenge-jan-2024',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-05'),
      ydelse: asAmount(5000),
      tillaeg: undefined,
      ydelsestype: 'sygedagpenge',
    }];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2024-01-08'), til: iso('2024-01-12') }] }
    );

    expect(result.offentligeYdelserUdvikling?.entries[0]?.beregnedeSegmenter[0]).toEqual(expect.objectContaining({
      kind: 'arbejdsdage',
      arbejdsdage: 5,
      dagsloenOre: moneyOre(125000),
      deltaPct: 0,
      amountOre: moneyOre(625000),
    }));
    expect(result.offentligeYdelserUdvikling?.total).toEqual({ status: 'ok', value: 625000 });
  });

  it('giver SFGG adgang til per-ansættelse reguleringssegmenter ved beregningsperiode', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2023-12-01');
    values.tafBeregningsperiodeTil = iso('2023-12-31');
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      feriePct: 16.95,
      beregnStoreBededagstillaeg: true,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(2666.28),
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

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2024-02-26'), til: iso('2024-03-05') }] }
    );

    expect(result.loenudvikling?.perAnsaettelse).toHaveLength(1);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[0]).toEqual(
      expect.objectContaining({
        fra: iso('2024-02-26'),
        til: iso('2024-02-29'),
        reguleringsindeks: 100.36,
      })
    );
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2024-03-01'),
        til: iso('2024-03-05'),
        reguleringsindeks: 105.46,
      })
    );
  });

  it('holder loenudvikling.perAnsaettelse tom ved globalt angivet loen-grundlag men giver stadig SFGG shared segmenter', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      overenskomstId: 'industriens-overenskomst',
      beregnStoreBededagstillaeg: true,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };
    values.loenindkomstAnsaettelsesforhold = [createEmployment({
      id: 'af-global',
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      feriePct: 16.95,
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(2666.28),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: 'af-global',
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

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2024-02-26'), til: iso('2024-03-05') }] }
    );

    expect(result.loenudvikling?.perAnsaettelse).toEqual([]);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments).toHaveLength(2);
    expect(result.sygeferiegodtgoerelse.perAnsaettelsesforhold[0]?.segments[1]).toEqual(
      expect.objectContaining({
        fra: iso('2024-03-01'),
        til: iso('2024-03-05'),
        reguleringsindeks: 105.79,
      })
    );
  });

  it('beregner lønudvikling med særskilt reguleringsdato pr. ansættelsesforhold', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        navnPaaArbejdssted: 'Arbejdssted 1',
        loenudviklingBeregningsgrundlag: 'Statistik',
        loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
        saerligFraDatoRegulering: iso('2023-01-01'),
        indtaegtsoplysningerTableData: [{
          id: 'loen-jan-2024-af-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: asAmount(31000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        }],
      }),
      createEmployment({
        id: 'af-2',
        navnPaaArbejdssted: 'Arbejdssted 2',
        loenudviklingBeregningsgrundlag: 'Statistik',
        loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
        saerligFraDatoRegulering: iso('2024-01-01'),
        indtaegtsoplysningerTableData: [{
          id: 'loen-jan-2024-af-2',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: asAmount(27000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        }],
      }),
    ];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2025-01-01'), til: iso('2025-01-31') }] }
    );

    expect(result.loenudvikling?.perAnsaettelse).toHaveLength(2);
    const af1 = result.loenudvikling?.perAnsaettelse.find((entry) => entry.ansaettelsesforholdId === 'af-1');
    const af2 = result.loenudvikling?.perAnsaettelse.find((entry) => entry.ansaettelsesforholdId === 'af-2');
    expect(af1?.loenudviklingTotal.status).toBe('ok');
    expect(af2?.loenudviklingTotal.status).toBe('ok');
    expect(af1?.beregnedeSegmenter[0]?.deltaPct).not.toBe(af2?.beregnedeSegmenter[0]?.deltaPct);
    expect(result.loenudvikling?.loenudviklingTotal.status).toBe('ok');
  });

  it('genbruger beregningsperiode-indkomsten mellem indkomstskadestidspunkt og loenudvikling', () => {
    const buildIncomeForRangesSpy = vi.spyOn(indtaegtPerioderModule, 'buildIncomeForRanges');
    try {
      const values = createErstatningsopgoerelseInitialValues();
      values.eoNummer = '2';
      values.beregnesUdFra = 'Beregningsperiode';
      values.tafBeregningsperiodeFra = iso('2024-01-01');
      values.tafBeregningsperiodeTil = iso('2024-01-31');
      values.loenindkomstAnsaettelsesforhold = [
        createEmployment({
          id: 'af-1',
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [{
            id: 'loen-jan-2024',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: undefined,
            col1_dag: undefined,
            col2: asAmount(30000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          }],
        }),
        createEmployment({
          id: 'af-2',
          navnPaaArbejdssted: 'Arbejdssted 2',
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: [{
            id: 'loen-jan-2024-af-2',
            col0_maaned: '1',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: undefined,
            col1_dag: undefined,
            col2: asAmount(15000),
            col3: undefined,
            col4: undefined,
            col5: undefined,
          }],
        }),
      ];

      computeTafNettoBeregning(
        values,
        { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-02-01') },
        { tafRanges: [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }] }
      );

      const beregningsperiodeCalls = buildIncomeForRangesSpy.mock.calls.filter(
        ([callValues, ranges]) =>
          callValues === values
          && ranges.length === 1
          && ranges[0]?.fra === iso('2024-01-01')
          && ranges[0]?.til === iso('2024-01-31')
      );
      expect(beregningsperiodeCalls).toHaveLength(1);
    } finally {
      buildIncomeForRangesSpy.mockRestore();
    }
  });

  it('bevarer samme resultat som en ukachet beregning ved flere ansættelsesforhold', () => {
    const values = createErstatningsopgoerelseInitialValues();
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-02-01') };
    const tafRanges = [{ fra: iso('2024-02-01'), til: iso('2024-02-29') }] as const;

    values.eoNummer = '2';
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2024-01-01');
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        feriePct: 12.5,
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [{
          id: 'loen-jan-2024-af-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: asAmount(30000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        }],
      }),
      createEmployment({
        id: 'af-2',
        navnPaaArbejdssted: 'Arbejdssted 2',
        feriePct: 12.5,
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [{
          id: 'loen-jan-2024-af-2',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: asAmount(15000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        }],
      }),
    ];
    values.sfggAnsaettelsesforhold = values.loenindkomstAnsaettelsesforhold.map((employment) => ({
      ansaettelsesforholdId: employment.id,
      sfggBeregningskilde: 'Ferieloven',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: iso('2024-01-01'),
      sfggReferenceperiodeTil: iso('2024-01-31'),
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }));

    const result = computeTafNettoBeregning(values, stamdata, { tafRanges });

    const tafBeregningsenhed = computeTafBeregningsenhed(values);
    const expectedIndkomstSkadestidspunkt = buildIndkomstSkadestidspunkt(values, stamdata, tafBeregningsenhed);
    const expectedLoenudvikling = buildLoenudviklingBeregning(
      values,
      stamdata,
      tafBeregningsenhed,
      expectedIndkomstSkadestidspunkt,
      { tafRanges }
    );
    const expectedSygeferiegodtgoerelse = computeSygeferiegodtgoerelse({
      values,
      stamdata,
      tafRanges,
      reguleringOpslagPerAnsaettelse: buildSfggReguleringOpslagMap(values, expectedLoenudvikling),
    });

    expect(result.indkomstSkadestidspunkt).toEqual(expectedIndkomstSkadestidspunkt);
    expect(result.loenudvikling).toEqual(expectedLoenudvikling.model);
    expect(result.sygeferiegodtgoerelse).toEqual(expectedSygeferiegodtgoerelse);
  });

  it('bruger reguleringsdatoens satser i både visningen og grundlønnen, når satsen ændres i beregningsperioden', () => {
    // Byggeri og anlæg: AG-pension 8,15 % til og med maj 2023 og 10,15 % fra juni 2023.
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.kravPaaTabtArbejdsfortjeneste = 'Ja';
    values.tafBeregningsperiodeFra = iso('2023-01-01');
    values.tafBeregningsperiodeTil = iso('2023-12-31');
    values.tafPerioder = [{ id: 'taf', fra: iso('2024-01-01'), til: iso('2024-12-31'), loseFeriedage: 0 }];
    values.loenindkomstAnsaettelsesforhold = [applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenperiode: 'maaned',
      feriePct: 0,
      storeBededagPct: 0,
      fuldLoenUnderFerie: 'Ja',
      loenPaaHelligdage: 'Almindelig løn',
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: Array.from({ length: 12 }, (_, index) => ({
        id: `loen-${index}`, col0_maaned: String(index + 1), col1_maaned: '2023',
        col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined,
        col2: asAmount(30000), col3: undefined, col4: undefined, col5: undefined,
        fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
      })),
    }, iso('2023-12-31'))];
    values.sfggAnsaettelsesforhold = [];

    const result = computeTafNettoBeregning(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      { tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-12-31') }] }
    );

    // 360.000 + S/H 7 % (25.200) + pension 10,15 % af 385.200 (39.097,80) = 424.297,80 → 35.358,15 pr. måned.
    expect(result.indkomstSkadestidspunkt?.maanedsloen).toEqual({ status: 'ok', value: moneyOre(3535815) });
    expect(result.loenudvikling?.beregnedeSegmenter).toEqual([
      expect.objectContaining({ kind: 'maaneder', maaneder: 12, maanedsloenOre: moneyOre(3535815), amountOre: moneyOre(42429780) }),
    ]);
  });
});
