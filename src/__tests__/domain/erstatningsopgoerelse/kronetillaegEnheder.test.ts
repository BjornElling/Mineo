import { buildIndkomstSkadestidspunkt } from '../../../domain/erstatningsopgoerelse/engines/indkomstSkadestidspunktBeregning';
import { buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { overenskomstForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/overenskomstForm';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString, type ISODateString } from '../../../types/branded';

// Kronetillæg i offentlig overenskomst (fund A1/A2 og afklaringslog 10/10a i
// `docs/review/regulering-taf-gennemgang-2026-10-13.md`).
//
// Facitterne er HÅNDREGNEDE ud fra løntrinstabellen (trin 1, gruppe 0) og faktoren 160,33 – ikke ud fra
// motorens egen omregning – så motor og kontrol ikke kan blive enige om samme enhedsfejl:
//   KL månedsløn: 01-04-2024 = 19.351,75   01-10-2024 = 19.603,25
//   KL timeløn:   01-04-2024 = 120,70      01-10-2024 = 122,27
// Reguleringsprocenten afrundes til to decimaler.

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

type Enhed = 'Time' | 'Måned';
type Ansaettelse = 'Månedsløn' | 'Timeløn';

const REGULERINGSDATO = iso('2024-04-01');
const TAF = { fra: iso('2024-04-01'), til: iso('2024-12-31') };

/** Angivet løn: «Angivet dagsløn» giver TAF i arbejdsdage, «Angivet månedsløn» TAF i måneder. */
const buildAngivetLoenValues = (params: Readonly<{
  tafBeregningsenhed: TafBeregningsenhed;
  ansaettelse: Ansaettelse;
  ekstraGrundloen?: Readonly<{ beloeb: number; enhed: Enhed }>;
  anciennitet?: Readonly<{ dato: ISODateString; sats: number; enhed: Enhed }>;
  overenskomstId?: string;
}>): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  if (params.tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE) {
    values.beregnesUdFra = 'Angivet dagsløn';
    values.dagsloenenUdgoer = amount(1000);
    values.angivetDagsloenOpreguleresFraDato = REGULERINGSDATO;
  } else {
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = amount(30000);
    values.angivetMaanedsloenOpreguleresFraDato = REGULERINGSDATO;
  }
  values.tafPerioder = [{ id: 'taf-1', fra: TAF.fra, til: TAF.til, loseFeriedage: 0 }];
  values.eoAngivetLoenLoenudvikling = {
    ...values.eoAngivetLoenLoenudvikling,
    overenskomstId: params.overenskomstId ?? 'kl-overenskomst',
    loenudviklingBeregningsgrundlag: 'Overenskomst',
    offentligLoenType: params.ansaettelse,
    offentligLoenTrin: 1,
    offentligLoenGruppe: 0,
    feriePct: 0,
    loenPaaHelligdage: 'Ingen',
    beregnStoreBededagstillaeg: false,
    offentligLoenEkstraGrundloen: params.ekstraGrundloen ? amount(params.ekstraGrundloen.beloeb) : undefined,
    offentligLoenEkstraGrundloenAngivesPer: params.ekstraGrundloen?.enhed ?? 'Måned',
    harAnciennitetstillaegEfterSkadedatoen: params.anciennitet !== undefined,
    anciennitetstillaegDato: params.anciennitet?.dato,
    anciennitetstillaegSats: params.anciennitet ? amount(params.anciennitet.sats) : undefined,
    anciennitetstillaegSatsAngivesPer: params.anciennitet?.enhed ?? 'Måned',
  };
  return values;
};

const deltaPctPaa = (values: ErstatningsopgoerelseValues, tafBeregningsenhed: TafBeregningsenhed, dato: ISODateString): number => {
  const model = buildLoenudviklingModel(
    values,
    { ...STAMDATA_INITIAL_VALUES, skadedato: REGULERINGSDATO },
    tafBeregningsenhed,
    null,
    { tafRanges: [TAF] },
  );
  const segment = model.beregnedeSegmenter.find((entry) => entry.fra <= dato && entry.til >= dato);
  if (!segment) throw new Error(`Intet segment dækker ${dato}`);
  return segment.deltaPct;
};

const TAF_ENHEDER = [TAF_BEREGNES_SOM.MAANEDER, TAF_BEREGNES_SOM.ARBEJDSDAGE] as const;

describe('kronetillæg i pakkens enhed', () => {
  describe('forhøjet grundløn (fund A1)', () => {
    // A1-facit: KL, trin 1, gruppe 0, Månedsløn, TAF i arbejdsdage, basis 01-04-2024, satsændring 01-10-2024,
    // 1.000 kr./måned: (19.603,25 + 1.000) / (19.351,75 + 1.000) − 1 = 1,2358 % → 1,24 % (tidligere 0,14 %).
    it('A1: 1.000 kr./måned ved Månedsløn og TAF i arbejdsdage giver 1,24 %', () => {
      const values = buildAngivetLoenValues({
        tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
        ansaettelse: 'Månedsløn',
        ekstraGrundloen: { beloeb: 1000, enhed: 'Måned' },
      });
      expect(deltaPctPaa(values, TAF_BEREGNES_SOM.ARBEJDSDAGE, iso('2024-10-15'))).toBe(1.24);
    });

    // Matrix over «Ansættelse» × TAF-enhed × beløbets enhed. TAF-enheden må ikke flytte resultatet.
    //   Månedsløn, 1.000 kr./måned:  20.603,25 / 20.351,75      = 1,0123578 → 1,24 %
    //   Månedsløn, 6,24 kr./time:    6,24 × 160,33 = 1.000,46;  20.603,71 / 20.352,21 = 1,0123574 → 1,24 %
    //   Timeløn, 1.000 kr./måned:    1.000 / 160,33 = 6,24;     128,51 / 126,94 = 1,0123681 → 1,24 %
    //   Timeløn, 50 kr./time:        172,27 / 170,70            = 1,0091974 → 0,92 %
    it.each(TAF_ENHEDER.flatMap((tafBeregningsenhed) => [
      { tafBeregningsenhed, ansaettelse: 'Månedsløn' as const, beloeb: 1000, enhed: 'Måned' as const, facit: 1.24 },
      { tafBeregningsenhed, ansaettelse: 'Månedsløn' as const, beloeb: 6.24, enhed: 'Time' as const, facit: 1.24 },
      { tafBeregningsenhed, ansaettelse: 'Timeløn' as const, beloeb: 1000, enhed: 'Måned' as const, facit: 1.24 },
      { tafBeregningsenhed, ansaettelse: 'Timeløn' as const, beloeb: 50, enhed: 'Time' as const, facit: 0.92 },
    ]))('$ansaettelse, TAF i $tafBeregningsenhed, $beloeb kr. pr. $enhed → $facit %', (params) => {
      const values = buildAngivetLoenValues({
        tafBeregningsenhed: params.tafBeregningsenhed,
        ansaettelse: params.ansaettelse,
        ekstraGrundloen: { beloeb: params.beloeb, enhed: params.enhed },
      });
      expect(deltaPctPaa(values, params.tafBeregningsenhed, iso('2024-10-15'))).toBe(params.facit);
    });

    // RLTN, trin 1, gruppe 0: månedsløn 18.813,50 → 19.075,00; timeløn 117,34 → 118,97 (01-04 / 01-10-2024).
    //   Månedsløn, 1.000 kr./måned: 20.075,00 / 19.813,50 = 1,0131980 → 1,32 %
    //   Timeløn, 1.000 kr./måned:   1.000 / 160,33 = 6,24; 125,21 / 123,58 = 1,0131898 → 1,32 %
    it.each(TAF_ENHEDER.flatMap((tafBeregningsenhed) => [
      { tafBeregningsenhed, ansaettelse: 'Månedsløn' as const },
      { tafBeregningsenhed, ansaettelse: 'Timeløn' as const },
    ]))('RLTN, $ansaettelse, TAF i $tafBeregningsenhed, 1.000 kr./måned → 1,32 %', ({ tafBeregningsenhed, ansaettelse }) => {
      const values = buildAngivetLoenValues({
        tafBeregningsenhed,
        ansaettelse,
        ekstraGrundloen: { beloeb: 1000, enhed: 'Måned' },
        overenskomstId: 'rltn-overenskomst',
      });
      expect(deltaPctPaa(values, tafBeregningsenhed, iso('2024-10-15'))).toBe(1.32);
    });
  });

  describe('anciennitetstillæg (fund A2)', () => {
    const ANCIENNITETSDATO = iso('2024-05-01');

    // A2-facit: Månedsløn, TAF i arbejdsdage, basisløn 19.351,75, 500 kr./måned fra 01-05-2024:
    // 19.851,75 / 19.351,75 − 1 = 2,5837 % → 2,58 % (tidligere 0,02 %).
    it('A2: 500 kr./måned ved Månedsløn og TAF i arbejdsdage giver 2,58 %', () => {
      const values = buildAngivetLoenValues({
        tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
        ansaettelse: 'Månedsløn',
        anciennitet: { dato: ANCIENNITETSDATO, sats: 500, enhed: 'Måned' },
      });
      expect(deltaPctPaa(values, TAF_BEREGNES_SOM.ARBEJDSDAGE, iso('2024-05-15'))).toBe(2.58);
    });

    // A2-facit, høj variant: angivet månedsløn (TAF i måneder) og offentlig Timeløn, basis 120,70 kr./time,
    // 500 kr./måned: 500 / 160,33 = 3,12; 123,82 / 120,70 − 1 = 2,5849 % → 2,58 % (tidligere 414,25 %).
    it('A2: 500 kr./måned ved Timeløn og TAF i måneder giver ca. 2,58 %', () => {
      const values = buildAngivetLoenValues({
        tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
        ansaettelse: 'Timeløn',
        anciennitet: { dato: ANCIENNITETSDATO, sats: 500, enhed: 'Måned' },
      });
      expect(deltaPctPaa(values, TAF_BEREGNES_SOM.MAANEDER, iso('2024-05-15'))).toBe(2.58);
    });

    // Matrix: samme tillæg giver samme regulering uanset TAF-enhed.
    //   Månedsløn, 3,12 kr./time: 3,12 × 160,33 = 500,23; 19.851,98 / 19.351,75 = 1,0258498 → 2,58 %
    //   Timeløn, 3,12 kr./time:   123,82 / 120,70 = 1,0258492 → 2,58 %
    it.each(TAF_ENHEDER.flatMap((tafBeregningsenhed) => [
      { tafBeregningsenhed, ansaettelse: 'Månedsløn' as const, sats: 500, enhed: 'Måned' as const },
      { tafBeregningsenhed, ansaettelse: 'Månedsløn' as const, sats: 3.12, enhed: 'Time' as const },
      { tafBeregningsenhed, ansaettelse: 'Timeløn' as const, sats: 500, enhed: 'Måned' as const },
      { tafBeregningsenhed, ansaettelse: 'Timeløn' as const, sats: 3.12, enhed: 'Time' as const },
    ]))('$ansaettelse, TAF i $tafBeregningsenhed, $sats kr. pr. $enhed → 2,58 %', (params) => {
      const values = buildAngivetLoenValues({
        tafBeregningsenhed: params.tafBeregningsenhed,
        ansaettelse: params.ansaettelse,
        anciennitet: { dato: ANCIENNITETSDATO, sats: params.sats, enhed: params.enhed },
      });
      expect(deltaPctPaa(values, params.tafBeregningsenhed, iso('2024-05-15'))).toBe(2.58);
    });

    // RLTN: Månedsløn 19.313,50 / 18.813,50 = 1,0265767 → 2,66 %; Timeløn 500 / 160,33 = 3,12;
    // 120,46 / 117,34 = 1,0265894 → 2,66 %.
    it.each(TAF_ENHEDER.flatMap((tafBeregningsenhed) => [
      { tafBeregningsenhed, ansaettelse: 'Månedsløn' as const },
      { tafBeregningsenhed, ansaettelse: 'Timeløn' as const },
    ]))('RLTN, $ansaettelse, TAF i $tafBeregningsenhed, 500 kr./måned → 2,66 %', ({ tafBeregningsenhed, ansaettelse }) => {
      const values = buildAngivetLoenValues({
        tafBeregningsenhed,
        ansaettelse,
        anciennitet: { dato: ANCIENNITETSDATO, sats: 500, enhed: 'Måned' },
        overenskomstId: 'rltn-overenskomst',
      });
      expect(deltaPctPaa(values, tafBeregningsenhed, iso('2024-05-15'))).toBe(2.66);
    });
  });

  describe('beregningsperiode (ansættelseskortet)', () => {
    // Ved «Beregningsperiode» læses felterne fra ansættelsesforholdet. Formen får ingen TAF-enhed at
    // forveksle med beløbets enhed; facittet er derfor det samme som ved angivet løn.
    const konsoliderOgByg = (patch: Parameters<typeof createSource>[0]) => {
      const source = createSource(patch);
      const resolved = overenskomstForm.konsolider({
        active: [source],
        angivetLoen: false,
        anvendtReguleringsdato: REGULERINGSDATO,
        tafRanges: [TAF],
        kraeverFeriePctVedBeregningsperiode: false,
        activeMedSynligeSatserOgLoenoplysninger: [],
      });
      if (!resolved.konsolideret) throw new Error('Overenskomst blev ikke konsolideret');
      return overenskomstForm.byggResultat(resolved.konsolideret).segmenter;
    };
    const createSource = (patch: Partial<ReturnType<typeof createDefaultLoenindkomstAnsaettelsesforhold>>) => ({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'af-1',
      loenudviklingBeregningsgrundlag: 'Overenskomst' as const,
      overenskomstId: 'kl-overenskomst',
      offentligLoenTrin: 1,
      offentligLoenGruppe: 0,
      feriePct: 0,
      loenPaaHelligdage: 'Ingen' as const,
      beregnStoreBededagstillaeg: false,
      storeBededagPct: undefined,
      ...patch,
    });

    it.each([
      { ansaettelse: 'Månedsløn' as const, beloeb: 1000, enhed: 'Måned' as const },
      { ansaettelse: 'Timeløn' as const, beloeb: 1000, enhed: 'Måned' as const },
    ])('forhøjet grundløn $beloeb kr. pr. $enhed ved $ansaettelse → 1,24 %', ({ ansaettelse, beloeb, enhed }) => {
      const segmenter = konsoliderOgByg({
        offentligLoenType: ansaettelse,
        offentligLoenEkstraGrundloen: amount(beloeb),
        offentligLoenEkstraGrundloenAngivesPer: enhed,
      });
      expect(segmenter.find((segment) => segment.fra === iso('2024-10-01'))?.deltaPct).toBe(1.24);
    });

    it('anciennitetstillæg 500 kr./måned ved Timeløn → 2,58 %', () => {
      const segmenter = konsoliderOgByg({
        offentligLoenType: 'Timeløn',
        harAnciennitetstillaegEfterSkadedatoen: true,
        anciennitetstillaegDato: iso('2024-05-01'),
        anciennitetstillaegSats: amount(500),
        anciennitetstillaegSatsAngivesPer: 'Måned',
      });
      expect(segmenter.find((segment) => segment.fra === iso('2024-05-01'))?.deltaPct).toBe(2.58);
    });
  });
  describe('RLTN via beregningsperiodens samlede motorforløb', () => {
    // RLTN, trin 1/gruppe 0: 18.813,50 -> 19.075,00 kr./måned og 117,34 -> 118,97 kr./time.
    // 1.000 kr./måned = 6,24 kr./time; 500 kr./måned = 3,12 kr./time.
    // Facit: forhøjet grundløn 1,32 % ved oktobertrinnet; anciennitet 2,66 % fra maj.
    it.each(TAF_ENHEDER.flatMap((tafEnhed) => (['Månedsløn', 'Timeløn'] as const).flatMap((ansaettelse) =>
      (['Måned', 'Time'] as const).flatMap((enhed) => (['forhoejelse', 'anciennitet'] as const).map((felt) => ({
        tafEnhed, ansaettelse, enhed, felt,
      }))))))('$felt, $ansaettelse, TAF i $tafEnhed, angivet pr. $enhed', ({ tafEnhed, ansaettelse, enhed, felt }) => {
      const values = createErstatningsopgoerelseInitialValues();
      values.beregnesUdFra = 'Beregningsperiode';
      values.tafBeregningsperiodeFra = iso('2024-01-01');
      values.tafBeregningsperiodeTil = iso('2024-01-31');
      values.loenindkomstAnsaettelsesforhold = [{
        ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'rltn',
        loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'rltn-overenskomst',
        offentligLoenType: ansaettelse, offentligLoenTrin: 1, offentligLoenGruppe: 0,
        saerligFraDatoRegulering: REGULERINGSDATO, feriePct: 0, loenPaaHelligdage: 'Ingen',
        fuldLoenUnderFerie: tafEnhed === 'Måneder' ? 'Ja' : 'Nej',
        offentligLoenEkstraGrundloen: felt === 'forhoejelse' ? amount(enhed === 'Måned' ? 1000 : 6.24) : undefined,
        offentligLoenEkstraGrundloenAngivesPer: enhed,
        harAnciennitetstillaegEfterSkadedatoen: felt === 'anciennitet',
        anciennitetstillaegDato: iso('2024-05-01'),
        anciennitetstillaegSats: felt === 'anciennitet' ? amount(enhed === 'Måned' ? 500 : 3.12) : undefined,
        anciennitetstillaegSatsAngivesPer: enhed,
        indtaegtsoplysningerTableData: [{ id: 'loen', col0_maaned: '1', col1_maaned: '2024',
          col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined,
          col2: amount(30000), col3: undefined, col4: undefined, col5: undefined }],
      }];
      const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-02-01') };
      const income = buildIncomeForRanges(values, [{ fra: values.tafBeregningsperiodeFra, til: values.tafBeregningsperiodeTil }]);
      const basis = buildIndkomstSkadestidspunkt(values, stamdata, tafEnhed, { incomeForBeregningsperiode: income });
      const model = buildLoenudviklingModel(values, stamdata, tafEnhed, basis, { tafRanges: [TAF] });
      const dato = iso(felt === 'forhoejelse' ? '2024-10-15' : '2024-05-15');
      const segment = model.perAnsaettelse[0]?.beregnedeSegmenter.find((entry) => entry.fra <= dato && entry.til >= dato);
      expect(segment?.deltaPct).toBe(felt === 'forhoejelse' ? 1.32 : 2.66);
    });
  });

});
