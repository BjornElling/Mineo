import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues, createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { buildManuelProcentsatsEntries } from '../../../domain/erstatningsopgoerelse/engines/manuelProcentsatsRegulering';
import { buildKrlIndexEntries } from '../../../domain/erstatningsopgoerelse/engines/krlRegulering';
import { buildStatistikIndexEntries } from '../../../domain/erstatningsopgoerelse/engines/statistikRegulering';
import { buildKlLoenaftalerIndexEntries } from '../../../domain/erstatningsopgoerelse/engines/klLoenaftalerRegulering';
import { resolveStatistikModelId } from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { buildIndkomstSkadestidspunkt } from '../../../domain/erstatningsopgoerelse/engines/indkomstSkadestidspunktBeregning';
import { computeTafNettoBeregning } from '../../../domain/erstatningsopgoerelse/engines/tafNettoBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  type OverenskomstPeriodeSats,
} from '../../../data/overenskomstRates';
import { getOffentligLoenForDato } from '../../../data/offentligLoenLookup';
import { toLoentrin } from '../../../data/offentligLoenTypes';
import { isoToDanish, toDanishDateString, toISODateString } from '../../../types/branded';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { roundByMethod } from '../../../utils/rounding';

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

  it('KRL: beregner deltaPct som indeksforhold ((100+segmentPct)/(100+basePct)-1)*100', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-04-01');
    values.tafPerioder = [{
      id: 'taf-krl',
      fra: iso('2024-04-01'),
      til: iso('2026-12-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'KRL satstabel',
      loenudviklingKRLSatstabel: 'KTO (kommuner)',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-04-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2024-04-01'), til: iso('2026-12-31') }] }
    );

    // Basis = KTO-kommuner-sats pr. 01-04-2024 = 57,7650.
    // deltaPct = ((100 + segmentPct) / (100 + 57,7650) - 1) * 100, afrundet 2 dec.
    const deltaFor = (fra: string) =>
      model.beregnedeSegmenter.find((s) => s.fra === iso(fra))?.deltaPct;
    expect(deltaFor('2024-04-01')).toBe(0);        // base → base
    expect(deltaFor('2024-10-01')).toBe(1.30);     // 59,8159
    expect(deltaFor('2025-10-01')).toBe(1.60);     // 60,2921
    expect(deltaFor('2025-11-01')).toBe(2.34);     // 61,4627
    expect(deltaFor('2026-04-01')).toBe(4.80);     // 65,3378
  });

  it('KRL (S1 base-clamp): reguleringsdato før første sats ankrer til ældste sats, segmenter før basen = zero-delta', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    // Før KTO-kommuner-seriens første sats (01-04-2001).
    values.angivetMaanedsloenOpreguleresFraDato = iso('2000-01-01');
    values.tafPerioder = [{
      id: 'taf-krl-clamp',
      fra: iso('2000-01-01'),
      til: iso('2002-12-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'KRL satstabel',
      loenudviklingKRLSatstabel: 'KTO (kommuner)',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2000-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2000-01-01'), til: iso('2002-12-31') }] }
    );

    // Effektiv base = ældste sats 01-04-2001 (4,0662). Segmentet før basen er zero-delta;
    // fra og med basen beregnes deltaPct mod 4,0662. (Denne stille clamp gates blokerende
    // i række-laget — se reguleringSilentPathAlignment.test.ts, S1-blok.)
    const deltaFor = (fra: string) =>
      model.beregnedeSegmenter.find((s) => s.fra === iso(fra))?.deltaPct;
    expect(deltaFor('2000-01-01')).toBe(0);   // før basen → zero-delta
    expect(deltaFor('2001-04-01')).toBe(0);   // base → base
    expect(deltaFor('2001-10-01')).toBe(1.01); // 5,1157 mod 4,0662
    expect(deltaFor('2002-04-01')).toBe(2.01); // 6,1566 mod 4,0662
  });

  it('KRL (S6-endepunkt): TAF ud over sidste KRL-dato viderefører sidste sats (carry-forward, gated af endDate-row)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2025-01-01');
    // TAF rækker langt ud over sidste KRL-dato (01-04-2026).
    values.tafPerioder = [{
      id: 'taf-krl-endpoint',
      fra: iso('2025-01-01'),
      til: iso('2027-12-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'KRL satstabel',
      loenudviklingKRLSatstabel: 'KTO (kommuner)',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2025-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2025-01-01'), til: iso('2027-12-31') }] }
    );

    // Sidste segment starter 01-04-2026 (sidste KRL-sats 65,3378) og løber ubrudt til
    // 2027-12-31 — sidste sats videreføres uden throw. Den øvre-grænse-gate (row-lagets
    // endDate: nyeste + 6 mdr − 1 dag = 30-09-2026) ejes af punkt 12/13.
    const sidste = model.beregnedeSegmenter[model.beregnedeSegmenter.length - 1];
    expect(sidste?.fra).toBe(iso('2026-04-01'));
    expect(sidste?.til).toBe(iso('2027-12-31'));
    // deltaPct = ((165,3378) / (159,8159) - 1) * 100 = 3,46 (base = 01-01-2025 = 59,8159).
    expect(sidste?.deltaPct).toBe(3.46);
  });

  it('KRL (fail-closed): KRL-strategi uden valgt satstabel kaster', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-04-01');
    values.tafPerioder = [{
      id: 'taf-krl-mangler',
      fra: iso('2024-04-01'),
      til: iso('2024-12-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'KRL satstabel',
      loenudviklingKRLSatstabel: undefined,
    };

    expect(() => buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-04-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2024-04-01'), til: iso('2024-12-31') }] }
    )).toThrow(/KRL satstabel mangler/);
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

    // R2 — motoren emitterer det autoritative visnings-forløb (top-level ved angivet løn), byte-
    // identisk med den delte builder, så præsentation/inspektion kan formattere uden re-derivation.
    expect(model.forloeb).toEqual({
      kind: 'manuelProcentsats',
      entries: buildManuelProcentsatsEntries({
        anvendtReguleringsdato: iso('2024-07-01'),
        rows: values.eoAngivetLoenLoenudvikling.loenudviklingManuelProcentsatsTableData ?? [],
      }),
    });
  });

  it('KRL: motoren emitterer det autoritative KRL-forløb byte-identisk med den delte builder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2015-01-01');
    values.tafPerioder = [{
      id: 'taf-krl',
      fra: iso('2015-01-01'),
      til: iso('2018-12-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'KRL satstabel',
      loenudviklingKRLSatstabel: 'KTO (kommuner)',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2015-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2015-01-01'), til: iso('2018-12-31') }] }
    );

    // Forløbet er den delte KRL-periodeserie motoren afleder deltaPct fra — samme kilde som
    // præsentationen læser (ingen re-derivation → ingen drift).
    expect(model.forloeb).toEqual({ kind: 'krl', entries: buildKrlIndexEntries('KTO (kommuner)') });
    const entries = model.forloeb?.kind === 'krl' ? model.forloeb.entries : [];
    expect(entries.length).toBeGreaterThan(0);
  });

  it('statistik: motoren emitterer den autoritative kvartals-indeksserie byte-identisk med den delte builder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2005-01-01');
    values.tafPerioder = [{
      id: 'taf-statistik',
      fra: iso('2005-01-01'),
      til: iso('2007-12-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Statistik',
      loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2005-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2005-01-01'), til: iso('2007-12-31') }] }
    );

    const modelId = resolveStatistikModelId('ILON12 (Danmarks Statistik)');
    expect(modelId).toBeDefined();
    // Forløbet er den delte statistik-kvartalsserie motoren afleder deltaPct fra — samme kilde som
    // præsentationen læser (ingen re-derivation → ingen drift).
    expect(model.forloeb).toEqual({ kind: 'statistik', entries: buildStatistikIndexEntries(modelId!) });
    const entries = model.forloeb?.kind === 'statistik' ? model.forloeb.entries : [];
    expect(entries.length).toBeGreaterThan(0);
  });

  it('KL-lønaftaler: motoren emitterer den autoritative KL-periodeserie byte-identisk med den delte builder', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-04-01');
    values.tafPerioder = [{
      id: 'taf-kl',
      fra: iso('2024-04-01'),
      til: iso('2025-12-31'),
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
      { tafRanges: [{ fra: iso('2024-04-01'), til: iso('2025-12-31') }] }
    );

    // Forløbet er den delte KL-periodeserie motoren afleder brudpunkterne fra — samme kilde som
    // reguleringsværdi-tabellen viser (ingen re-derivation → ingen drift).
    expect(model.forloeb).toEqual({ kind: 'klLoenaftaler', entries: buildKlLoenaftalerIndexEntries() });
    const entries = model.forloeb?.kind === 'klLoenaftaler' ? model.forloeb.entries : [];
    expect(entries.length).toBeGreaterThan(0);
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

    // R2 — 'Manuelt angivet' er ikke migreret (kun manuel procentsats, KRL, statistik non-ASL); den bærer intet forløb.
    expect(model.forloeb).toBeUndefined();
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
    )).toThrow(/mangler ASL indeks for 2004/);
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

  // ─── Statistik ASL-årslønsmaksimum (punkt 4) ────────────────────────────────
  //
  // ASL-grenen opdeler TAF-perioden i kalenderår og slår maks-satsen op for HVERT år
  // (eksakt år-opslag, IKKE "seneste ≤ dato"-carry-forward som DST-kvartalsindeks).
  // deltaPct[år] = (idx[år] / idx[basisår] − 1) × 100 via den fælles opreguleringsmotor.
  // Fordi opslaget er eksakt-år, fail-closer et manglende år (interiort hul ELLER efter
  // sidste år) hårdt i motoren — der findes derfor ingen tavs under-regulering her.
  const buildAslModel = (regDato: string, range: { fra: string; til: string }) => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso(regDato);
    values.tafPerioder = [{ id: 'taf-asl', fra: iso(range.fra), til: iso(range.til), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Statistik',
      loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
    };
    return buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso(regDato) },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso(range.fra), til: iso(range.til) }] }
    );
  };

  const aslDelta = (segmentAar: number, basisAar: number): number =>
    roundByMethod((aarsloenAslMax[segmentAar] / aarsloenAslMax[basisAar] - 1) * 100, 2, 'halfAwayFromZero');

  it('ASL: per-år-split med indeksforhold idx[år]/idx[basisår] (normalsti)', () => {
    // Basisår = reguleringsdatoens år (2020). Ét segment pr. kalenderår; basisårets
    // segment er 0 (målår == kildeår), de følgende bærer det akkumulerede indeksforhold.
    const model = buildAslModel('2020-06-01', { fra: '2020-06-01', til: '2022-12-31' });
    const deltaFor = (fra: string) => model.beregnedeSegmenter.find((s) => s.fra === iso(fra))?.deltaPct;

    expect(deltaFor('2020-06-01')).toBe(0);
    expect(deltaFor('2021-01-01')).toBe(aslDelta(2021, 2020));
    expect(deltaFor('2022-01-01')).toBe(aslDelta(2022, 2020));
    // Sanity: reguleringen er faktisk positiv (maks-satsen stiger år for år).
    expect(aslDelta(2021, 2020)).toBeGreaterThan(0);
    expect(aslDelta(2022, 2020)).toBeGreaterThan(aslDelta(2021, 2020));
  });

  it('ASL: segment før basisåret giver bevidst zero-delta (regulering gælder først fra reguleringsdatoen)', () => {
    // Reguleringsdato i 2022, men TAF-perioden rækker bagud til 2021. 2021-segmentet
    // (år < basisår) er zero-delta; 2023-segmentet (år > basisår) regulerer normalt.
    const model = buildAslModel('2022-06-01', { fra: '2021-01-01', til: '2023-12-31' });
    const deltaFor = (fra: string) => model.beregnedeSegmenter.find((s) => s.fra === iso(fra))?.deltaPct;

    expect(deltaFor('2021-01-01')).toBe(0);
    expect(deltaFor('2022-01-01')).toBe(0); // basisåret selv
    expect(deltaFor('2023-01-01')).toBe(aslDelta(2023, 2022));
    expect(aslDelta(2023, 2022)).toBeGreaterThan(0);
  });

  it('ASL: fail-lukker (kaster) når TAF-perioden rækker ud over sidste dækkede år (ingen carry-forward)', () => {
    // Modsat DST-kvartalsindeks (der carry-forwarder inden for et dæknings-vindue) slår
    // ASL eksakt år op. Et segment i året efter tabellens sidste år (maxYear+1) har intet
    // indeks → motoren kaster (fail-closed) frem for stille at videreføre sidste års sats.
    const maxYear = Math.max(...Object.keys(aarsloenAslMax).map(Number));
    expect(() => buildAslModel(
      `${maxYear}-01-01`,
      { fra: `${maxYear}-01-01`, til: `${maxYear + 1}-06-30` }
    )).toThrow(/ASL indeks/);
  });

  // ─── Privat overenskomst (punkt 5): robusthed / ingen tavs runtime_exception ──
  //
  // Privat overenskomst har ingen realistisk throw-sti for valid input: basen opløses
  // altid (fallback til overenskomstens første sats via resolvePrivateOverenskomstBaseContext),
  // og `getSatserForDatoFromList` carry-forwarder den seneste sats ≤ dato — så et interiort
  // hul er umuligt, og en TAF-periode UD OVER sidste sats giver carry-forward (ikke throw).
  // De eneste zero-delta-stier er "før dækning"/"før basis", der er gated i row-laget (S2).
  it('privat overenskomst: TAF-periode ud over sidste sats carry-forwarder uden at kaste (ingen tavs runtime_exception)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2023-01-01');
    values.tafPerioder = [{ id: 'taf-ok-carry', fra: iso('2023-01-01'), til: iso('2035-12-31'), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Ingen',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };

    // Motoren fail-closer ALDRIG her: den producerer en model med carry-forward af sidste
    // sats. Øvre-grænse-gaten (efter sidste sats) ejes af row-/validator-laget (punkt 12/13),
    // ikke af en motor-throw.
    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2023-01-01'), til: iso('2035-12-31') }] }
    );
    expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);
    // Reguleringen er reel (satsen steg inden for dækningen) og videreføres derefter.
    expect(model.beregnedeSegmenter.some((s) => s.deltaPct > 0)).toBe(true);
  });

  // ─── Statistik (DST-kvartalsindeks: ILON12 / SBLON2) ────────────────────────
  //
  // deltaPct = (idx[segment] / idx[base] − 1) × 100, afrundet halfAwayFromZero til
  // to decimaler. Base = seneste kvartalsindeks ≤ reguleringsdato. Grænserne (før
  // første kvartal, efter sidste kvartal, hul midt i serien) er reviewets fokus.
  const buildStatistikModel = (
    model: string,
    regDato: string,
    range: { fra: string; til: string }
  ) => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso(regDato);
    values.tafPerioder = [{ id: 'taf-stat', fra: iso(range.fra), til: iso(range.til), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Statistik',
      loenudviklingStatistikModel: model as typeof values.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel,
    };
    return buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso(regDato) },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso(range.fra), til: iso(range.til) }] }
    );
  };

  const statistikDeltas = (model: string, regDato: string, range: { fra: string; til: string }) =>
    buildStatistikModel(model, regDato, range).beregnedeSegmenter.map((s) => ({ fra: s.fra, deltaPct: s.deltaPct }));

  it('Statistik (ILON12): normal beregning — deltaPct = idx[segment]/idx[base] − 1', () => {
    // Base = 2020K1 (140,1). 2021K1=142,9 → +2,00 %; 2022K1=146,1 → +4,28 %.
    expect(statistikDeltas('ILON12 (Danmarks Statistik)', '2020-06-01', { fra: '2020-06-01', til: '2022-12-31' })).toEqual([
      { fra: iso('2020-06-01'), deltaPct: 0 },
      { fra: iso('2021-01-01'), deltaPct: 2.0 },
      { fra: iso('2022-01-01'), deltaPct: 4.28 },
    ]);
  });

  it('Statistik (ILON12): base-clamp — reguleringsdato før første kvartal → zero-delta før basen (S1)', () => {
    // reguleringsdato 2004-06-01 ligger før ILON12's første kvartal (2005K1).
    // Motoren ankrer basen til ældste kvartal (2005K1 = 100) og giver zero-delta for
    // segmentet før basen. På produkt-niveau blokeres dette af en synlig, blokerende
    // reguleringsvaerdi-row-error (eoRowIndkomstRows.ts:472), aligned med basen — jf.
    // punkt 1's S1-afgørelse (bekræftet korrekt, gated). Her verificeres motor-adfærden.
    expect(statistikDeltas('ILON12 (Danmarks Statistik)', '2004-06-01', { fra: '2004-06-01', til: '2006-12-31' })).toEqual([
      { fra: iso('2004-06-01'), deltaPct: 0 }, // før effektiv base (2005K1) → zero-delta
      { fra: iso('2005-01-01'), deltaPct: 0 }, // basen selv
      { fra: iso('2006-01-01'), deltaPct: 2.9 }, // 102,9 / 100
    ]);
  });

  it('Statistik (ILON12): efter sidste kvartal — sidste indeks videreføres inden for dæknings-vinduet (S6-endepunkt)', () => {
    // Base = 2024K1 (156,1). 2025K1=161,5 → +3,46 %. Sidste kvartal er 2025K4 (165,2);
    // dets indeks videreføres for segmentet der rækker ind i 2026 (+5,83 %). Dette er
    // bevidst carry-forward inden for det 12-måneders dæknings-vindue (tilDato =
    // sidste kvartalsstart + 12 mdr − 1 dag = 30-09-2026). Rækker TAF-perioden UD OVER
    // tilDato, fail-closer endDate-row-gaten (ejes af punkt 12/13), ikke motoren.
    expect(statistikDeltas('ILON12 (Danmarks Statistik)', '2024-06-01', { fra: '2024-06-01', til: '2026-06-30' })).toEqual([
      { fra: iso('2024-06-01'), deltaPct: 0 },
      { fra: iso('2025-01-01'), deltaPct: 3.46 },
      { fra: iso('2025-10-01'), deltaPct: 5.83 }, // 2025K4-indeks videreført ind i 2026
    ]);
  });

  it('Statistik: hul midt i serien er umuligt — assertStatistikAarKontinuitet fail-closer ved modul-load (S6-interiort)', () => {
    // Et interiort hul (helt manglende kalenderår) ville få motorens
    // findLatestByDateInSortedList til stiltiende at videreføre det forrige års indeks.
    // Det gøres umuligt af kontinuitets-guarden i statistiskeRates.ts, der kaster ved
    // modul-load hvis et år mangler. Se statistiskeRates.test.ts for guardens egne
    // fail-closed-tests; her bekræftes blot at de faktiske modeller er hul-frie, så
    // motoren aldrig kan møde et interiort hul.
    for (const modelLabel of ['ILON12 (Danmarks Statistik)', 'SBLON2 (Danmarks Statistik)']) {
      expect(() => statistikDeltas(modelLabel, '2020-06-01', { fra: '2020-06-01', til: '2020-12-31' })).not.toThrow();
    }
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

  it('inkluderer overenskomstens tillæg i Beløb-tilstand for overenskomst-regulering', () => {
    const buildOverenskomst = (tillaegAngivesSom: 'procent' | 'beloeb'): ErstatningsopgoerelseValues => {
      const values = buildManualBeregningsperiode(tillaegAngivesSom);
      const af = values.loenindkomstAnsaettelsesforhold[0];
      values.loenindkomstAnsaettelsesforhold = [{
        ...af,
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'Almindelig løn',
        loenudviklingBeregningsgrundlag: 'Overenskomst',
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
    const procentSegments = segmentsFor(buildOverenskomst('procent'));

    expect(beloebSegments).toEqual(procentSegments);
    expect(beloebSegments.some(([, deltaPct]) => deltaPct !== 0)).toBe(true);
  });

  it.each([
    ['Beregningsperiode', 'beloeb'],
    ['Beregningsperiode', 'procent'],
    ['Angivet månedsløn', 'beloeb'],
    ['Angivet månedsløn', 'procent'],
  ] as const)(
    'giver samme regulerede TAF-beløb som Bygge-/anlægsoverenskomsten når manuel regulering udfyldes med samme satser ved %s i %s-tilstand',
    (beregnesUdFra, tillaegAngivesSom) => {
      const stableFeriePct = 12.5;
      const overenskomstValues = buildByggeAnlaegParityValues(
        tillaegAngivesSom,
        'Overenskomst',
        stableFeriePct,
        beregnesUdFra
      );
      const manualValues = buildByggeAnlaegParityValues(
        tillaegAngivesSom,
        'Manuelt angivet',
        stableFeriePct,
        beregnesUdFra
      );

      const overenskomstTaf = buildParityTafNettoBeregning(overenskomstValues);
      const manualTaf = buildParityTafNettoBeregning(manualValues);

      expect(manualTaf.tabtArbejdsfortjenesteOre).toBe(overenskomstTaf.tabtArbejdsfortjenesteOre);
      expect(manualTaf.loenudvikling?.loenudviklingTotal).toEqual(overenskomstTaf.loenudvikling?.loenudviklingTotal);
    }
  );

  // Review-punkt 7 — carry-forward og fail-closed for manuelt angivet.
  it('carry-forwarder seneste dateret række til efterfølgende segmenter (intet interiort hul, ingen efter-sidste-nulstilling)', () => {
    // Tre daterede rækker; 'Ingen' løn på helligdage isolerer carry-forward fra Store Bededag-split.
    // Hvert segment bruger seneste dateret række <= segment.fra (findLatestByDateInSortedList):
    //   [reg..2023-05-31] = basis (delta 0); [2023-06-01..2023-12-31] = 1100 (delta 10) — mellem to
    //   rækker; [2024-01-01..TAF-slut 2024-09-30] = 1210 (delta 21) — videreført forbi sidste række.
    // Beviser at et interiort segment aldrig falder tilbage til basis, og at reguleringen efter sidste
    // række hverken nulstilles eller kaster.
    const values = buildManualBeregningsperiode('beloeb', {
      loenPaaHelligdage: 'Ingen',
      rows: [
        { id: 'base', dato: '2022-12-31', grundloen: 1000 },
        { id: 'r2', dato: '2023-06-01', grundloen: 1100 },
        { id: 'r3', dato: '2024-01-01', grundloen: 1210 },
      ],
    });
    expect(deltaForSegment(values, '2023-01-01')).toBe(0);
    expect(deltaForSegment(values, '2023-06-01')).toBe(10);
    expect(deltaForSegment(values, '2024-01-01')).toBe(21);
  });

  it('fejler lukket (throw) når basisrækkens grundløn giver en ugyldig basispakke', () => {
    // Basispakke = 0 → motoren kaster i stedet for at producere en tavs 0-regulering
    // (throw → computeEoSnapshot fail_closed / runtime_exception, jf. invariant-noten).
    const values = buildManualBeregningsperiode('beloeb', {
      loenPaaHelligdage: 'Ingen',
      rows: [{ id: 'base', dato: '2022-12-31', grundloen: 0 }],
    });
    expect(() => deltaForSegment(values, '2023-01-01')).toThrow(/ugyldig manuel basispakke/);
  });

  it('fejler lukket (throw) når en dateret rækkes grundløn giver en ugyldig pakkeværdi', () => {
    const values = buildManualBeregningsperiode('beloeb', {
      loenPaaHelligdage: 'Ingen',
      rows: [
        { id: 'base', dato: '2022-12-31', grundloen: 1000 },
        { id: 'r2', dato: '2023-06-01', grundloen: 0 },
      ],
    });
    expect(() => deltaForSegment(values, '2023-01-01')).toThrow(/ugyldig manuel pakkevaerdi/);
  });
});

const BYGGE_ANLAEG_ID = 'bygge-anlaeg' as Parameters<typeof getEffektiveSatserForDato>[0]['overenskomstId'];

const danishToIso = (dato: string): ReturnType<typeof iso> => {
  const [day, month, year] = dato.split('-');
  return iso(`${year}-${month}-${day}`);
};

const pctPointFromDecimal = (value: number | null): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value * 100;
};

const buildManualRowFromByggeAnlaegSats = (
  id: string,
  dato: ReturnType<typeof iso>,
  sats: OverenskomstPeriodeSats,
  stableFeriePct: number
): NonNullable<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]['loenudviklingManuelTableData']>[number] => ({
  id,
  dato,
  grundloen: asAmount(sats.grundloen ?? 0),
  feriepenge: stableFeriePct,
  shSoSats: pctPointFromDecimal(sats.shSoSats),
  fritvalg: pctPointFromDecimal(sats.fritvalg),
  agPension: pctPointFromDecimal(sats.agPension),
});

const buildByggeAnlaegManualRows = (
  baseIso: ReturnType<typeof iso>,
  tafFra: ReturnType<typeof iso>,
  tafTil: ReturnType<typeof iso>,
  stableFeriePct: number
): NonNullable<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]['loenudviklingManuelTableData']> => {
  const baseDa = isoToDanish(baseIso);
  const tafFraDa = isoToDanish(tafFra);
  const tafTilDa = isoToDanish(tafTil);
  if (!baseDa || !tafFraDa || !tafTilDa) throw new Error('Testopsætning har ugyldige datoer');

  const baseSats = getEffektiveSatserForDato({
    overenskomstId: BYGGE_ANLAEG_ID,
    dato: baseDa,
    applyAlmindeligLoenPaaShDageRegel: true,
  });
  if (!baseSats) throw new Error('Testopsætning mangler basis-sats for Bygge-/anlægsoverenskomsten');

  const periodSatser = getEffektiveSatserForPeriode({
    overenskomstId: BYGGE_ANLAEG_ID,
    fraDato: tafFraDa,
    tilDato: tafTilDa,
    applyAlmindeligLoenPaaShDageRegel: true,
  })
    .slice()
    .sort((left, right) => danishToIso(left.fraDato).localeCompare(danishToIso(right.fraDato)))
    .filter((sats) => danishToIso(sats.fraDato) > baseIso);

  return [
    buildManualRowFromByggeAnlaegSats('manual-base', baseIso, baseSats, stableFeriePct),
    ...periodSatser.map((sats, index) =>
      buildManualRowFromByggeAnlaegSats(`manual-${index}`, danishToIso(sats.fraDato), sats, stableFeriePct)
    ),
  ];
};

