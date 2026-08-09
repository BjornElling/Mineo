import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { LoenudviklingOgSatser } from '../../../schemas/formSchemas';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstRows';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

// De reguleringsgrundlags-felter der er ens på både angivet-løn-objektet og
// per-ansættelses-objektet (begge afledt af `createLoenudviklingOgSatserSchema`).
type ReguleringsGrundlagFelter = Pick<
  LoenudviklingOgSatser,
  'loenudviklingBeregningsgrundlag' | 'loenudviklingStatistikModel' | 'loenudviklingKRLSatstabel'
>;

// En reguleringsdato langt før enhver satstabels første post → motorens
// "effektive base"-opslag finder ingen sats <= datoen og falder tilbage til
// ældste sats (resolveEffectiveBaseEntry-fallback).
const REG_DATO_FOER_FOERSTE_SATS = '1900-01-01';

// TAF-perioden lander i en dækket periode, så motoren rent faktisk producerer
// regulerede segmenter oven på den (forkerte) fallback-base — netop den stille
// under-regulering S1 beskriver.
const TAF_FRA = '2020-01-01';
const TAF_TIL = '2020-12-31';

/**
 * De to satstabel-former hvis motor bruger `resolveEffectiveBaseEntry` (S1-fallback):
 * statistik (DST-kvartalsindeks) og KRL. En reguleringsmutator sætter de felter der
 * er ens på både angivet-løn-objektet og per-ansættelses-objektet.
 */
const FORMER: ReadonlyArray<{
  navn: string;
  konfigurer: (maal: ReguleringsGrundlagFelter) => void;
}> = [
  {
    navn: 'Statistik (ILON12)',
    konfigurer: (m) => {
      m.loenudviklingBeregningsgrundlag = 'Statistik';
      m.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';
    },
  },
  {
    navn: 'KRL satstabel (KTO kommuner)',
    konfigurer: (m) => {
      m.loenudviklingBeregningsgrundlag = 'KRL satstabel';
      m.loenudviklingKRLSatstabel = 'KTO (kommuner)';
    },
  },
];

const byggMotorModel = (konfigurer: (m: ReguleringsGrundlagFelter) => void) => {
  const values = createErstatningsopgoerelseInitialValues();
  values.beregnesUdFra = 'Angivet månedsløn';
  values.maanedsloenenUdgoer = asAmount(30000);
  values.angivetMaanedsloenOpreguleresFraDato = iso(REG_DATO_FOER_FOERSTE_SATS);
  values.tafPerioder = [{ id: 'taf-align', fra: iso(TAF_FRA), til: iso(TAF_TIL), loseFeriedage: 0 }];
  konfigurer(values.eoAngivetLoenLoenudvikling);
  return buildLoenudviklingModel(
    values,
    { ...STAMDATA_INITIAL_VALUES, skadedato: iso(REG_DATO_FOER_FOERSTE_SATS) },
    TAF_BEREGNES_SOM.MAANEDER,
    null,
    { tafRanges: [{ fra: iso(TAF_FRA), til: iso(TAF_TIL) }] }
  );
};

