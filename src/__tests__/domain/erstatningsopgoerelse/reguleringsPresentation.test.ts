import {
  buildReguleringsvaerdierTableData,
  buildReguleringIndexRows,
  resolveAnvendtReguleringsdato as resolvePdfAnvendtReguleringsdato,
  resolveLoenudviklingSegmenterForKilde,
  resolveLoenSkadedatoText,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';
import type { LoenudviklingSegment } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { buildManuelProcentsatsEntries } from '../../../domain/erstatningsopgoerelse/engines/manuelProcentsatsRegulering';
import { buildKrlIndexEntries } from '../../../domain/erstatningsopgoerelse/engines/krlRegulering';
import { buildStatistikIndexEntries } from '../../../domain/erstatningsopgoerelse/engines/statistikRegulering';
import { buildKlLoenaftalerIndexEntries } from '../../../domain/erstatningsopgoerelse/engines/klLoenaftalerRegulering';
import { resolveStatistikModelId } from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import {
  getAngivetLoenOpreguleresFraDato,
  resolveAktivEllerFoersteLoenudviklingKilde,
} from '../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato as resolveSharedAnvendtReguleringsdato } from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()].map((af) => ({
    ...af,
    indtaegtsoplysningerTableData: [...af.indtaegtsoplysningerTableData],
    loenudviklingManuelTableData: [...af.loenudviklingManuelTableData],
    loenudviklingManuelProcentsatsTableData: [...af.loenudviklingManuelProcentsatsTableData],
  })),
});

