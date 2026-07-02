import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { LoenudviklingOgSatser } from '../../../schemas/formSchemas';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
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