const byggReguleringsvaerdiRowStatus = (konfigurer: (m: ReguleringsGrundlagFelter) => void) => {
  const values = {
    ...createErstatningsopgoerelseInitialValues(),
    loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
  };
  values.beregnesUdFra = 'Beregningsperiode';
  values.vedroererPeriodeFra = iso(TAF_FRA);
  values.vedroererPeriodeTil = iso(TAF_TIL);
  values.tafPerioder = [{ id: 'taf-align', fra: iso(TAF_FRA), til: iso(TAF_TIL), loseFeriedage: undefined }];
  const af = values.loenindkomstAnsaettelsesforhold[0];
  konfigurer(af);
  const rows = buildEoIndkomstRows(values, iso(REG_DATO_FOER_FOERSTE_SATS));
  return rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.reguleringsvaerdi`)?.status;
};

/**
 * S1 — kobling mellem motorens stille fallback og den synlige row-gate.
 *
 * Motoren (`resolveEffectiveBaseEntry`) og row-gaten (`eoRowIndkomstRows`
 * reguleringsvaerdi-row) beregner uafhængigt af hinanden "reguleringsdato < første
 * sats". De aligner i dag udelukkende fordi begge udleder deres første sats fra
 * samme underliggende datatabel. Ændrer den ene sides "første sats"-udledning sig
 * (fx en off-by-one i `getReguleringsDatoIntervalFor…`), kan der åbne sig en
 * **ugated** zone: motoren ankrer stille til ældste sats (tavs under-regulering),
 * mens row-gaten ikke fyrer. Denne test binder de to sider, så en sådan drift fanges.
 */
describe('regulering S1 — motorens fallback er altid gated af en synlig row-error', () => {
  for (const form of FORMER) {
    it(`${form.navn}: reguleringsdato før første sats → motor falder stille tilbage OG row-gate fyrer error`, () => {
      // Motor-siden: fallback → ingen throw, model produceres (stille base-skift).
      const model = byggMotorModel(form.konfigurer);
      expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);

      // Row-siden: den blokerende gate MÅ fyre, ellers er motorens fallback ugated.
      const rowStatus = byggReguleringsvaerdiRowStatus(form.konfigurer);
      expect(rowStatus).toBe('error');
    });
  }
});

/**
 * S2 — privat overenskomst: reguleringsdato før dækning.
 *
 * Modsat S1 (statistik/KRL, der ankrer til ældste sats) bruger overenskomst-motoren
 * `max(reguleringsdato, dækningsstart)`: ligger reguleringsdatoen før overenskomstens
 * første sats, sættes alle TAF-segmenter før dækningsstarten stille til zero-delta
 * (ingen `!sats`-hul kan ramme et interiort segment, fordi `getSatserForDatoFromList`
 * altid carry-forwarder den seneste sats ≤ dato). Den stille zero-delta MÅ derfor være
 * gated af den samme blokerende row-error, hvis `reguleringsvaerdi.min` =
 * overenskomstens `interval.fraDato`. Denne test binder de to sider for privat
 * overenskomst (Bygge-/anlæg), så en fremtidig drift fanges.
 */
describe('regulering S2 — privat overenskomst før dækning er gated af en synlig row-error', () => {
  const REG_DATO_FOER_DAEKNING = '1900-01-01';

  const konfigurerOverenskomst = (
    maal: { overenskomstId?: string; loenPaaHelligdage?: string; loenudviklingBeregningsgrundlag?: string; feriePct?: number }
  ) => {
    maal.loenudviklingBeregningsgrundlag = 'Overenskomst';
    maal.overenskomstId = 'bygge-anlaeg';
    maal.loenPaaHelligdage = 'Ingen';
    maal.feriePct = 12.5;
  };

  it('motor producerer stille kun-zero-delta-segmenter OG row-gate fyrer error', () => {
    // Motor-siden (Angivet månedsløn): ingen throw; alle segmenter før dækning = zero-delta.
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso(REG_DATO_FOER_DAEKNING);
    values.tafPerioder = [{ id: 'taf-s2', fra: iso('1900-01-01'), til: iso('1900-12-31'), loseFeriedage: 0 }];
    konfigurerOverenskomst(values.eoAngivetLoenLoenudvikling);
    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso(REG_DATO_FOER_DAEKNING) },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('1900-01-01'), til: iso('1900-12-31') }] }
    );
    expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);
    expect(model.beregnedeSegmenter.every((s) => s.deltaPct === 0)).toBe(true);

    // Row-siden: den blokerende gate MÅ fyre.
    const rowValues = {
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
    };
    rowValues.beregnesUdFra = 'Beregningsperiode';
    rowValues.vedroererPeriodeFra = iso('1900-01-01');
    rowValues.vedroererPeriodeTil = iso('1900-12-31');
    rowValues.tafPerioder = [{ id: 'taf-s2', fra: iso('1900-01-01'), til: iso('1900-12-31'), loseFeriedage: undefined }];
    const af = rowValues.loenindkomstAnsaettelsesforhold[0];
    af.harOverenskomst = true;
    konfigurerOverenskomst(af);
    const rows = buildEoIndkomstRows(rowValues, iso(REG_DATO_FOER_DAEKNING));
    const rowStatus = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.reguleringsvaerdi`)?.status;
    expect(rowStatus).toBe('error');
  });
});