describe('reguleringsPresentation', () => {
  const expectPdfReguleringsdatoParity = (
    values: ReturnType<typeof cloneInitialValues>,
    af: ReturnType<typeof cloneInitialValues>['loenindkomstAnsaettelsesforhold'][number]
  ) => {
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') };
    const sharedResult = resolveSharedAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
      saerligFraDatoRegulering: af.saerligFraDatoRegulering,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato: stamdata.skadedato,
    });

    expect(resolvePdfAnvendtReguleringsdato(stamdata, values, af)).toBe(sharedResult);
  };

  describe('resolveLoenudviklingSegmenterForKilde', () => {
    const seg = (fra: string, til: string, deltaPct: number): LoenudviklingSegment => ({
      kind: 'maaneder',
      fra: iso(fra),
      til: iso(til),
      maaneder: 12,
      maanedsloenOre: 100000,
      deltaPct,
      amountOre: 100000,
    });

    it('falder tilbage til de globale segmenter når perAnsaettelse er tom (angivet løn)', () => {
      // Regression: ved angivet løn er perAnsaettelse tom, og hele forløbet ligger i de
      // globale segmenter. Uden denne fallback manglede "Beregnet regulering"-tabellen helt,
      // selvom forløbet var korrekt beregnet og vist under Forventet indkomst.
      const globaleSegmenter = [seg('2022-06-01', '2022-12-31', 0), seg('2023-01-01', '2023-12-31', 3.16)];
      const segments = resolveLoenudviklingSegmenterForKilde({
        perAnsaettelse: [],
        globaleSegmenter,
        ansaettelsesforholdId: 'eo-angivet-loen',
      });
      expect(segments).toEqual(globaleSegmenter);
    });

    it('bruger per-ansættelse-segmenterne når et match findes', () => {
      const afSegmenter = [seg('2023-01-01', '2023-12-31', 2)];
      const segments = resolveLoenudviklingSegmenterForKilde({
        perAnsaettelse: [{ ansaettelsesforholdId: 'af-1', beregnedeSegmenter: afSegmenter }],
        globaleSegmenter: [seg('2020-01-01', '2020-12-31', 99)],
        ansaettelsesforholdId: 'af-1',
      });
      expect(segments).toEqual(afSegmenter);
    });

    it('returnerer tomt ved reel per-ansættelse-model uden match (ikke globale segmenter)', () => {
      // Et ansættelsesforhold uden eget forløb (fx uden indkomst i beregningsperioden) må ikke
      // arve det samlede globale forløb fra de øvrige ansættelsesforhold.
      const segments = resolveLoenudviklingSegmenterForKilde({
        perAnsaettelse: [{ ansaettelsesforholdId: 'af-1', beregnedeSegmenter: [seg('2023-01-01', '2023-12-31', 2)] }],
        globaleSegmenter: [seg('2023-01-01', '2023-12-31', 2)],
        ansaettelsesforholdId: 'af-2',
      });
      expect(segments).toEqual([]);
    });
  });

  describe('overenskomst — vist reguleringsindeks matcher det udbetalte (anciennitetstillæg på/før reguleringsdatoen)', () => {
    // Bruger-beslutning 2026-07-07 ("basis skal indeholde tillægget"): et anciennitetstillæg,
    // der allerede gælder på (den effektive) reguleringsdato, er en del af referenceniveauet
    // (indeks 100), ikke lønudvikling oven på det. Motoren udelod tidligere tillægget fra basen,
    // så det udbetalte beløb (deltaPct) blev afledt af en anden basis end det viste indeks. Denne
    // test binder de to sider: for hvert vist indeks skal der findes et motorsegment med
    // deltaPct = indeks − 100. Den fejlede før rettelsen (motorens basis manglede tillægget).
    const parseDaNumber = (value: string): number =>
      Number(value.replace(/\./g, '').replace(',', '.'));

    it('privat overenskomst: vist indeks = 100 + motorens deltaPct når tillægget indgår i basis', () => {
      const REG = '2023-01-01';
      // Fælles reguleringskonfiguration, så motorens (angivet-løn) og præsentationens
      // (ansættelsesforhold) input er identiske for de regulerende felter.
      const overenskomstFelter = {
        loenudviklingBeregningsgrundlag: 'Overenskomst' as const,
        overenskomstId: 'bygge-anlaeg' as const,
        loenPaaHelligdage: 'Ingen' as const,
        feriePct: 12.5,
        harAnciennitetstillaegEfterSkadedatoen: true,
        // Anciennitetsdato FØR reguleringsdatoen (skadedato ≤ dato pr. UI-min) → tillægget gælder
        // allerede på reguleringsdatoen og indgår derfor i basen.
        anciennitetstillaegDato: iso('2020-06-01'),
        anciennitetstillaegSatsAngivesPer: 'Måned' as const,
        anciennitetstillaegSats: asAmountValue(1000),
      };
      const values = cloneInitialValues();
      values.beregnesUdFra = 'Angivet månedsløn';
      values.maanedsloenenUdgoer = asAmountValue(30000);
      values.angivetMaanedsloenOpreguleresFraDato = iso(REG);
      values.tafPerioder = [{ id: 'taf-anc', fra: iso(REG), til: iso('2025-12-31'), loseFeriedage: 0 }];
      values.eoAngivetLoenLoenudvikling = {
        ...values.eoAngivetLoenLoenudvikling,
        ...overenskomstFelter,
      };
      const afForPraesentation = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        ...overenskomstFelter,
      };
      const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2020-01-01') };
      const tafRanges = [{ fra: iso(REG), til: iso('2025-12-31') }];

      const model = buildLoenudviklingModel(values, stamdata, TAF_BEREGNES_SOM.MAANEDER, null, { tafRanges });
      const indexRows = buildReguleringIndexRows({
        segments: model.beregnedeSegmenter,
        ansaettelsesforhold: afForPraesentation,
        anvendtReguleringsdato: iso(REG),
        tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      });

      // Distinkte indeksværdier på hver side (præsentationen fletter nabosegmenter med samme
      // beregning, så distinkte mængder — ikke rækker 1:1 — er det korrekte sammenligningsgrundlag).
      const motorIndeks = new Set(model.beregnedeSegmenter.map((s) => (100 + s.deltaPct).toFixed(2)));
      const vistIndeks = new Set(
        indexRows
          .filter((row) => row.indeks !== '-' && row.indeks !== '')
          .map((row) => parseDaNumber(row.indeks).toFixed(2))
      );

      // Meningsfuldhed: der ER reel regulering (ellers ville alt være 100,00 og testen triviel).
      expect([...motorIndeks].some((v) => v !== '100.00')).toBe(true);
      expect(vistIndeks).toEqual(motorIndeks);
    });
  });

  it('bruger samme reguleringsdato i PDF-adapteren som den kanoniske shared-funktion', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.saerligFraDatoRegulering = iso('2024-07-01');
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2024-01-31');

    expectPdfReguleringsdatoParity(values, af);
  });

  it('vælger samme aktive ansættelsesforhold til PDF-reguleringsdato som motorens fælles helper', () => {
    const values = cloneInitialValues();
    const førsteAf = values.loenindkomstAnsaettelsesforhold[0];
    const aktivAf = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'aktiv-af',
      navnPaaArbejdssted: 'Aktivt arbejdssted',
      loenudviklingBeregningsgrundlag: 'Statistik' as const,
      loenudviklingStatistikModel: 'ILON12 (Danmarks Statistik)' as const,
      saerligFraDatoRegulering: iso('2024-07-01'),
      indtaegtsoplysningerTableData: [],
      loenudviklingManuelTableData: [],
    };
    førsteAf.loenudviklingBeregningsgrundlag = 'Ingen';
    førsteAf.saerligFraDatoRegulering = iso('2024-02-01');
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = iso('2024-01-31');
    values.loenindkomstAnsaettelsesforhold = [førsteAf, aktivAf];

    const valgtAf = resolveAktivEllerFoersteLoenudviklingKilde(values);

    expect(valgtAf?.id).toBe('aktiv-af');
    expect(resolvePdfAnvendtReguleringsdato(
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2024-01-01') },
      values,
      valgtAf ?? førsteAf
    )).toBe(iso('2024-07-01'));
  });

  it('bruger samme reguleringsdato i PDF-adapteren for angivet månedsløn', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.saerligFraDatoRegulering = undefined;
    values.beregnesUdFra = 'Angivet månedsløn';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2024-03-15');

    expectPdfReguleringsdatoParity(values, af);
  });

  it('bruger samme reguleringsdato i PDF-adapteren for angivet dagsløn', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.saerligFraDatoRegulering = undefined;
    values.beregnesUdFra = 'Angivet dagsløn';
    values.angivetDagsloenOpreguleresFraDato = iso('2024-04-10');

    expectPdfReguleringsdatoParity(values, af);
  });

  it('bruger samme undefined-reguleringsdato i PDF-adapteren uden særskilt dato eller beregningsperiode-slutdato', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.saerligFraDatoRegulering = undefined;
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeTil = undefined;

    expectPdfReguleringsdatoParity(values, af);
  });

  it('formaterer implicit beregningsperiode-slutdato som "opgjort frem til"', () => {
    expect(resolveLoenSkadedatoText({
      subject: 'lønnen',
      anvendtReguleringsdato: iso('2017-05-02'),
      skadedato: iso('2016-01-01'),
      useUntilWordingForImplicitBeregningsperiodeDate: true,
    })).toBe('lønnen opgjort frem til 2. maj 2017');
  });

  it('bevarer "opgjort per" ved eksplicit reguleringsdato', () => {
    expect(resolveLoenSkadedatoText({
      subject: 'lønnen',
      anvendtReguleringsdato: iso('2017-05-02'),
      skadedato: iso('2016-01-01'),
      useUntilWordingForImplicitBeregningsperiodeDate: false,
    })).toBe('lønnen opgjort per 2. maj 2017');
  });

  it('viser tidligste faktiske sats uden reguleringsdato-række og sætter note ved manglende tidlig dækning', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laasesmedeoverenskomsten';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2020-01-01'),
      tafFra: iso('2020-04-01'),
      tafTil: iso('2026-02-26'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.length).toBeGreaterThan(0);
    // Ingen syntetisk række på reguleringsdatoen (01-01-2020) — den opgivne "referencerække" er fjernet.
    expect(table?.rows.some((row) => row[0] === '01-01-2020')).toBe(false);
    // Første række er laasesmedeoverenskomstens tidligste faktiske satsdato.
    // Hvis overenskomstdata ændres, skal denne forventning opdateres.
    expect(table?.rows[0]?.[0]).toBe('01-03-2023');
    // Store Bededag-grænsen bevares fortsat som særskilt række.
    expect(table?.rows.some((row) => row[0] === '01-01-2024')).toBe(true);
    expect(table?.rows.some((row) => row[0] === '01-03-2024')).toBe(true);
    // Noten oplyser, at reguleringen tager afsæt i den tidligste registrerede sats.
    expect(table?.tidligsteSatsGaelderFra).toBe(iso('2023-03-01'));
  });

  it('skjuler Fritvalg-kolonne for overenskomst hvor fritvalg er 0 i alle perioder', () => {
    // Regression: bygningsoverenskomsten har fritvalg: 0 (base default) i alle perioder.
    // Kolonnen skal ikke vises.
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'bygningsoverenskomsten';
    af.loenPaaHelligdage = 'SH-udbetaling';
    af.feriePct = 12.5;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-01-01'),
      tafFra: iso('2023-01-01'),
      tafTil: iso('2023-12-31'),
      // TAF opgøres aldrig i timer; enheden er enten Måneder eller Arbejdsdage. En timelønnet
      // overenskomst som bygningsoverenskomsten opgøres pr. arbejdsdag (timelønsudviklingen
      // driver reguleringsprocenten), så enheden her er 'Arbejdsdage'.
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).not.toContain('Fritvalg');
    expect(table?.columns).toContain('SH/SO');
    expect(table?.columns).toContain('AG pens. bidrag');
  });

  it('viser tidligste faktiske private overenskomstsats uden reguleringsdato-række og sætter note', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laasesmedeoverenskomsten';
    af.feriePct = 12.5;
    af.shSoPct = 2.7;
    af.pensionPct = 8.15;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2020-01-01'),
      tafFra: iso('2020-04-01'),
      tafTil: iso('2024-04-30'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    // Ingen syntetisk række på reguleringsdatoen (01-01-2020).
    expect(table?.rows.some((row) => row[0] === '01-01-2020')).toBe(false);
    // Første række er den tidligste faktiske overenskomstsats med de indtastede tillæg.
    expect(table?.rows[0]?.[0]).toBe('01-03-2023');
    expect(table?.rows[0]?.[1]).toBe('131,65');
    expect(table?.tidligsteSatsGaelderFra).toBe(iso('2023-03-01'));
  });

  it('viser overenskomstens tillægskolonner i Beløb-tilstand', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.tillaegAngivesSom = 'beloeb';
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laasesmedeoverenskomsten';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 12.5;
    af.shSoPct = 2.7;
    af.pensionPct = 8.15;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2020-01-01'),
      tafFra: iso('2020-04-01'),
      tafTil: iso('2024-04-30'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).toEqual(['Fra-dato', 'Timeløn', 'Feriepenge', 'SH/SO', 'Fritvalg', 'Store Bededag', 'AG pens. bidrag']);
    expect(table?.rows.some((row) => row[0] === '01-01-2024')).toBe(true);
  });

  it('bygger reguleringsindeks-rækker selv når segmenter starter før første overenskomstdækning', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laasesmedeoverenskomsten';

    const rows = buildReguleringIndexRows({
      segments: [
        {
          kind: 'maaneder',
          fra: iso('2020-04-01'),
          til: iso('2024-02-29'),
          maaneder: 47,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
        {
          kind: 'maaneder',
          fra: iso('2024-03-01'),
          til: iso('2024-03-31'),
          maaneder: 1,
          maanedsloenOre: 100000,
          deltaPct: 10,
          amountOre: 100000,
        },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2020-01-01'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.fraDato).toBe('01-04-2020');
    expect(rows[0]?.indeks).toBe('100,00');
  });

  it('viser overenskomstindeks med tillæg i Beløb-tilstand', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.tillaegAngivesSom = 'beloeb';
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'bygge-anlaeg';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 12.5;

    const rows = buildReguleringIndexRows({
      segments: [
        {
          kind: 'maaneder',
          fra: iso('2023-06-01'),
          til: iso('2024-03-31'),
          maaneder: 10,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows.some((row) => row.fraDato === '01-01-2024')).toBe(true);
    expect(rows[0]?.indeksberegning).toContain('%');
    expect(rows[0]?.indeksberegning).toContain('x');
  });

  it('indregner indtastede satser som basis når privat overenskomst mangler på reguleringsdatoen', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    // Maskinhandler-overenskomsten har historiske satser, så reguleringsdatoen kan bruge faktisk dækning.
    af.overenskomstId = 'maskinhandler-overenskomsten';
    af.feriePct = 12.5;
    af.shSoPct = 2.7;
    af.pensionPct = 8.15;
    af.loenPaaHelligdage = 'SH-udbetaling';

    const rows = buildReguleringIndexRows({
      segments: [
        {
          kind: 'maaneder',
          fra: iso('2024-03-01'),
          til: iso('2024-04-30'),
          maaneder: 2,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2020-01-01'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.indeks).toBe('122,19');
    expect(rows[0]?.loenudvikling).toBe('+ 22,19 %');
  });

  it('viser Store Bededag som særskilt fallback-beregning før første private overenskomstdækning', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laasesmedeoverenskomsten';

    const rows = buildReguleringIndexRows({
      segments: [
        {
          kind: 'maaneder',
          fra: iso('2024-01-01'),
          til: iso('2024-02-29'),
          maaneder: 2,
          maanedsloenOre: 100000,
          deltaPct: 0.36,
          amountOre: 100000,
        },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2020-01-01'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.indeks).not.toBe('100,00');
    expect(rows[0]?.indeksberegning).toContain('0,45 %');
  });

  it('indsætter Store Bededag som separat række 01-01-2024 i offentlig reguleringsværdier-tabel', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'kl-overenskomst';
    af.offentligLoenType = 'Timeløn';
    af.offentligLoenTrin = 20;
    af.offentligLoenGruppe = 0;
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 16.95;
    af.pensionPct = 14.37;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafFra: iso('2023-06-01'),
      tafTil: iso('2025-12-31'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).toEqual(['Fra-dato', 'Månedsløn', 'Feriepenge', 'Store Bededag', 'AG pens. bidrag']);
    expect(table?.rows.some((row) => row[0] === '01-01-2024')).toBe(true);
  });

  it('udelader anvendt reguleringsdato i privat reguleringsværdier-tabel når overenskomsten har sats på datoen', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'bygge-anlaeg';
    af.loenPaaHelligdage = 'SH-udbetaling';
    af.feriePct = 15;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafFra: iso('2023-06-01'),
      tafTil: iso('2024-04-30'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.some((row) => row[0] === '24-05-2023')).toBe(false);
    expect(table?.rows[0]?.[0]).toBe('01-06-2023');
  });

  it('bevarer kolonneantal i privat reguleringsværdier-tabel uden særskilt reguleringsdato når sats findes', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'bygge-anlaeg';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 15;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafFra: iso('2023-06-01'),
      tafTil: iso('2024-04-30'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.some((row) => row[0] === '24-05-2023')).toBe(false);
    expect(table?.rows.every((row) => row.length === table.columns.length)).toBe(true);
  });

  it('indsætter 01-01-2024 som separat Store Bededag-grænserække i privat lønreguleringstabel når TAF krydser datoen med Almindelig løn', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'bygge-anlaeg';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 15;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafFra: iso('2023-06-01'),
      tafTil: iso('2024-04-30'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).toContain('Store Bededag');
    expect(table?.rows.some((row) => row[0] === '01-01-2024')).toBe(true);
  });

  it('viser fallback-satser på 01-01-2024 i privat lønreguleringstabel før første overenskomstdækning', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    // Maskinhandler-overenskomsten har historiske satser, så 01-01-2024 bruger senest kendte faktiske sats.
    af.overenskomstId = 'maskinhandler-overenskomsten';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 12.5;
    af.shSoPct = 2.7;
    af.pensionPct = 8.15;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2017-05-02'),
      tafFra: iso('2017-05-01'),
      tafTil: iso('2024-04-30'),
      tafBeregningsenhed: 'Måneder',
    });

    const row = table?.rows.find((entry) => entry[0] === '01-01-2024');
    expect(row).toBeDefined();
    expect(row?.slice(1)).toEqual(['131,65', '12,5 %', '0 %', '12,5 %', '0,45 %', '10,5 %']);
  });

  it('viser KL-lønaftaler med dato og periode-reguleringssats (ingen akkumuleret kolonne)', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-04-01'),
      tafFra: iso('2024-04-01'),
      tafTil: iso('2026-12-31'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table?.columns).toEqual(['Fra-dato', 'Regulering']);
    expect(table?.rows.find((r) => r[0] === '01-10-2024')).toEqual(['01-10-2024', '1,30 %']);
    expect(table?.rows.find((r) => r[0] === '01-10-2025')).toEqual(['01-10-2025', '0,30 %']);
  });

  it('injicerer ingen streg-række på KL-reguleringsdatoen når den ligger midt i en periode', () => {
    // Regression: reguleringsdato 31-05-2022 lå mellem to KL-satser (01-10-2021 og 01-10-2022) og gav
    // tidligere en støjrække "31-05-2022 | -". Nu vises kun den gældende sats ved vinduets start.
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2022-05-31'),
      tafFra: iso('2022-05-31'),
      tafTil: iso('2024-04-30'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.some((row) => row[0] === '31-05-2022')).toBe(false);
    // Første række er den senest gældende KL-sats før reguleringsvinduets start.
    expect(table?.rows[0]).toEqual(['01-10-2021', '1,00 %']);
    // Sats gælder på/før reguleringsdatoen → ingen note.
    expect(table?.tidligsteSatsGaelderFra).toBeUndefined();
  });

  it('Beregnet regulering for KL-lønaftaler: lønudvikling gentager periodesatsen, reguleret løn er kæde-opreguleret', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';

    // Segmenter som motoren ville bygge: enhedsløn = basisløn, deltaPct = den akkumulerede
    // regulering afledt af den kæde-opregulerede (trinvist afrundede) løn.
    const klSegment = (fra: string, til: string, reguleretLoen: number): LoenudviklingSegment => ({
      kind: 'maaneder',
      fra: iso(fra),
      til: iso(til),
      maaneder: 6,
      maanedsloenOre: 3_000_000,
      deltaPct: (reguleretLoen / 30000 - 1) * 100,
      amountOre: Math.round(reguleretLoen * 6 * 100),
    });
    const segments = [
      klSegment('2024-04-01', '2024-09-30', 30_000.00),
      klSegment('2024-10-01', '2025-09-30', 30_390.00),
      klSegment('2025-10-01', '2025-10-31', 30_481.17),
      klSegment('2025-11-01', '2026-03-31', 30_709.78),
    ];

    const rows = buildReguleringIndexRows({
      segments,
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-04-01'),
      tafBeregningsenhed: 'Måneder',
    });

    // Basisperioden (reguleringsdatoen): ingen sats, lønnen er uændret.
    const base = rows.find((r) => r.fraDato === '01-04-2024');
    expect(base?.loenudvikling).toBe('');
    expect(base?.reguleretLoen).toBe('30.000,00');

    // Lønudvikling gentager periodens reguleringssats (ikke akkumuleret), og reguleret løn
    // er den forudgående løn forhøjet med satsen og afrundet: 30.481,17 × 1,0075 = 30.709,78.
    const okt2024 = rows.find((r) => r.fraDato === '01-10-2024');
    expect(okt2024?.loenudvikling).toBe('1,30 %');
    expect(okt2024?.reguleretLoen).toBe('30.390,00');
    expect(okt2024?.indeksberegning).toBe('');

    const nov2025 = rows.find((r) => r.fraDato === '01-11-2025');
    expect(nov2025?.loenudvikling).toBe('0,75 %');
    expect(nov2025?.reguleretLoen).toBe('30.709,78');
  });

  it('Beregnet regulering for KL-lønaftaler bruger segmentets autoritative reguleretLoenOre (single source of truth, U8)', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';

    // Motoren sætter reguleretLoenOre = den kæde-opregulerede, afrundede enhedsløn (autoritativ,
    // samme værdi indkomst-linjerne viser). deltaPct er den intern afledte akkumulerede regulering.
    // Her sættes reguleretLoenOre BEVIDST til en værdi, som IKKE stemmer med basisløn × (1 + deltaPct/100),
    // så testen beviser at "Reguleret løn"-kolonnen læser reguleretLoenOre — ikke genberegner fra deltaPct.
    const segments: LoenudviklingSegment[] = [
      {
        kind: 'maaneder',
        fra: iso('2024-04-01'),
        til: iso('2024-09-30'),
        maaneder: 6,
        maanedsloenOre: 3_000_000,
        deltaPct: 0,
        amountOre: 18_000_000,
        // deltaPct-genberegning ville give 30.000,00 — den autoritative kilde siger 31.234,56.
        reguleretLoenOre: 3_123_456,
      },
    ];

    const rows = buildReguleringIndexRows({
      segments,
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-04-01'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows[0]?.reguleretLoen).toBe('31.234,56');
  });

  it.each([
    'Ingen',
    'Manuelt angivet',
    'Ferieloven',
    'Overenskomst',
  ] as const)('viser ingen SFGG-kolonner i lønreguleringstabellen når SFGG-kilde er %s', (sfggBeregningskilde) => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'bygge-anlaeg';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 15;
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: af.id,
        sfggBeregningskilde,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: 'Faglaert-Koebenhavn',
        sfggAlleredeBetaltBeloeb: asAmountValue(0),
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafFra: iso('2023-06-01'),
      tafTil: iso('2024-04-30'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.columns.filter((column) => column.includes('SFGG'))).toEqual([]);
  });

  it('splitter private indeksrækker ved 01-01-2024 selv når inputsegmentet krydser datoen', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'bygge-anlaeg';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 15;

    const rows = buildReguleringIndexRows({
      segments: [
        {
          kind: 'maaneder',
          fra: iso('2023-06-01'),
          til: iso('2024-03-31'),
          maaneder: 10,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
        {
          kind: 'maaneder',
          fra: iso('2024-04-01'),
          til: iso('2024-04-30'),
          maaneder: 1,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows.some((row) => row.fraDato === '01-01-2024')).toBe(true);
  });

  it('bevarer 01-01-2024 som særskilt indeksrække ved privat overenskomst uden tidlig dækning', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'laasesmedeoverenskomsten';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 12.5;
    af.shSoPct = 2.7;
    af.pensionPct = 8.15;

    const rows = buildReguleringIndexRows({
      segments: [
        {
          kind: 'maaneder',
          fra: iso('2017-05-01'),
          til: iso('2024-02-29'),
          maaneder: 82,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
        {
          kind: 'maaneder',
          fra: iso('2024-03-01'),
          til: iso('2024-04-30'),
          maaneder: 2,
          maanedsloenOre: 100000,
          deltaPct: 11.26,
          amountOre: 100000,
        },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2017-05-02'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows.some((row) => row.fraDato === '01-01-2024' && row.indeks !== '100,00')).toBe(true);
    expect(rows.some((row) => row.fraDato === '01-03-2024' && row.indeks !== '100,00')).toBe(true);
  });

  it('bruger samme første tabelkolonner som eo-kontrol for manuel arbejdsdagsbaseret regulering', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.feriePct = 16.95;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: toISODateString('2024-01-26'),
        grundloen: asAmountValue(177.56),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 14.37,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-01-26'),
      tafFra: iso('2024-01-26'),
      tafTil: iso('2024-10-20'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    // SH/SO og Fritvalg er undefined på alle rækker → kolonnerne vises ikke
    expect(table?.columns).toEqual(['Fra-dato', 'Timeløn', 'Feriepenge', 'Store Bededag', 'AG pens. bidrag']);
  });

  it('viser manuel procentsats med indeks og akkumuleret procent i reguleringsværdier', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    af.loenudviklingManuelProcentsatsTableData = [
      { id: 'base', dato: undefined, procent: 0 },
      { id: 'pct-2025', dato: iso('2025-01-01'), procent: 10 },
      { id: 'pct-2026', dato: iso('2026-01-01'), procent: 10 },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-07-01'),
      tafFra: iso('2024-07-01'),
      tafTil: iso('2026-12-31'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table?.columns).toEqual(['Dato', 'Procent', 'Indeks', 'Akkumuleret']);
    // Procent, Indeks og Akkumuleret vises alle fast med to decimaler (også ",00").
    expect(table?.rows).toEqual([
      ['01-07-2024', '0,00 %', '100,00', '+ 0,00 %'],
      ['01-01-2025', '10,00 %', '110,00', '+ 10,00 %'],
      ['01-01-2026', '10,00 %', '121,00', '+ 21,00 %'],
    ]);

    const rows = buildReguleringIndexRows({
      segments: [
        { kind: 'maaneder', fra: iso('2024-07-01'), til: iso('2024-12-31'), maaneder: 6, maanedsloenOre: 3000000, deltaPct: 0, amountOre: 18000000 },
        { kind: 'maaneder', fra: iso('2025-01-01'), til: iso('2025-12-31'), maaneder: 12, maanedsloenOre: 3000000, deltaPct: 10, amountOre: 39600000 },
        { kind: 'maaneder', fra: iso('2026-01-01'), til: iso('2026-12-31'), maaneder: 12, maanedsloenOre: 3000000, deltaPct: 21, amountOre: 43560000 },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-07-01'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows.map((row) => [row.fraDato, row.indeks, row.loenudvikling])).toEqual([
      ['01-07-2024', '100,00', ''],
      ['01-01-2025', '110,00', '+ 10,00 %'],
      ['01-01-2026', '121,00', '+ 21,00 %'],
    ]);
  });

  // R2 — det motor-emitterede forløb er den autoritative kilde: præsentationen skal producere
  // byte-identisk output, uanset om forløbet sendes med (PDF-kanalen) eller udelades (inspektion,
  // der re-deriverer internt). Dette pinner selve R2-koblingen for manuel procentsats.
  it('manuel procentsats: output er byte-identisk med og uden motor-emitteret forløb', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuel procentsats';
    af.loenudviklingManuelProcentsatsTableData = [
      { id: 'base', dato: undefined, procent: 0 },
      { id: 'pct-2025', dato: iso('2025-01-01'), procent: 10 },
      { id: 'pct-2026', dato: iso('2026-01-01'), procent: 10 },
    ];
    const anvendtReguleringsdato = iso('2024-07-01');
    const forloeb = {
      kind: 'manuelProcentsats' as const,
      entries: buildManuelProcentsatsEntries({
        anvendtReguleringsdato,
        rows: af.loenudviklingManuelProcentsatsTableData,
      }),
    };
    const segments: LoenudviklingSegment[] = [
      { kind: 'maaneder', fra: iso('2024-07-01'), til: iso('2024-12-31'), maaneder: 6, maanedsloenOre: 3000000, deltaPct: 0, amountOre: 18000000 },
      { kind: 'maaneder', fra: iso('2025-01-01'), til: iso('2025-12-31'), maaneder: 12, maanedsloenOre: 3000000, deltaPct: 10, amountOre: 39600000 },
      { kind: 'maaneder', fra: iso('2026-01-01'), til: iso('2026-12-31'), maaneder: 12, maanedsloenOre: 3000000, deltaPct: 21, amountOre: 43560000 },
    ];

    const vaerdierUden = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af, anvendtReguleringsdato, tafFra: iso('2024-07-01'), tafTil: iso('2026-12-31'), tafBeregningsenhed: 'Måneder',
    });
    const vaerdierMed = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af, anvendtReguleringsdato, tafFra: iso('2024-07-01'), tafTil: iso('2026-12-31'), tafBeregningsenhed: 'Måneder', forloeb,
    });
    expect(vaerdierMed).toEqual(vaerdierUden);

    const rowsUden = buildReguleringIndexRows({ segments, ansaettelsesforhold: af, anvendtReguleringsdato, tafBeregningsenhed: 'Måneder' });
    const rowsMed = buildReguleringIndexRows({ segments, ansaettelsesforhold: af, anvendtReguleringsdato, tafBeregningsenhed: 'Måneder', forloeb });
    expect(rowsMed).toEqual(rowsUden);
  });

  // R2 (KRL) — samme kobling som manuel procentsats: præsentationen skal producere byte-identisk
  // output uanset om det motor-emitterede KRL-forløb sendes med (PDF-kanalen) eller udelades
  // (inspektion, der re-deriverer via samme delte buildKrlIndexEntries).
  it('KRL: output er byte-identisk med og uden motor-emitteret forløb', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (kommuner)';
    const anvendtReguleringsdato = iso('2015-01-01');
    const forloeb = { kind: 'krl' as const, entries: buildKrlIndexEntries('KTO (kommuner)') };
    const segments: LoenudviklingSegment[] = [
      { kind: 'maaneder', fra: iso('2015-01-01'), til: iso('2016-12-31'), maaneder: 24, maanedsloenOre: 3000000, deltaPct: 0, amountOre: 72000000 },
      { kind: 'maaneder', fra: iso('2017-01-01'), til: iso('2018-12-31'), maaneder: 24, maanedsloenOre: 3000000, deltaPct: 5, amountOre: 75600000 },
    ];

    const vaerdierUden = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af, anvendtReguleringsdato, tafFra: iso('2015-01-01'), tafTil: iso('2018-12-31'), tafBeregningsenhed: 'Måneder',
    });
    const vaerdierMed = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af, anvendtReguleringsdato, tafFra: iso('2015-01-01'), tafTil: iso('2018-12-31'), tafBeregningsenhed: 'Måneder', forloeb,
    });
    expect(vaerdierMed).not.toBeNull();
    expect(vaerdierMed).toEqual(vaerdierUden);

    const rowsUden = buildReguleringIndexRows({ segments, ansaettelsesforhold: af, anvendtReguleringsdato, tafBeregningsenhed: 'Måneder' });
    const rowsMed = buildReguleringIndexRows({ segments, ansaettelsesforhold: af, anvendtReguleringsdato, tafBeregningsenhed: 'Måneder', forloeb });
    expect(rowsMed.length).toBeGreaterThan(0);
    expect(rowsMed).toEqual(rowsUden);
  });

  // R2 (Statistik) — samme kobling som manuel procentsats/KRL: præsentationen skal producere
  // byte-identisk output uanset om det motor-emitterede statistik-forløb (kvartalsserien) sendes
  // med (PDF-kanalen) eller udelades (inspektion, der re-deriverer via samme delte builder).
  it('statistik: output er byte-identisk med og uden motor-emitteret forløb', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';
    const anvendtReguleringsdato = iso('2005-01-01');
    const modelId = resolveStatistikModelId('ILON12 (Danmarks Statistik)');
    expect(modelId).toBeDefined();
    const forloeb = { kind: 'statistik' as const, entries: buildStatistikIndexEntries(modelId!) };
    const segments: LoenudviklingSegment[] = [
      { kind: 'maaneder', fra: iso('2005-01-01'), til: iso('2005-12-31'), maaneder: 12, maanedsloenOre: 3000000, deltaPct: 0, amountOre: 36000000 },
      { kind: 'maaneder', fra: iso('2006-01-01'), til: iso('2006-12-31'), maaneder: 12, maanedsloenOre: 3000000, deltaPct: 3, amountOre: 37080000 },
      { kind: 'maaneder', fra: iso('2007-01-01'), til: iso('2007-12-31'), maaneder: 12, maanedsloenOre: 3000000, deltaPct: 6, amountOre: 38160000 },
    ];

    const vaerdierUden = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af, anvendtReguleringsdato, tafFra: iso('2005-01-01'), tafTil: iso('2007-12-31'), tafBeregningsenhed: 'Måneder',
    });
    const vaerdierMed = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af, anvendtReguleringsdato, tafFra: iso('2005-01-01'), tafTil: iso('2007-12-31'), tafBeregningsenhed: 'Måneder', forloeb,
    });
    expect(vaerdierMed).not.toBeNull();
    expect(vaerdierMed).toEqual(vaerdierUden);

    const rowsUden = buildReguleringIndexRows({ segments, ansaettelsesforhold: af, anvendtReguleringsdato, tafBeregningsenhed: 'Måneder' });
    const rowsMed = buildReguleringIndexRows({ segments, ansaettelsesforhold: af, anvendtReguleringsdato, tafBeregningsenhed: 'Måneder', forloeb });
    expect(rowsMed.length).toBeGreaterThan(0);
    expect(rowsMed).toEqual(rowsUden);
  });

  // R2 (KL-lønaftaler) — reguleringsværdi-tabellen viser nu satsen fra det motor-emitterede forløb
  // (KL-periodeserien); output skal være byte-identisk med og uden forløb (inspektion re-deriverer
  // via samme delte builder). "Beregnet regulering"-tabellen læser fortsat segmentets autoritative
  // reguleretLoenOre (U8) og er dermed uafhængig af forløbet — den skal også være uændret.
  it('KL-lønaftaler: output er byte-identisk med og uden motor-emitteret forløb', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';
    const anvendtReguleringsdato = iso('2024-04-01');
    const forloeb = { kind: 'klLoenaftaler' as const, entries: buildKlLoenaftalerIndexEntries() };
    const segments: LoenudviklingSegment[] = [
      { kind: 'maaneder', fra: iso('2024-04-01'), til: iso('2024-09-30'), maaneder: 6, maanedsloenOre: 3000000, deltaPct: 0, amountOre: 18000000, reguleretLoenOre: 3000000 },
      { kind: 'maaneder', fra: iso('2024-10-01'), til: iso('2025-09-30'), maaneder: 12, maanedsloenOre: 3000000, deltaPct: 1.3, amountOre: 39468000, reguleretLoenOre: 3039000 },
    ];

    const vaerdierUden = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af, anvendtReguleringsdato, tafFra: iso('2024-04-01'), tafTil: iso('2026-12-31'), tafBeregningsenhed: 'Måneder',
    });
    const vaerdierMed = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af, anvendtReguleringsdato, tafFra: iso('2024-04-01'), tafTil: iso('2026-12-31'), tafBeregningsenhed: 'Måneder', forloeb,
    });
    expect(vaerdierMed).not.toBeNull();
    expect(vaerdierMed).toEqual(vaerdierUden);

    const rowsUden = buildReguleringIndexRows({ segments, ansaettelsesforhold: af, anvendtReguleringsdato, tafBeregningsenhed: 'Måneder' });
    const rowsMed = buildReguleringIndexRows({ segments, ansaettelsesforhold: af, anvendtReguleringsdato, tafBeregningsenhed: 'Måneder', forloeb });
    expect(rowsMed.length).toBeGreaterThan(0);
    expect(rowsMed).toEqual(rowsUden);
  });

  it('skjuler manuel Fritvalg-kolonne når alle rækker har fritvalg = 0', () => {
    // Regression: fritvalg = 0 betragtes som "ingen sats" ligesom undefined — kolonnen vises ikke
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenPaaHelligdage = 'SH-udbetaling';
    af.feriePct = 12.5;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(133.40),
        feriepenge: undefined,
        shSoSats: 12.9,
        fritvalg: 0,
        agPension: 8.15,
      },
      {
        id: 'm2',
        dato: toISODateString('2023-03-01'),
        grundloen: asAmountValue(137.90),
        feriepenge: undefined,
        shSoSats: 12.9,
        fritvalg: 0,
        agPension: 8.15,
      },
      {
        id: 'm3',
        dato: toISODateString('2023-06-01'),
        grundloen: asAmountValue(137.90),
        feriepenge: undefined,
        shSoSats: 12.9,
        fritvalg: 0,
        agPension: 10.15,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-01-01'),
      tafFra: iso('2023-01-01'),
      tafTil: iso('2023-12-31'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).not.toContain('Fritvalg');
    expect(table?.columns).toEqual(['Fra-dato', 'Timeløn', 'Feriepenge', 'SH/SO', 'AG pens. bidrag']);
  });

  it('skjuler manuel SH/SO-kolonne når alle rækker har shSoSats = undefined, men viser Fritvalg-kolonne når mindst én række har fritvalg > 0', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenPaaHelligdage = 'SH-udbetaling';
    af.feriePct = 12.5;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(133.40),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: 0,
        agPension: 8.15,
      },
      {
        id: 'm2',
        dato: toISODateString('2023-06-01'),
        grundloen: asAmountValue(137.90),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: 5,
        agPension: 10.15,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-01-01'),
      tafFra: iso('2023-01-01'),
      tafTil: iso('2023-12-31'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).not.toContain('SH/SO');
    expect(table?.columns).toContain('Fritvalg');
    expect(table?.columns).toEqual(['Fra-dato', 'Timeløn', 'Feriepenge', 'Fritvalg', 'AG pens. bidrag']);
  });

  it('indsætter Store Bededag som separat række 01-01-2024 i manuel reguleringsværdier-tabel', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 15;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(25174),
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: 7.00,
        agPension: 9.00,
      },
      {
        id: 'm2',
        dato: toISODateString('2024-03-01'),
        grundloen: asAmountValue(25174),
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: 9.00,
        agPension: 11.00,
      },
      {
        id: 'm3',
        dato: toISODateString('2024-04-01'),
        grundloen: asAmountValue(25895),
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: 9.00,
        agPension: 11.00,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafFra: iso('2023-06-01'),
      tafTil: iso('2026-02-04'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).toContain('Store Bededag');
    // SH/SO er undefined → kolonne vises ikke; Store Bededag er nu index 4 (Fra-dato, Timeløn, Feriepenge, Fritvalg, Store Bededag, AG pens. bidrag)
    expect(table?.rows.some((row) => row[0] === '01-01-2024' && row[4] === '0,45 %')).toBe(true);
  });

  it('viser Store Bededag i manuelle reguleringsværdier når TAF starter efter 01-01-2024 men reguleringsdatoen ligger før', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 16.95;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(177.56),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 14.37,
      },
      {
        id: 'm2',
        dato: toISODateString('2024-04-01'),
        grundloen: asAmountValue(184.66),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 14.37,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-12-31'),
      tafFra: iso('2024-01-26'),
      tafTil: iso('2024-10-20'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).toContain('Store Bededag');
    // SH/SO og Fritvalg er undefined på alle rækker → kolonner vises ikke
    expect(table?.rows.find((row) => row[0] === '31-12-2023')).toEqual([
      '31-12-2023',
      '177,56',
      '16,95 %',
      '0 %',
      '14,37 %',
    ]);
  });

  it('beregner manuel indeksrække med Store Bededag når TAF starter efter 01-01-2024 men reguleringsdatoen ligger før', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 16.95;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(177.56),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 14.37,
      },
      {
        id: 'm2',
        dato: toISODateString('2024-04-01'),
        grundloen: asAmountValue(184.66),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 14.37,
      },
    ];

    const rows = buildReguleringIndexRows({
      segments: [
        {
          kind: 'arbejdsdage',
          fra: iso('2024-01-26'),
          til: iso('2024-03-31'),
          arbejdsdage: 10,
          dagsloenOre: 0,
          deltaPct: 0,
          amountOre: 0,
        },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-12-31'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.indeks).toBe('100,38');
  });

  it('bevarer en særskilt række på manuel reguleringsdato i kronologien selv når værdierne er uændrede', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.feriePct = 16.95;
    af.saerligFraDatoRegulering = iso('2024-01-26');
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(138.15),
        feriepenge: undefined,
        shSoSats: 12.90,
        fritvalg: undefined,
        agPension: 10.15,
      },
      {
        id: 'm2',
        dato: toISODateString('2024-03-01'),
        grundloen: asAmountValue(142.65),
        feriepenge: undefined,
        shSoSats: 14.70,
        fritvalg: undefined,
        agPension: 10.15,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-01-26'),
      tafFra: iso('2024-02-01'),
      tafTil: iso('2025-02-01'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.map((row) => row[0])).toEqual(['26-01-2024', '01-03-2024']);
  });

  it('viser basisrækken på reference-datoen — rækker dateret før reguleringsdatoen ignoreres', () => {
    // 2026-07-02 (brugerbeslutning): rækker med dato før den anvendte reguleringsdato indgår ikke
    // i reguleringen (de udløser en advarsel i række-evalueringen). Basis er altid basisrækken —
    // spejler buildLoenudviklingFromManual i motoren.
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.feriePct = 16.95;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 10.00,
      },
      {
        id: 'm2',
        dato: toISODateString('2023-06-01'),
        grundloen: asAmountValue(125),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 12.00,
      },
      {
        id: 'm3',
        dato: toISODateString('2024-02-01'),
        grundloen: asAmountValue(150),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 15.00,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-12-31'),
      tafFra: iso('2024-01-26'),
      tafTil: iso('2024-03-31'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    // SH/SO og Fritvalg er undefined på alle rækker → kolonner vises ikke
    // loenPaaHelligdage defaulter til 'Almindelig løn' → Store Bededag-kolonne vises
    // Rækken pr. 2023-06-01 (før reguleringsdatoen 31-12-2023) ignoreres → basisrækkens værdier.
    expect(table?.rows.find((row) => row[0] === '31-12-2023')).toEqual([
      '31-12-2023',
      '100,00',
      '16,95 %',
      '0 %',
      '10,00 %',
    ]);
  });

  it('medtager manuel sats-startdato lige før tafFra når perioden fortsat er gældende i taf-intervallet', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 15;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(28811.5),
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 10.00,
      },
      {
        id: 'm2',
        dato: toISODateString('2025-03-01'),
        grundloen: asAmountValue(29613.15),
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 10.00,
      },
      {
        id: 'm3',
        dato: toISODateString('2025-05-01'),
        grundloen: asAmountValue(29613.15),
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: 12.00,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2025-02-28'),
      tafFra: iso('2025-04-01'),
      tafTil: iso('2026-02-28'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.map((row) => row[0])).toEqual(['28-02-2025', '01-03-2025', '01-05-2025']);
  });

  it('viser kun reguleringsdato-rækken når den eneste ændringsrække ligger før reguleringsdatoen', () => {
    // 2026-07-02 (brugerbeslutning): rækken pr. 10-01-2024 (før den særskilte reguleringsdato
    // 26-01-2024) ignoreres i beregning og visning; reguleringsdato-rækken bærer basisrækkens værdier.
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.feriePct = 16.95;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'm2',
        dato: toISODateString('2024-01-10'),
        grundloen: asAmountValue(110),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-01-26'),
      tafFra: iso('2024-01-02'),
      tafTil: iso('2024-03-31'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.map((row) => row[0])).toEqual(['26-01-2024']);
  });

  it('overskriver ikke en eksplicit manuel række på reguleringsdatoen med første manuelle række', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.feriePct = 16.95;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(100),
        feriepenge: undefined,
        shSoSats: 10.00,
        fritvalg: undefined,
        agPension: 10.00,
      },
      {
        id: 'm2',
        dato: toISODateString('2024-02-15'),
        grundloen: asAmountValue(200),
        feriepenge: undefined,
        shSoSats: 20.00,
        fritvalg: undefined,
        agPension: 20.00,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-02-15'),
      tafFra: iso('2024-02-01'),
      tafTil: iso('2024-03-31'),
      tafBeregningsenhed: 'Arbejdsdage',
    });

    expect(table).not.toBeNull();
    // Fritvalg er undefined på alle rækker → kolonne vises ikke
    expect(table?.rows.find((row) => row[0] === '15-02-2024')).toEqual([
      '15-02-2024',
      '200,00',
      '16,95 %',
      '20,00 %',
      '0,45 %',
      '20,00 %',
    ]);
  });

  it('splitter manuelle indeksrækker ved 01-01-2024 selv når næste manuelle række er 01-03-2024', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenPaaHelligdage = 'Almindelig løn';
    af.feriePct = 15;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(25174),
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: 7.00,
        agPension: 9.00,
      },
      {
        id: 'm2',
        dato: toISODateString('2024-03-01'),
        grundloen: asAmountValue(25174),
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: 9.00,
        agPension: 11.00,
      },
      {
        id: 'm3',
        dato: toISODateString('2024-04-01'),
        grundloen: asAmountValue(25895),
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: 9.00,
        agPension: 11.00,
      },
    ];

    const rows = buildReguleringIndexRows({
      segments: [
        {
          kind: 'maaneder',
          fra: iso('2023-06-01'),
          til: iso('2023-12-31'),
          maaneder: 7,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
        {
          kind: 'maaneder',
          fra: iso('2024-01-01'),
          til: iso('2024-02-29'),
          maaneder: 2,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
        {
          kind: 'maaneder',
          fra: iso('2024-03-01'),
          til: iso('2024-03-31'),
          maaneder: 1,
          maanedsloenOre: 100000,
          deltaPct: 0,
          amountOre: 100000,
        },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows.some((row) => row.fraDato === '01-01-2024')).toBe(true);
  });

  it('bruger basisrækken som indeksbasis — rækker dateret før reguleringsdatoen ignoreres', () => {
    // 2026-07-02 (brugerbeslutning): rækken pr. 2024-04-01 (før reguleringsdatoen 2024-05-01)
    // indgår ikke; indeksbasis er basisrækken (100), og rækken pr. 2024-06-01 giver indeks 120.
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: undefined,
        grundloen: asAmountValue(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'm2',
        dato: toISODateString('2024-04-01'),
        grundloen: asAmountValue(110),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'm3',
        dato: toISODateString('2024-06-01'),
        grundloen: asAmountValue(120),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildReguleringIndexRows({
      segments: [
        { kind: 'maaneder', fra: iso('2024-05-01'), til: iso('2024-05-31'), maaneder: 1, maanedsloenOre: 0, deltaPct: 0, amountOre: 0 },
        { kind: 'maaneder', fra: iso('2024-06-01'), til: iso('2024-06-30'), maaneder: 1, maanedsloenOre: 0, deltaPct: 0, amountOre: 0 },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2024-05-01'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.indeks).toBe('100,00');
    expect(rows[1]?.indeks).toBe('120,00');
  });

  it('sammenklapper uændrede manuelle reguleringsværdier til én periode i første tabel', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      {
        id: 'manuel-1',
        dato: undefined,
        grundloen: asAmountValue(141.24),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-2',
        dato: toISODateString('2020-04-01'),
        grundloen: asAmountValue(141.78),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-3',
        dato: toISODateString('2020-10-01'),
        grundloen: asAmountValue(142.85),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-4',
        dato: toISODateString('2021-04-01'),
        grundloen: asAmountValue(144.28),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-5',
        dato: toISODateString('2021-10-01'),
        grundloen: asAmountValue(145.69),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-6',
        dato: toISODateString('2022-04-01'),
        grundloen: asAmountValue(145.69),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2020-01-01'),
      tafFra: iso('2020-01-01'),
      tafTil: iso('2022-09-30'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.map((row) => row[0])).toEqual([
      '01-01-2020',
      '01-04-2020',
      '01-10-2020',
      '01-04-2021',
      '01-10-2021',
    ]);
  });

  it('forlænger indeksperioder når manuel regulering ikke ændrer beregningen', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      {
        id: 'manuel-7',
        dato: undefined,
        grundloen: asAmountValue(141.2411),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-8',
        dato: toISODateString('2020-04-01'),
        grundloen: asAmountValue(141.7798),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-9',
        dato: toISODateString('2020-10-01'),
        grundloen: asAmountValue(142.8511),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-10',
        dato: toISODateString('2021-04-01'),
        grundloen: asAmountValue(144.2796),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-11',
        dato: toISODateString('2021-10-01'),
        grundloen: asAmountValue(145.6933),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-12',
        dato: toISODateString('2022-04-01'),
        grundloen: asAmountValue(145.6933),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-13',
        dato: toISODateString('2022-10-01'),
        grundloen: asAmountValue(149.4018),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
      {
        id: 'manuel-14',
        dato: toISODateString('2023-01-01'),
        grundloen: asAmountValue(149.4018),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildReguleringIndexRows({
      segments: [
        { kind: 'maaneder', fra: iso('2020-04-01'), til: iso('2020-09-30'), maaneder: 6, maanedsloenOre: 0, deltaPct: 0, amountOre: 0 },
        { kind: 'maaneder', fra: iso('2020-10-01'), til: iso('2021-03-31'), maaneder: 6, maanedsloenOre: 0, deltaPct: 0, amountOre: 0 },
        { kind: 'maaneder', fra: iso('2021-04-01'), til: iso('2021-09-30'), maaneder: 6, maanedsloenOre: 0, deltaPct: 0, amountOre: 0 },
        { kind: 'maaneder', fra: iso('2021-10-01'), til: iso('2022-03-31'), maaneder: 6, maanedsloenOre: 0, deltaPct: 0, amountOre: 0 },
        { kind: 'maaneder', fra: iso('2022-04-01'), til: iso('2022-09-30'), maaneder: 6, maanedsloenOre: 0, deltaPct: 0, amountOre: 0 },
        { kind: 'maaneder', fra: iso('2022-10-01'), til: iso('2022-12-31'), maaneder: 3, maanedsloenOre: 0, deltaPct: 0, amountOre: 0 },
        { kind: 'maaneder', fra: iso('2023-01-01'), til: iso('2023-03-31'), maaneder: 3, maanedsloenOre: 0, deltaPct: 0, amountOre: 0 },
      ],
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2020-01-01'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(rows.map((row) => [row.fraDato, row.tilDato])).toEqual([
      ['01-04-2020', '30-09-2020'],
      ['01-10-2020', '31-03-2021'],
      ['01-04-2021', '30-09-2021'],
      ['01-10-2021', '30-09-2022'],
      ['01-10-2022', '31-03-2023'],
    ]);
  });

  it('viser tidligste kendte statistik-periode uden reguleringsdato-række og sætter note', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2000-01-01'),
      tafFra: iso('2000-01-01'),
      tafTil: iso('2006-12-31'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    // Ingen syntetisk streg-række på reguleringsdatoen; første række er den tidligste kendte periode.
    expect(table?.rows[0]).toEqual(['2005K1', '01-01-2005', '100,0']);
    expect(table?.tidligsteSatsGaelderFra).toBe(iso('2005-01-01'));
  });

  it('viser tidligste kendte KRL-sats uden reguleringsdato-række og sætter note', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (kommuner)';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2000-01-01'),
      tafFra: iso('2000-01-01'),
      tafTil: iso('2002-12-31'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    // Ingen syntetisk streg-række på reguleringsdatoen; første række er den tidligste kendte sats.
    expect(table?.rows[0]).toEqual(['01-04-2001', '4,0662 %']);
    expect(table?.tidligsteSatsGaelderFra).toBe(iso('2001-04-01'));
  });

  it('sætter IKKE note når KRL-kilden har satser før reguleringsdatoen, selv om TAF starter senere (regression)', () => {
    // Fejlen: reguleringsdato 01-01-2020 (KTO kommuner har satser her + tilbage til 2001), men
    // TAF-perioden starter i Q2/Q3 2020. Den TAF-scopede første række blev 01-04-2020 og udløste
    // fejlagtigt noten "ingen satser før 01-04-2020". Note skal nu være undefined.
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (kommuner)';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2020-01-01'),
      tafFra: iso('2020-06-01'),
      tafTil: iso('2021-12-31'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    // Tabellen viser stadig den TAF-relevante første række (satsen der gælder ved TAF-start).
    expect(table?.rows[0]?.[0]).toBe('01-04-2020');
    // Men noten fyrer IKKE, fordi kilden har satser længe før reguleringsdatoen.
    expect(table?.tidligsteSatsGaelderFra).toBeUndefined();
  });

  it('sætter note til kildens uscopede coverage-start (KRL regioner starter reelt 01-10-2018)', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (regioner)';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2015-01-01'),
      tafFra: iso('2015-01-01'),
      tafTil: iso('2020-12-31'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    // Kilden har reelt ingen satser før 01-10-2018 → note og første række begge = 01-10-2018.
    const note = table?.tidligsteSatsGaelderFra;
    expect(table?.rows[0]?.[0]).toBe('01-10-2018');
    expect(note).toBe(iso('2018-10-01'));
    // Invariant: noten (når sat) er aldrig senere end tabellens første viste række.
    expect(Boolean(note && note <= iso('2018-10-01'))).toBe(true);
  });

  it('tilføjer ingen særskilt række på reguleringsdatoen når en KRL-sats allerede gælder', () => {
    // Tidligere blev reguleringsdatoen injiceret som en ekstra række (også ved uændret sats). Nu viser
    // tabellen kun de faktiske KRL-satser; reguleringsdatoen 15-04-2001 ligger inden for 01-04-2001-satsen.
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (kommuner)';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2001-04-15'),
      tafFra: iso('2001-05-15'),
      tafTil: iso('2001-05-15'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows.map((row) => row[0])).toEqual(['01-04-2001']);
    // Sats findes på/før reguleringsdatoen → ingen note.
    expect(table?.tidligsteSatsGaelderFra).toBeUndefined();
  });

  it('finder senest gældende sats ved single-day TAF uden eksakt satsdato', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    af.loenudviklingKRLSatstabel = 'KTO (kommuner)';

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: undefined,
      tafFra: iso('2001-05-15'),
      tafTil: iso('2001-05-15'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows).toEqual([['01-04-2001', '4,0662 %']]);
  });
});