const buildByggeAnlaegParityValues = (
  tillaegAngivesSom: 'procent' | 'beloeb',
  basis: 'Overenskomst' | 'Manuelt angivet',
  stableFeriePct: number,
  beregnesUdFra: 'Beregningsperiode' | 'Angivet månedsløn'
): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  const baseIso = iso('2022-12-31');
  const tafFra = iso('2023-01-01');
  const tafTil = iso('2024-09-30');
  const indkomstDato = iso('2022-01-01');
  const indkomstSatsDato = isoToDanish(indkomstDato);
  if (!indkomstSatsDato) throw new Error('Testopsætning har ugyldig indkomstdato');
  const indkomstSats = getEffektiveSatserForDato({
    overenskomstId: BYGGE_ANLAEG_ID,
    dato: indkomstSatsDato,
    applyAlmindeligLoenPaaShDageRegel: true,
  });
  if (!indkomstSats) throw new Error('Testopsætning mangler indkomstsats for Bygge-/anlægsoverenskomsten');
  const baseAf = createDefaultLoenindkomstAnsaettelsesforhold();
  values.beregnesUdFra = beregnesUdFra;
  if (beregnesUdFra === 'Beregningsperiode') {
    values.tafBeregningsperiodeFra = iso('2022-01-01');
    values.tafBeregningsperiodeTil = baseIso;
  } else {
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenBaseretPaa = 'Testgrundlag';
    values.angivetMaanedsloenOpreguleresFraDato = baseIso;
  }
  values.tafPerioder = [{ id: 'taf-bygge-anlaeg-paritet', fra: tafFra, til: tafTil, loseFeriedage: 0 }];
  const manualRows = basis === 'Manuelt angivet'
    ? buildByggeAnlaegManualRows(baseIso, tafFra, tafTil, stableFeriePct)
    : [];

  if (beregnesUdFra === 'Angivet månedsløn') {
    values.loenindkomstAnsaettelsesforhold = [];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      overenskomstId: 'bygge-anlaeg',
      feriePct: stableFeriePct,
      loenPaaHelligdage: 'Almindelig løn',
      loenudviklingBeregningsgrundlag: basis,
      loenudviklingManuelTableData: manualRows,
    };
    return values;
  }

  values.loenindkomstAnsaettelsesforhold = [{
    ...baseAf,
    id: `af-${basis}-${tillaegAngivesSom}`,
    navnPaaArbejdssted: 'Bygge-/anlæg',
    tillaegAngivesSom,
    harOverenskomst: true,
    overenskomstId: 'bygge-anlaeg',
    feriePct: stableFeriePct,
    fritvalgPct: tillaegAngivesSom === 'procent' ? pctPointFromDecimal(indkomstSats.fritvalg) : undefined,
    shSoPct: tillaegAngivesSom === 'procent' ? pctPointFromDecimal(indkomstSats.shSoSats) : undefined,
    pensionPct: tillaegAngivesSom === 'procent' ? pctPointFromDecimal(indkomstSats.agPension) : undefined,
    loenPaaHelligdage: 'Almindelig løn',
    loenudviklingBeregningsgrundlag: basis,
    loenudviklingManuelTableData: manualRows,
    indtaegtsoplysningerTableData: [{
      id: 'indkomst-2022',
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
      fpFvShSoBeloeb: tillaegAngivesSom === 'beloeb' ? asAmount(4000) : undefined,
      pensionBeloeb: tillaegAngivesSom === 'beloeb' ? asAmount(2000) : undefined,
    }],
  }];
  return values;
};