/**
 * S3 — offentlig overenskomst (KL/RLTN): reguleringsdato før dækning.
 *
 * Den offentlige gren slår grundlønnen op via `getOffentligLoenForDato`, der
 * carry-forwarder (nyeste regulering ≤ dato) og kun giver `undefined` FØR ældste
 * KL/RLTN-regulering (01-01-2012). Et interiort hul kan derfor ikke ramme et
 * segment (og en manglende løntrin INDEN FOR dækning kaster — degraderer ikke til
 * zero-delta). Ligger reguleringsdatoen før dækningen, falder motoren stille
 * tilbage til ældste sats som effektiv base, og alle TAF-segmenter før basen
 * sættes til zero-delta. Den stille zero-delta MÅ være gated af den samme
 * blokerende row-error, fordi row-gatens `reguleringsvaerdi.min` =
 * `getReguleringsDatoIntervalForOverenskomst(...).fraDato` = ældste KL-sats =
 * motorens fallback-base-start. Denne test binder de to sider (analog til S2).
 */
describe('regulering S3 — offentlig overenskomst før dækning er gated af en synlig row-error', () => {
  const REG_DATO_FOER_DAEKNING = '1900-01-01';

  const konfigurerOffentlig = (
    maal: {
      overenskomstId?: string;
      loenPaaHelligdage?: string;
      loenudviklingBeregningsgrundlag?: string;
      feriePct?: number;
      offentligLoenType?: string;
      offentligLoenTrin?: number;
      offentligLoenGruppe?: number;
    }
  ) => {
    maal.loenudviklingBeregningsgrundlag = 'Overenskomst';
    maal.overenskomstId = 'kl-overenskomst';
    maal.loenPaaHelligdage = 'Ingen';
    maal.feriePct = 0;
    maal.offentligLoenType = 'Månedsløn';
    maal.offentligLoenTrin = 1;
    maal.offentligLoenGruppe = 0;
  };

  it('motor producerer stille kun-zero-delta-segmenter OG row-gate fyrer error', () => {
    // Motor-siden (Angivet månedsløn): ingen throw; alle segmenter før dækning = zero-delta.
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso(REG_DATO_FOER_DAEKNING);
    values.tafPerioder = [{ id: 'taf-s3', fra: iso('1900-01-01'), til: iso('1900-12-31'), loseFeriedage: 0 }];
    konfigurerOffentlig(values.eoAngivetLoenLoenudvikling);
    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso(REG_DATO_FOER_DAEKNING) },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('1900-01-01'), til: iso('1900-12-31') }] }
    );
    expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);
    expect(model.beregnedeSegmenter.every((s) => s.deltaPct === 0)).toBe(true);

    // Row-siden: den blokerende gate MÅ fyre.
    const rowValues = {
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
    };
    rowValues.beregnesUdFra = 'Beregningsperiode';
    rowValues.vedroererPeriodeFra = iso('1900-01-01');
    rowValues.vedroererPeriodeTil = iso('1900-12-31');
    rowValues.tafPerioder = [{ id: 'taf-s3', fra: iso('1900-01-01'), til: iso('1900-12-31'), loseFeriedage: undefined }];
    const af = rowValues.loenindkomstAnsaettelsesforhold[0];
    af.harOverenskomst = true;
    konfigurerOffentlig(af);
    const rows = buildEoIndkomstRows(rowValues, iso(REG_DATO_FOER_DAEKNING));
    const rowStatus = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.reguleringsvaerdi`)?.status;
    expect(rowStatus).toBe('error');
  });
});

/**
 * Manuelt angivet — før-basis-rækker.
 *
 * Basisrækken repræsenterer niveauet på reguleringsdatoen. Rækker på eller før dette anker er
 * feltplacerede fejl i reader-projektionen; motorens drop er defense-in-depth og skal være tal-neutralt.
 */
describe('regulering (manuel) — før-basis-rækker droppes tal-neutralt', () => {
  const REG = '2023-01-01';

  const buildManualValues = (medFoerBasisRaekke: boolean) => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso(REG);
    values.tafPerioder = [{ id: 'taf-man', fra: iso(REG), til: iso('2024-12-31'), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenPaaHelligdage: 'Ingen',
      loenudviklingBeregningsgrundlag: 'Manuelt angivet',
      loenudviklingManuelTableData: [
        { id: 'base', dato: iso(REG), grundloen: asAmount(1000), feriepenge: 0, shSoSats: 0, fritvalg: 0, agPension: 0 },
        ...(medFoerBasisRaekke
          ? [{ id: 'foer', dato: iso('2022-06-01'), grundloen: asAmount(2000), feriepenge: 0, shSoSats: 0, fritvalg: 0, agPension: 0 }]
          : []),
        { id: 'r2', dato: iso('2024-01-01'), grundloen: asAmount(1100), feriepenge: 0, shSoSats: 0, fritvalg: 0, agPension: 0 },
      ],
    };
    return values;
  };

  const segmentsFor = (values: ReturnType<typeof buildManualValues>) =>
    buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso(REG) },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso(REG), til: iso('2024-12-31') }] }
    ).beregnedeSegmenter.map((s) => ({ fra: s.fra, deltaPct: s.deltaPct }));

  it('motoren giver identiske segmenter med og uden en før-reguleringsdato-række (droppet er tal-neutralt)', () => {
    expect(segmentsFor(buildManualValues(true))).toEqual(segmentsFor(buildManualValues(false)));
  });

});

/**
 * S5 — Manuel procentsats: uparsbar/ufuldstændig pct-række droppes stille i motoren.
 *
 * `buildManuelProcentsatsEntries` filtrerer rækker fra, hvor `dato` ikke er en gyldig ISO-dato
 * ELLER `procent` ikke er et finit tal (`manuelProcentsatsRegulering.ts:56-59`). Pga. Zod-schemaet
 * (`percentageDecimal` = `preprocess(coerceToNumberOrUndefined, z.number().min(0).max(100).optional())`)
 * kan committed `procent` KUN være et finit tal i [0;100] eller `undefined` — en NaN/Infinity/
 * uparsbar/out-of-range værdi fejler Zod-valideringen og kan ikke eksistere i committed state.
 * Det stille drop rammer derfor kun en TOM celle (`undefined`). En sådan ufuldstændig, men
 * betydningsbærende, række (dato uden procent — eller omvendt) er en potentiel tavs under-regulering:
 * motoren springer akkumuleringstrinnet over uden at kaste. Trust-invarianten kræver, at det er
 * GATED af en synlig blokerende fejl. Både validatoren (`erstatningsopgoerelseValidator.ts:892-909`)
 * og row-laget (`eoRowIndkomstRows.ts:295-308`, `alleVaerdier`-row) markerer enhver "aktiv" række
 * (dato ELLER procent udfyldt) uden BEGGE felter som `error`. Denne test binder de to sider, så et
 * fremtidigt drop, der IKKE længere er gated, fanges. (Parallel til S2/S3, men her er gaten
 * `alleVaerdier`, ikke `reguleringsvaerdi`.)
 */
describe('regulering S5 — manuel procentsats: ufuldstændig pct-række droppes stille MEN gates af en synlig row-error', () => {
  const REG = '2023-01-01';
  const TAF_SLUT = '2026-12-31';

  it('motoren dropper stille en dato-uden-procent-række (intet akkumuleringstrin) — tavs under-regulering hvis ugated', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso(REG);
    values.tafPerioder = [{ id: 'taf-s5', fra: iso(REG), til: iso(TAF_SLUT), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'Manuel procentsats',
      loenudviklingManuelProcentsatsTableData: [
        { id: 'base', dato: undefined, procent: 0 },
        // Betydningsbærende men ufuldstændig række: dato udfyldt, procent tom → droppes stille.
        { id: 'pct-mangler', dato: iso('2025-01-01'), procent: undefined },
        { id: 'pct-2026', dato: iso('2026-01-01'), procent: 10 },
      ],
    };
    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso(REG) },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso(REG), til: iso(TAF_SLUT) }] }
    );
    // Den ufuldstændige række gav intet segment-brudpunkt (dropped) — kun basis (0 %) og 2026-trinnet (10 %).
    const segmenter = model.beregnedeSegmenter.map((s) => ({ fra: s.fra, deltaPct: s.deltaPct }));
    expect(segmenter).toEqual([
      { fra: iso(REG), deltaPct: 0 },
      { fra: iso('2026-01-01'), deltaPct: 10 },
    ]);
    // Ingen boundary på 2025-01-01 — netop det stille drop.
    expect(segmenter.some((s) => s.fra === iso('2025-01-01'))).toBe(false);
  });

  it('row-gaten fyrer error for en aktiv men ufuldstændig procentsatsrække (dato uden procent)', () => {
    const rowValues = {
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
    };
    rowValues.beregnesUdFra = 'Beregningsperiode';
    rowValues.tafBeregningsperiodeTil = iso(REG);
    rowValues.tafPerioder = [{ id: 'taf-s5', fra: iso(REG), til: iso(TAF_SLUT), loseFeriedage: undefined }];
    const af = rowValues.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    af.loenudviklingManuelProcentsatsTableData = [
      { id: 'base', dato: undefined, procent: 0 },
      { id: 'pct-mangler', dato: iso('2025-01-01'), procent: undefined },
    ];
    const rows = buildEoIndkomstRows(rowValues, iso(REG));
    const gateRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.alleVaerdier`);
    expect(gateRow?.status).toBe('error');
  });

  it('row-gaten fyrer også error for en procent-uden-dato-række (omvendt ufuldstændighed)', () => {
    const rowValues = {
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
    };
    rowValues.beregnesUdFra = 'Beregningsperiode';
    rowValues.tafBeregningsperiodeTil = iso(REG);
    rowValues.tafPerioder = [{ id: 'taf-s5', fra: iso(REG), til: iso(TAF_SLUT), loseFeriedage: undefined }];
    const af = rowValues.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    af.loenudviklingManuelProcentsatsTableData = [
      { id: 'base', dato: undefined, procent: 0 },
      { id: 'dato-mangler', dato: undefined, procent: 10 },
    ];
    const rows = buildEoIndkomstRows(rowValues, iso(REG));
    const gateRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.alleVaerdier`);
    expect(gateRow?.status).toBe('error');
  });

  it('en helt tom række (hverken dato eller procent) er ikke "aktiv" — ingen error, intet regulering tabt', () => {
    const rowValues = {
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
    };
    rowValues.beregnesUdFra = 'Beregningsperiode';
    rowValues.tafBeregningsperiodeTil = iso(REG);
    rowValues.tafPerioder = [{ id: 'taf-s5', fra: iso(REG), til: iso(TAF_SLUT), loseFeriedage: undefined }];
    const af = rowValues.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    af.loenudviklingManuelProcentsatsTableData = [
      { id: 'base', dato: undefined, procent: 0 },
      { id: 'tom', dato: undefined, procent: undefined },
      { id: 'pct-2026', dato: iso('2026-01-01'), procent: 10 },
    ];
    const rows = buildEoIndkomstRows(rowValues, iso(REG));
    const gateRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.alleVaerdier`);
    expect(gateRow?.status).toBe('ok');
  });
});

