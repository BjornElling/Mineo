import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues, createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { buildIndkomstSkadestidspunkt } from '../../../domain/erstatningsopgoerelse/engines/indkomstSkadestidspunktBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

const setupAngivetDagsloen = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.beregnesUdFra = 'Angivet dagsløn';
  values.dagsloenenUdgoer = asAmount(1000);
  values.angivetDagsloenBaseretPaa = 'Testgrundlag';
  return values;
};

const expectOnlyPositiveArbejdsdagssegmenter = (values: ErstatningsopgoerelseValues): void => {
  const tafRanges = values.tafPerioder.flatMap((row) => {
    if (!row.fra || !row.til) return [];
    return [{ fra: row.fra, til: row.til }];
  });

  const model = buildLoenudviklingModel(
    values,
    { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2017-05-01') },
    TAF_BEREGNES_SOM.ARBEJDSDAGE,
    null,
    { tafRanges }
  );

  expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);
  expect(model.beregnedeSegmenter.every((segment) => segment.kind === 'arbejdsdage' && segment.arbejdsdage > 0)).toBe(true);
};

describe('buildLoenudviklingModel', () => {
  it('springer over overenskomstsegmenter uden TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-2017',
      fra: iso('2017-05-01'),
      til: iso('2026-03-31'),
      loseFeriedage: 5,
    }];
    values.ferieperioder = [{
      id: 'ferie-2017',
      fra: iso('2017-07-01'),
      til: iso('2017-07-31'),
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      overenskomstId: 'bygge-anlaeg',
      feriePct: 0,
      loenPaaHelligdage: 'Ingen',
      saerligFraDatoRegulering: iso('2017-05-02'),
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };

    expectOnlyPositiveArbejdsdagssegmenter(values);
  });

  it('lader første TAF-dag blive i første overenskomstsegment når reguleringsdatoen er dagen efter', () => {
    const values = setupAngivetDagsloen();
    values.angivetDagsloenOpreguleresFraDato = iso('2017-05-02');
    values.tafPerioder = [{
      id: 'taf-2017',
      fra: iso('2017-05-01'),
      til: iso('2017-05-31'),
      loseFeriedage: 5,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      overenskomstId: 'bygge-anlaeg',
      feriePct: 0,
      loenPaaHelligdage: 'Ingen',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2017-05-01') },
      TAF_BEREGNES_SOM.ARBEJDSDAGE,
      null,
      { tafRanges: [{ fra: iso('2017-05-01'), til: iso('2017-05-31') }] }
    );

    expect(model.beregnedeSegmenter[0]).toMatchObject({
      kind: 'arbejdsdage',
      fra: iso('2017-05-01'),
      til: iso('2017-05-31'),
      arbejdsdage: 16,
    });
  });

  it('springer over statistiksegmenter uden TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-easter',
      fra: iso('2024-03-29'),
      til: iso('2024-04-05'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      saerligFraDatoRegulering: iso('2024-03-29'),
      loenudviklingBeregningsgrundlag: 'Statistik',
      loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
    };

    expectOnlyPositiveArbejdsdagssegmenter(values);
  });

  it('springer over KRL-segmenter uden TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-easter',
      fra: iso('2024-03-29'),
      til: iso('2024-04-05'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      saerligFraDatoRegulering: iso('2024-03-29'),
      loenudviklingBeregningsgrundlag: 'KRL satstabel',
      loenudviklingKRLSatstabel: 'KTO (kommuner)',
    };

    expectOnlyPositiveArbejdsdagssegmenter(values);
  });

  it('springer over KL-lønaftaler-segmenter uden TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-easter',
      fra: iso('2024-03-29'),
      til: iso('2024-04-05'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      saerligFraDatoRegulering: iso('2024-03-29'),
      loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
    };

    expectOnlyPositiveArbejdsdagssegmenter(values);
  });

  it('beregner KL-deltaPct fra den trinvist regulerede løn', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-04-01');
    values.tafPerioder = [{
      id: 'taf-kl',
      fra: iso('2024-04-01'),
      til: iso('2026-03-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-04-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2024-04-01'), til: iso('2026-03-31') }] }
    );

    // Basisdato = 01-04-2024. Basissegmentet har deltaPct 0 og reguleret løn = basisløn.
    const baseSegment = model.beregnedeSegmenter.find((segment) => segment.fra === iso('2024-04-01'));
    expect(baseSegment?.deltaPct).toBe(0);
    expect(baseSegment?.reguleretLoenOre).toBe(3_000_000);

    // 01-10-2024: lønnen reguleres ét trin med periodesatsen 1,30 %.
    const segmentOkt2024 = model.beregnedeSegmenter.find((segment) => segment.fra === iso('2024-10-01'));
    expect(segmentOkt2024?.deltaPct).toBe(1.30);
    expect(segmentOkt2024?.reguleretLoenOre).toBe(3_039_000);
  });

  it('KL: opregulerer lønnen trinvist og afrunder til to decimaler på hvert trin', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-04-01');
    values.tafPerioder = [{
      id: 'taf-kl-chain',
      fra: iso('2024-04-01'),
      til: iso('2026-12-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-04-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2024-04-01'), til: iso('2026-12-31') }] }
    );

    // Den kæde-opregulerede, afrundede løn pr. reguleringsdato. Hvert trin afrundes
    // til to decimaler, og den afrundede værdi opreguleres til næste sats:
    //   30.000,00 →(1,30%) 30.390,00 →(0,30%) 30.481,17 →(0,75%) 30.709,78
    //            →(2,40%) 31.446,81 →(0,50%) 31.604,04
    const reguleretLoenFor = (fra: string): number | undefined => {
      const segment = model.beregnedeSegmenter.find((s) => s.fra === iso(fra));
      if (!segment || segment.kind !== 'maaneder' || segment.reguleretLoenOre === undefined) return undefined;
      return segment.reguleretLoenOre / 100;
    };

    // Basislønnen bevares som enhedsløn på alle segmenter (regulering ligger i deltaPct).
    expect(model.beregnedeSegmenter.every((s) => s.kind === 'maaneder' && s.maanedsloenOre === 3_000_000)).toBe(true);

    expect(reguleretLoenFor('2024-04-01')).toBe(30_000.00);
    expect(reguleretLoenFor('2024-10-01')).toBe(30_390.00);
    expect(reguleretLoenFor('2025-10-01')).toBe(30_481.17);
    expect(reguleretLoenFor('2025-11-01')).toBe(30_709.78);
    expect(reguleretLoenFor('2026-04-01')).toBe(31_446.81);
    expect(reguleretLoenFor('2026-10-01')).toBe(31_604.04);

    // TAF-beløbet for et segment bruger den afrundede løn: beløb = afrund(løn × måneder).
    const novemberSegment = model.beregnedeSegmenter.find((s) => s.fra === iso('2025-11-01'));
    expect(novemberSegment?.kind).toBe('maaneder');
    if (novemberSegment?.kind === 'maaneder') {
      const forventetOre = Math.round(30_709.78 * novemberSegment.maaneder * 100);
      expect(novemberSegment.amountOre).toBe(forventetOre);
    }
  });

  it('springer over manuelle reguleringssegmenter uden TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-easter',
      fra: iso('2024-03-29'),
      til: iso('2024-04-05'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenPaaHelligdage: 'Ingen',
      saerligFraDatoRegulering: iso('2024-03-29'),
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [
        {
          id: 'manual-base',
          dato: toISODateString('2024-03-29'),
          grundloen: asAmount(1000),
          feriepenge: 0,
          shSoSats: 0,
          fritvalg: 0,
          agPension: 0,
        },
        {
          id: 'manual-change',
          dato: toISODateString('2024-04-01'),
          grundloen: asAmount(1100),
          feriepenge: 0,
          shSoSats: 0,
          fritvalg: 0,
          agPension: 0,
        },
      ],
    };

    expectOnlyPositiveArbejdsdagssegmenter(values);
  });

  it('akkumulerer manuel procentsats som kædet indeks', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-07-01');
    values.tafPerioder = [{
      id: 'taf-manuel-procentsats',
      fra: iso('2024-07-01'),
      til: iso('2026-12-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Manuel procentsats',
      loenudviklingManuelProcentsatsTableData: [
        { id: 'base', dato: undefined, procent: 0 },
        { id: 'pct-2025', dato: iso('2025-01-01'), procent: 10 },
        { id: 'pct-2026', dato: iso('2026-01-01'), procent: 10 },
      ],
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-07-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2024-07-01'), til: iso('2026-12-31') }] }
    );

    expect(model.beregnedeSegmenter.map((segment) => ({
      fra: segment.fra,
      deltaPct: segment.deltaPct,
    }))).toEqual([
      { fra: iso('2024-07-01'), deltaPct: 0 },
      { fra: iso('2025-01-01'), deltaPct: 10 },
      { fra: iso('2026-01-01'), deltaPct: 21 },
    ]);
  });

  it('beregner negativ manuel Store Bededag-regulering for TAF-segmenter før 2024', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-06-01');
    values.tafPerioder = [{
      id: 'taf-cross-store-bededag',
      fra: iso('2023-01-01'),
      til: iso('2024-09-30'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenPaaHelligdage: 'Almindelig løn',
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [
        {
          id: 'manual-base',
          dato: toISODateString('2023-01-01'),
          grundloen: asAmount(1000),
          feriepenge: 0,
          shSoSats: 0,
          fritvalg: 0,
          agPension: 0,
        },
      ],
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2023-01-01'), til: iso('2024-09-30') }] }
    );

    const segment2023 = model.beregnedeSegmenter.find((segment) => segment.fra === iso('2023-01-01'));
    const segment2024 = model.beregnedeSegmenter.find((segment) => segment.fra === iso('2024-01-01'));

    expect(segment2023?.deltaPct).toBeLessThan(0);
    expect(segment2023?.deltaPct).toBe(-0.45);
    expect(segment2024?.deltaPct).toBe(0);
  });

  it('fejl-lukker (kaster) når ASL-basisindeks mangler for reguleringsdatoens år', () => {
    // Reguleringsdato i 2004 ligger før ASL-tabellens første år (2005). Den gamle
    // adfærd faldt tavst tilbage til første tilgængelige ASL-år; efter delegering til
    // opreguleringsmotoren fail-closes motoren nu med en synlig fejl frem for en
    // tavs "ingen regulering".
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2004-06-01');
    values.tafPerioder = [{
      id: 'taf-2005',
      fra: iso('2005-01-01'),
      til: iso('2005-01-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Statistik',
      loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
    };

    expect(() => buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2004-06-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2005-01-01'), til: iso('2005-01-31') }] }
    )).toThrow(/ASL basisindeks/);
  });

  it('splitter ASL-sporets segmenter på kalenderårs-grænser (delegering til splitIsoRangeByCalendarYearsInclusive)', () => {
    // Værn mod regression efter at den lokale while-løkke i buildAslReguleringsSegments
    // blev erstattet af den kanoniske splitIsoRangeByCalendarYearsInclusive. Et TAF-interval
    // der spænder over tre kalenderår skal give præcis ét segment pr. år med fra-datoer
    // 1. januar for de indre/sidste år (og det faktiske TAF-start for første år).
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2020-06-01');
    values.tafPerioder = [{
      id: 'taf-3-aar',
      fra: iso('2020-06-15'),
      til: iso('2022-08-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Statistik',
      loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2020-06-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2020-06-15'), til: iso('2022-08-31') }] }
    );

    const boundaries = model.beregnedeSegmenter.map((segment) => ({ fra: segment.fra, til: segment.til }));
    expect(boundaries).toEqual([
      { fra: iso('2020-06-15'), til: iso('2020-12-31') },
      { fra: iso('2021-01-01'), til: iso('2021-12-31') },
      { fra: iso('2022-01-01'), til: iso('2022-08-31') },
    ]);
  });

  it('returnerer 0 kr. når arbejdsdage-sporet ikke har TAF-arbejdsdage', () => {
    const values = setupAngivetDagsloen();
    values.tafPerioder = [{
      id: 'taf-christmas',
      fra: iso('2024-12-25'),
      til: iso('2024-12-26'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Ingen',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      TAF_BEREGNES_SOM.ARBEJDSDAGE,
      null,
      { tafRanges: [{ fra: iso('2024-12-25'), til: iso('2024-12-26') }] }
    );

    expect(model.loenudviklingTotal).toEqual({ status: 'ok', value: 0 });
    expect(model.beregnedeSegmenter).toEqual([]);
  });
});

describe('buildLoenudviklingModel — Manuelt angivet i Beløb-tilstand (tillæg regulerer)', () => {
  // Tillægslaget indgår i reguleringen i BEGGE tillægs-tilstande (Procent og Beløb) — for manuel
  // regulering via de manuelle rækkers tillægsprocenter, så deltaPct afspejler hele pakkeværdien.
  //
  // Beregningsperioden slutter 2022-12-31 (= anvendt reguleringsdato); TAF-perioden ligger efter.
  // Rækker dateret FØR reguleringsdatoen ignoreres i beregningen (se separat test nedenfor).
  //
  // rows: hvis udeladt bruges én basisrække (grundløn 1000, alle tillæg = 0).
  type ManualRowInput = Readonly<{
    id: string;
    dato: string;
    grundloen: number;
    feriepenge?: number;
    shSoSats?: number;
    fritvalg?: number;
    agPension?: number;
  }>;

  const buildManualBeregningsperiode = (
    tillaegAngivesSom: 'procent' | 'beloeb',
    options?: Readonly<{ loenPaaHelligdage?: 'Almindelig løn' | 'SH-udbetaling' | 'Ingen'; rows?: readonly ManualRowInput[] }>
  ): ErstatningsopgoerelseValues => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2022-01-01');
    values.tafBeregningsperiodeTil = iso('2022-12-31');
    values.tafPerioder = [{
      id: 'taf-cross-store-bededag',
      fra: iso('2023-01-01'),
      til: iso('2024-09-30'),
      loseFeriedage: 0,
    }];
    const rows = options?.rows ?? [{ id: 'manual-base', dato: '2022-12-31', grundloen: 1000 }];
    const baseAf = createDefaultLoenindkomstAnsaettelsesforhold();
    values.loenindkomstAnsaettelsesforhold = [{
      ...baseAf,
      id: 'af-beloeb',
      tillaegAngivesSom,
      // Sæt af-satserne til ikke-nul for at bevise, at deltaPct drives af de MANUELLE rækkers
      // procenter — ikke af satsfelterne ovenfor.
      feriePct: tillaegAngivesSom === 'beloeb' ? 99 : 0,
      fritvalgPct: tillaegAngivesSom === 'beloeb' ? 99 : undefined,
      shSoPct: tillaegAngivesSom === 'beloeb' ? 99 : undefined,
      pensionPct: tillaegAngivesSom === 'beloeb' ? 99 : undefined,
      loenPaaHelligdage: options?.loenPaaHelligdage ?? 'Almindelig løn',
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: rows.map((row) => ({
        id: row.id,
        dato: toISODateString(row.dato),
        grundloen: asAmount(row.grundloen),
        feriepenge: row.feriepenge ?? 0,
        shSoSats: row.shSoSats ?? 0,
        fritvalg: row.fritvalg ?? 0,
        agPension: row.agPension ?? 0,
      })),
      indtaegtsoplysningerTableData: [{
        id: 'r1',
        col0_maaned: '1',
        col1_maaned: '2022',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: asAmount(30000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
        fpFvShSoBeloeb: asAmount(4000),
        pensionBeloeb: asAmount(2000),
      }],
    }];
    return values;
  };

  const deltaForSegment = (values: ErstatningsopgoerelseValues, fra: string): number | undefined => {
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') };
    const indkomst = buildIndkomstSkadestidspunkt(values, stamdata, TAF_BEREGNES_SOM.MAANEDER);
    const model = buildLoenudviklingModel(
      values,
      stamdata,
      TAF_BEREGNES_SOM.MAANEDER,
      indkomst,
      { tafRanges: [{ fra: iso('2023-01-01'), til: iso('2024-09-30') }] }
    );
    return model.beregnedeSegmenter.find((segment) => segment.fra === iso(fra))?.deltaPct;
  };

  it('inkluderer Store Bededag i Beløb-tilstand — som Procent-tilstand (deltaPct = +0,45 fra 2024)', () => {
    // Basispakken evalueres pr. reguleringsdatoen (2022-12-31, før Store Bededag-tillæggets
    // ikrafttræden) og bærer derfor ikke tillægget; segmentet fra 2024-01-01 gør → deltaPct = +0,45 %.
    expect(deltaForSegment(buildManualBeregningsperiode('beloeb'), '2023-01-01')).toBe(0);
    expect(deltaForSegment(buildManualBeregningsperiode('beloeb'), '2024-01-01')).toBe(0.45);
  });

  it('giver identisk deltaPct i Beløb- og Procent-tilstand for samme manuelle rækker', () => {
    expect(deltaForSegment(buildManualBeregningsperiode('beloeb'), '2024-01-01'))
      .toBe(deltaForSegment(buildManualBeregningsperiode('procent'), '2024-01-01'));
  });

  it('lader de manuelle rækkers tillægsprocenter drive deltaPct i Beløb-tilstand', () => {
    // Isolér tillægseffekten: 'Ingen' løn på helligdage → intet Store Bededag-bidrag. Grundløn er
    // konstant (1000), så deltaPct afspejler ALENE ændringen i feriepenge-procenten (10 % → 20 %):
    // pakke_basis = 1000 × 1,10 = 1100 ; pakke_seg = 1000 × 1,20 = 1200 ; delta = 1200/1100 − 1 = 9,09 %.
    const values = buildManualBeregningsperiode('beloeb', {
      loenPaaHelligdage: 'Ingen',
      rows: [
        { id: 'base', dato: '2022-12-31', grundloen: 1000, feriepenge: 10 },
        { id: 'r2', dato: '2024-01-01', grundloen: 1000, feriepenge: 20 },
      ],
    });
    // Basissegmentet (uændret tillæg) regulerer ikke; det senere segment bærer tillægsstigningen.
    expect(deltaForSegment(values, '2023-01-01')).toBe(0);
    expect(deltaForSegment(values, '2024-01-01')).toBe(9.09);
  });

  it('ignorerer manuelle rækker dateret før den anvendte reguleringsdato', () => {
    // Rækken pr. 2022-06-01 ligger før reguleringsdatoen (2022-12-31) og er i konflikt med
    // basisrækken (som repræsenterer lønniveauet pr. reguleringsdatoen). Den ignoreres i
    // beregningen (og rapporteres som advarsel i række-evalueringen) — deltaPct forbliver 0.
    const values = buildManualBeregningsperiode('beloeb', {
      loenPaaHelligdage: 'Ingen',
      rows: [
        { id: 'base', dato: '2022-12-31', grundloen: 1000, feriepenge: 10 },
        { id: 'foer-basis', dato: '2022-06-01', grundloen: 2000, feriepenge: 50 },
      ],
    });
    expect(deltaForSegment(values, '2023-01-01')).toBe(0);
  });

  it('anvender en række dateret præcis på reguleringsdatoen fra dag ét', () => {
    const values = buildManualBeregningsperiode('beloeb', {
      loenPaaHelligdage: 'Ingen',
      rows: [
        { id: 'base', dato: '2022-12-31', grundloen: 1000, feriepenge: 10 },
        { id: 'paa-basis', dato: '2022-12-31', grundloen: 1000, feriepenge: 20 },
      ],
    });
    // 1200/1100 − 1 = 9,09 % allerede fra TAF-periodens start.
    expect(deltaForSegment(values, '2023-01-01')).toBe(9.09);
  });

  it('giver identisk deltaPct i Beløb- og Procent-tilstand for overenskomst-regulering', () => {
    // Overenskomst-sporet må ikke neutralisere tillægslaget i Beløb-tilstand: reguleringen skal
    // medregne stigninger i tillægsprocenterne (ferie/fritvalg/SH/pension/Store Bededag) i begge
    // tilstande, med satsfelterne som fælles kilde.
    const buildOverenskomst = (tillaegAngivesSom: 'procent' | 'beloeb'): ErstatningsopgoerelseValues => {
      const values = buildManualBeregningsperiode(tillaegAngivesSom);
      const af = values.loenindkomstAnsaettelsesforhold[0];
      values.loenindkomstAnsaettelsesforhold = [{
        ...af,
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'Almindelig løn',
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        // Identiske satsfelter i begge tilstande — de indgår i reguleringsformlen begge steder.
        feriePct: 12.5,
        fritvalgPct: undefined,
        shSoPct: undefined,
        pensionPct: undefined,
      }];
      return values;
    };

    const segmentsFor = (values: ErstatningsopgoerelseValues): ReadonlyArray<readonly [string, number]> => {
      const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') };
      const indkomst = buildIndkomstSkadestidspunkt(values, stamdata, TAF_BEREGNES_SOM.MAANEDER);
      const model = buildLoenudviklingModel(
        values,
        stamdata,
        TAF_BEREGNES_SOM.MAANEDER,
        indkomst,
        { tafRanges: [{ fra: iso('2023-01-01'), til: iso('2024-09-30') }] }
      );
      return model.beregnedeSegmenter.map((segment) => [segment.fra, segment.deltaPct] as const);
    };

    const beloebSegments = segmentsFor(buildOverenskomst('beloeb'));
    expect(beloebSegments).toEqual(segmentsFor(buildOverenskomst('procent')));
    // Mindst ét segment skal faktisk regulere — ellers beviser identiteten ingenting.
    expect(beloebSegments.some(([, deltaPct]) => deltaPct !== 0)).toBe(true);
  });
});
