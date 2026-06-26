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

  it('springer over KL-segmenter uden TAF-arbejdsdage', () => {
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

  it('beregner KL-deltaPct som indeksforhold til basisdatoen', () => {
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

    // Basisdato = 01-04-2024. Basissegmentet har deltaPct 0.
    const baseSegment = model.beregnedeSegmenter.find((segment) => segment.fra === iso('2024-04-01'));
    expect(baseSegment?.deltaPct).toBe(0);

    // 01-10-2024: eneste periode-sats mellem basis og segment er 1,30 %, så
    // forholdet mellem de akkumulerede indeks giver deltaPct 1,30.
    const segmentOkt2024 = model.beregnedeSegmenter.find((segment) => segment.fra === iso('2024-10-01'));
    expect(segmentOkt2024?.deltaPct).toBe(1.30);
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
      if (!segment || segment.kind !== 'maaneder') return undefined;
      return Math.round((segment.maanedsloenOre / 100) * (1 + segment.deltaPct / 100) * 100) / 100;
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

describe('buildLoenudviklingModel — Beløb-tilstand (rate-only regulering)', () => {
  // Verificerer at tillægslaget (her: Store Bededag) neutraliseres i Beløb-tilstand, så deltaPct
  // bliver ren grundløns-/sats-regulering. Samme opsætning i Procent-tilstand giver Store Bededag-
  // bidraget (-0,45 % før 2024), jf. testen "beregner negativ manuel Store Bededag-regulering".
  const buildManualBeregningsperiode = (tillaegAngivesSom: 'procent' | 'beloeb'): ErstatningsopgoerelseValues => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2023-01-01');
    values.tafBeregningsperiodeTil = iso('2024-09-30');
    values.tafPerioder = [{
      id: 'taf-cross-store-bededag',
      fra: iso('2023-01-01'),
      til: iso('2024-09-30'),
      loseFeriedage: 0,
    }];
    const baseAf = createDefaultLoenindkomstAnsaettelsesforhold();
    values.loenindkomstAnsaettelsesforhold = [{
      ...baseAf,
      id: 'af-beloeb',
      tillaegAngivesSom,
      // Beløb: sæt satserne til ikke-nul for at bevise, at de IKKE påvirker deltaPct (neutraliseres).
      // Procent: feriePct=0 så deltaPct alene afspejler Store Bededag-bidraget (-0,45 %).
      feriePct: tillaegAngivesSom === 'beloeb' ? 12.5 : 0,
      fritvalgPct: tillaegAngivesSom === 'beloeb' ? 4 : undefined,
      shSoPct: tillaegAngivesSom === 'beloeb' ? 2.7 : undefined,
      pensionPct: tillaegAngivesSom === 'beloeb' ? 8.15 : undefined,
      loenPaaHelligdage: 'Almindelig løn',
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [{
        id: 'manual-base',
        dato: toISODateString('2023-01-01'),
        grundloen: asAmount(1000),
        feriepenge: 0,
        shSoSats: 0,
        fritvalg: 0,
        agPension: 0,
      }],
      indtaegtsoplysningerTableData: [{
        id: 'r1',
        col0_maaned: '1',
        col1_maaned: '2023',
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

  it('neutraliserer Store Bededag i Beløb-tilstand (deltaPct = 0 før 2024)', () => {
    expect(deltaForSegment(buildManualBeregningsperiode('beloeb'), '2023-01-01')).toBe(0);
  });

  it('Procent-tilstand bevarer Store Bededag-bidraget (deltaPct = -0,45 før 2024)', () => {
    expect(deltaForSegment(buildManualBeregningsperiode('procent'), '2023-01-01')).toBe(-0.45);
  });
});