/**
 * S6 — KL-lønaftaler: TAF-periode der rækker ud over sidste KL-sats.
 *
 * KL-lønaftaler-kæde-resolveren (`buildKlLoenaftalerReguleretLoenResolver.loenAt`) viderefører
 * den sidst regulerede løn for enhver dato efter sidste KL-dato (01-10-2026) — en bevidst
 * carry-forward UDEN throw i selve resolveren. Den staleness-risiko MÅ være gated af den
 * synlige `slutvaerdi`-row: row-gatens `reguleringsRange.max` =
 * `getReguleringsDatoIntervalForKlLoenaftaler().tilDato` = 31-03-2027 (nyeste + 6 mdr − 1 dag),
 * og en TAF-slutdato der ligger mere end `allowReguleringMedUdloebMedMaaneder` (default 6) måneder
 * efter dét markeres blokerende `error`. Denne test binder motorens stille carry-forward til den
 * blokerende row-gate (analog til S1/S2/S3 for før-dækning; her for efter-sidste-sats).
 */
describe('regulering S6 — KL-lønaftaler efter sidste sats: motor carry-forwarder stille MEN row-gate fyrer error', () => {
  const REG_DATO = '2024-04-01';
  const TAF_FRA_KL = '2024-04-01';
  // Langt efter KL-dækningens tilDato (31-03-2027) + 6-mdr-vinduet → blokerende error.
  const TAF_TIL_KL = '2028-12-31';

  it('motoren producerer segmenter uden at kaste (bevidst carry-forward efter sidste KL-sats)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asAmount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = iso(REG_DATO);
    values.tafPerioder = [{ id: 'taf-s6-kl', fra: iso(TAF_FRA_KL), til: iso(TAF_TIL_KL), loseFeriedage: 0 }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
    };
    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso(REG_DATO) },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso(TAF_FRA_KL), til: iso(TAF_TIL_KL) }] }
    );
    expect(model.beregnedeSegmenter.length).toBeGreaterThan(0);
    // Segmenter efter sidste KL-dato (01-10-2026) bærer den sidst regulerede løn (carry-forward),
    // ikke basisløn og ikke en throw. 30.000 kæde-opreguleret → 31.604,04 = 3.160.404 øre.
    const efterSidste = model.beregnedeSegmenter.find((s) => s.fra >= iso('2026-10-01'));
    expect(efterSidste?.reguleretLoenOre).toBe(3_160_404);
  });

  it('row-gaten (slutvaerdi) fyrer error når TAF-slutdatoen ligger efter KL-dækningen + udløbsvinduet', () => {
    const rowValues = {
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
    };
    rowValues.beregnesUdFra = 'Beregningsperiode';
    rowValues.tafBeregningsperiodeTil = iso(REG_DATO);
    rowValues.vedroererPeriodeFra = iso(TAF_FRA_KL);
    rowValues.vedroererPeriodeTil = iso(TAF_TIL_KL);
    rowValues.tafPerioder = [{ id: 'taf-s6-kl', fra: iso(TAF_FRA_KL), til: iso(TAF_TIL_KL), loseFeriedage: undefined }];
    const af = rowValues.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';
    const rows = buildEoIndkomstRows(rowValues, iso(REG_DATO));
    const slutRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.slutvaerdi`);
    expect(slutRow?.status).toBe('error');
  });

  it('row-gaten (slutvaerdi) er ok når TAF-slutdatoen ligger inden for KL-dækningen', () => {
    const rowValues = {
      ...createErstatningsopgoerelseInitialValues(),
      loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
    };
    rowValues.beregnesUdFra = 'Beregningsperiode';
    rowValues.tafBeregningsperiodeTil = iso(REG_DATO);
    // Slutdato 31-03-2027 = KL-dækningens tilDato → inden for dækning, ingen error.
    rowValues.vedroererPeriodeFra = iso(TAF_FRA_KL);
    rowValues.vedroererPeriodeTil = iso('2027-03-31');
    rowValues.tafPerioder = [{ id: 'taf-s6-kl-ok', fra: iso(TAF_FRA_KL), til: iso('2027-03-31'), loseFeriedage: undefined }];
    const af = rowValues.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';
    const rows = buildEoIndkomstRows(rowValues, iso(REG_DATO));
    const slutRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.slutvaerdi`);
    expect(slutRow?.status).toBe('ok');
  });
});