const buildParityTafNettoBeregning = (values: ErstatningsopgoerelseValues) => {
  const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') };
  return computeTafNettoBeregning(
    values,
    stamdata,
    { tafRanges: [{ fra: iso('2023-01-01'), til: iso('2024-09-30') }] }
  );
};

// ---------------------------------------------------------------------------
// Regulering punkt 2 — Form: Ingen
//
// Invarianter fastlagt under regulering-review punkt 2 (arbejdsdokumentet er lukket/slettet;
// oversigt i docs/review/regulering-arkitektur-redesign.md):
//   (a) alle-Ingen → strategi 'ingen' → ÆGTE nul-regulering: deltaPct 0 på hvert
//       segment, men den fulde basisløn bæres videre (deltaPct 0 ≠ nul beløb).
//   (b) uvalgt/tom strategi → throw (fail-closed), IKKE stiltiende nul-regulering.
//   (c) blandet 'Ingen' + aktiv form i multi-ansættelse (Beregningsperiode-grenen)
//       → 'Ingen'-forholdet maskerer/fortrænger IKKE reguleringen på det aktive
//       ansættelsesforhold; hver af reguleres uafhængigt og summeres.
// ---------------------------------------------------------------------------
describe('buildLoenudviklingModel — Form: Ingen (review-punkt 2)', () => {
  const buildMaanedIndkomstRow = (id: string) => ({
    id,
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
    fpFvShSoBeloeb: undefined,
    pensionBeloeb: undefined,
  });

  it('(a) alle-Ingen giver strategi "Ingen" med deltaPct 0 og fuld basisløn (ægte nul-regulering, ikke nul beløb)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenBaseretPaa = 'Testgrundlag';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-01-01');
    values.tafPerioder = [{ id: 'taf-ingen', fra: iso('2024-01-01'), til: iso('2024-06-30'), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenPaaHelligdage: 'Almindelig løn',
      loenudviklingBeregningsgrundlag: 'Ingen',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-06-30') }] }
    );

    expect(model.loenudviklingLabel).toBe('Ingen');
    expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);
    expect(model.beregnedeSegmenter.every((segment) => segment.deltaPct === 0)).toBe(true);
    // Ægte nul-regulering: basisløn (30.000 kr = 3.000.000 øre) bæres uændret på hvert segment.
    expect(model.beregnedeSegmenter.every((segment) => segment.kind === 'maaneder' && segment.maanedsloenOre === 3_000_000)).toBe(true);
    // ...og totalen er dermed den fulde ikke-regulerede løn — IKKE nul.
    expect(model.loenudviklingTotal.status).toBe('ok');
    if (model.loenudviklingTotal.status === 'ok') {
      expect(model.loenudviklingTotal.value).toBeGreaterThan(0);
    }
  });

  it('(b) uvalgt strategi (intet beregningsgrundlag) fail-closer med throw — ikke stiltiende nul', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenBaseretPaa = 'Testgrundlag';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-01-01');
    values.tafPerioder = [{ id: 'taf-uvalgt', fra: iso('2024-01-01'), til: iso('2024-06-30'), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenPaaHelligdage: 'Almindelig løn',
      // Bevidst uvalgt: hverken 'Ingen' eller en aktiv form. Skal fail-close.
      loenudviklingBeregningsgrundlag: undefined,
    };

    expect(() => buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-06-30') }] }
    )).toThrow(/ikke valgt/);
  });

  it('(c) blandet Ingen + aktiv form (multi-af, Beregningsperiode): Ingen maskerer IKKE reguleringen på det aktive forhold', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2022-01-01');
    values.tafBeregningsperiodeTil = iso('2022-12-31'); // reguleringsdato = beregningsperiodens slut
    values.tafPerioder = [{ id: 'taf-mix', fra: iso('2023-01-01'), til: iso('2024-12-31'), loseFeriedage: 0 }];

    const baseAf = createDefaultLoenindkomstAnsaettelsesforhold();
    values.loenindkomstAnsaettelsesforhold = [
      {
        ...baseAf,
        id: 'af-ingen',
        navnPaaArbejdssted: 'Ingen-forhold',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [buildMaanedIndkomstRow('indk-ingen')],
      },
      {
        ...baseAf,
        id: 'af-aktiv',
        navnPaaArbejdssted: 'Aktivt-forhold',
        loenudviklingBeregningsgrundlag: 'Manuel procentsats',
        loenudviklingManuelProcentsatsTableData: [
          { id: 'p-base', dato: iso('2022-12-31'), procent: 0 },
          { id: 'p-2024', dato: iso('2024-01-01'), procent: 10 },
        ],
        indtaegtsoplysningerTableData: [buildMaanedIndkomstRow('indk-aktiv')],
      },
    ];

    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2023-01-01') };
    const indkomst = buildIndkomstSkadestidspunkt(values, stamdata, TAF_BEREGNES_SOM.MAANEDER);
    const model = buildLoenudviklingModel(
      values,
      stamdata,
      TAF_BEREGNES_SOM.MAANEDER,
      indkomst,
      { tafRanges: [{ fra: iso('2023-01-01'), til: iso('2024-12-31') }] }
    );

    // Begge ansættelsesforhold er repræsenteret hver for sig (ingen bliver slugt).
    expect(model.perAnsaettelse.length).toBe(2);
    expect(model.loenudviklingLabel).toBe('Flere reguleringstyper');

    const ingenEntry = model.perAnsaettelse.find((entry) => entry.ansaettelsesforholdId === 'af-ingen');
    const aktivEntry = model.perAnsaettelse.find((entry) => entry.ansaettelsesforholdId === 'af-aktiv');
    expect(ingenEntry).toBeDefined();
    expect(aktivEntry).toBeDefined();

    // Ingen-forholdet: ægte nul-regulering (deltaPct 0), men bidrager sin fulde basisløn.
    expect(ingenEntry?.beregnedeSegmenter.every((segment) => segment.deltaPct === 0)).toBe(true);
    expect(ingenEntry?.loenudviklingTotal.status).toBe('ok');
    if (ingenEntry?.loenudviklingTotal.status === 'ok') {
      expect(ingenEntry.loenudviklingTotal.value).toBeGreaterThan(0);
    }

    // Det AKTIVE forhold beholder sin regulering: segmentet fra 2024-01-01 har +10 %.
    // (Var reguleringen fortrængt af Ingen-forholdet, ville deltaPct være 0.)
    const aktiv2024 = aktivEntry?.beregnedeSegmenter.find((segment) => segment.fra === iso('2024-01-01'));
    const aktiv2023 = aktivEntry?.beregnedeSegmenter.find((segment) => segment.fra === iso('2023-01-01'));
    expect(aktiv2023?.deltaPct).toBe(0);
    expect(aktiv2024?.deltaPct).toBe(10);

    // Totalen er summen af begge forhold (ingen maskering på compute-niveau).
    expect(model.loenudviklingTotal.status).toBe('ok');
    if (
      model.loenudviklingTotal.status === 'ok'
      && ingenEntry?.loenudviklingTotal.status === 'ok'
      && aktivEntry?.loenudviklingTotal.status === 'ok'
    ) {
      expect(model.loenudviklingTotal.value).toBe(
        ingenEntry.loenudviklingTotal.value + aktivEntry.loenudviklingTotal.value
      );
    }
  });
});

/**
 * Form: Overenskomst — offentlig (KL/RLTN) (review-punkt 6).
 *
 * Den offentlige gren i `buildLoenudviklingFromOverenskomst` slår grundlønnen op i
 * KL/RLTN-løntabellerne via `getOffentligLoenForDato` (carry-forward: nyeste
 * regulering med effectiveDate ≤ dato). Da `kl-overenskomst`/`rltn-overenskomst`
 * ikke har autoritative tillægssatser, og vi sætter feriePct = 0 og
 * loenPaaHelligdage = 'Ingen', reduceres lønpakken til den rene månedsløn, så
 * `deltaPct = (segment-månedsløn / basis-månedsløn − 1) × 100`.
 */
describe('buildLoenudviklingModel — Overenskomst offentlig (KL) (review-punkt 6)', () => {
  const byggOffentligModel = (regDatoIso: string, tafFra: string, tafTil: string) => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenBaseretPaa = 'Testgrundlag';
    values.angivetMaanedsloenOpreguleresFraDato = iso(regDatoIso);
    values.tafPerioder = [{ id: 'taf-off', fra: iso(tafFra), til: iso(tafTil), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      overenskomstId: 'kl-overenskomst',
      offentligLoenType: 'Månedsløn',
      offentligLoenTrin: 1,
      offentligLoenGruppe: 0,
      loenPaaHelligdage: 'Ingen',
      feriePct: 0,
    };
    return buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso(regDatoIso) },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso(tafFra), til: iso(tafTil) }] }
    );
  };

  it('normalsti: regulerer månedslønnen efter KL-løntabellen hen over en satsændring', () => {
    // Basisdato 01-04-2024: trin 1, gruppe 0 = 19.351,75 kr/md.
    // 01-10-2024: 19.603,25 kr/md → deltaPct = (19603.25/19351.75 − 1)×100 = 1,30 %.
    const model = byggOffentligModel('2024-04-01', '2024-04-01', '2026-03-31');

    const baseSegment = model.beregnedeSegmenter.find((s) => s.fra === iso('2024-04-01'));
    expect(baseSegment?.deltaPct).toBe(0);
    // Enhedslønnen (angivet 30.000 kr) bæres uændret; reguleringen ligger i deltaPct.
    expect(baseSegment?.kind === 'maaneder' && baseSegment.maanedsloenOre).toBe(3_000_000);

    const segmentOkt2024 = model.beregnedeSegmenter.find((s) => s.fra === iso('2024-10-01'));
    expect(segmentOkt2024?.deltaPct).toBe(1.30);
    expect(segmentOkt2024?.kind === 'maaneder' && segmentOkt2024.maanedsloenOre).toBe(3_000_000);
    // Reguleret månedsløn = 30.000 × (1 + 1,30 %) = 30.390 kr.
    if (segmentOkt2024?.kind === 'maaneder') {
      const reguleretMaanedsloenOre = Math.round(segmentOkt2024.maanedsloenOre * (1 + segmentOkt2024.deltaPct / 100));
      expect(reguleretMaanedsloenOre).toBe(3_039_000);
    }

    // Regulering blev reelt anvendt (ikke stiltiende nul).
    expect(model.beregnedeSegmenter.some((s) => s.deltaPct > 0)).toBe(true);
  });

  it('invariant: hvert segments deltaPct = (opslået segment-månedsløn / basis-månedsløn − 1) × 100', () => {
    const model = byggOffentligModel('2024-04-01', '2024-04-01', '2026-03-31');
    const baseLoen = getOffentligLoenForDato('KL', toDanishDateString('01-04-2024'), toLoentrin(1), 0)?.maanedsLoen;
    expect(typeof baseLoen).toBe('number');

    for (const segment of model.beregnedeSegmenter) {
      const segDato = isoToDanish(segment.fra);
      if (!segDato) throw new Error('ugyldig segmentdato i test');
      const segLoen = getOffentligLoenForDato('KL', segDato, toLoentrin(1), 0)?.maanedsLoen;
      expect(typeof segLoen).toBe('number');
      const forventet = roundByMethod((segLoen! / baseLoen! - 1) * 100, 2, 'halfAwayFromZero');
      expect(segment.deltaPct).toBe(forventet);
    }
  });

  it('S3 / før dækning: reguleringsdato før ældste KL-sats (01-01-2012) → kun zero-delta-segmenter, ingen throw', () => {
    // Reguleringsdato + TAF før KL-dækningens start. Motoren falder tilbage til
    // ældste sats som effektiv base (start = 01-01-2012), og alle segmenter før
    // basen sættes til zero-delta. INGEN throw — den blokerende fejl leveres i
    // stedet af reguleringsvaerdi-row-gaten (se reguleringSilentPathAlignment S3).
    const model = byggOffentligModel('1900-01-01', '1900-01-01', '1900-12-31');
    expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);
    expect(model.beregnedeSegmenter.every((s) => s.deltaPct === 0)).toBe(true);
  });
});
