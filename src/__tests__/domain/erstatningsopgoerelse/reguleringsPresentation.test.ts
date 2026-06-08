import {
  buildReguleringsvaerdierTableData,
  buildReguleringIndexRows,
  resolveAnvendtReguleringsdato as resolvePdfAnvendtReguleringsdato,
  resolveLoenSkadedatoText,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';
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

  it('viser reference-række før første tilgængelige overenskomstdato ved manglende tidlig dækning', () => {
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
    // Referencerækken: placeholder for datoen før første overenskomstdækning.
    // Kolonnerne bestemmes af laasesmedeoverenskomstens satser (Timeløn, Fritvalg, Store Bededag, AG pens. bidrag).
    // SH/SO vises ikke fordi laasesmedeoverenskomsten har shSoSats = 0 i alle perioder.
    // Hvis overenskomstdata ændres, skal denne forventning opdateres.
    expect(table?.rows[0]).toEqual(['01-01-2020', '-', '-', '0 %', '-']);
    expect(table?.rows.some((row) => row[0] === '01-01-2024')).toBe(true);
    // 01-03-2024 er fortsat første egentlige overenskomstsatsdato i testdata.
    expect(table?.rows.some((row) => row[0] === '01-03-2024')).toBe(true);
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
      tafBeregningsenhed: 'Timer',
    });

    expect(table).not.toBeNull();
    expect(table?.columns).not.toContain('Fritvalg');
    expect(table?.columns).toContain('SH/SO');
    expect(table?.columns).toContain('AG pens. bidrag');
  });

  it('viser indtastede satser på reference-række før første private overenskomstdækning', () => {
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
    expect(table?.rows[0]).toEqual(['01-01-2020', '-', '12,5 %', '2,7 %', '-', '0 %', '8,15 %']);
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

  it('bruger samme første tabelkolonner som eodebug for manuel arbejdsdagsbaseret regulering', () => {
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

  it('viser senest gældende manuel ændringsrække på reference-dato før tafFra', () => {
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
    expect(table?.rows.find((row) => row[0] === '31-12-2023')).toEqual([
      '31-12-2023',
      '125,00',
      '16,95 %',
      '0 %',
      '12,00 %',
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

  it('bevarer manuel reference-række når brugeren har angivet en særskilt reguleringsdato med identiske værdier', () => {
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
    expect(table?.rows.map((row) => row[0])).toEqual(['10-01-2024', '26-01-2024']);
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

  it('bruger den senest gældende manuelle række som indeksbasis og periodebasis efter en tidligere manuel ændringsdato', () => {
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
    expect(rows[1]?.indeks).toBe('109,09');
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

  it('viser statistik-reference før første kendte periode og derefter første reelle række', () => {
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
    expect(table?.rows[0]).toEqual(['-', '01-01-2000', '-']);
    expect(table?.rows[1]?.[0]).toBe('2005K1');
  });

  it('viser KRL-reference før første kendte periode og derefter første reelle række', () => {
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
    expect(table?.rows[0]).toEqual(['01-01-2000', '-']);
    expect(table?.rows[1]?.[0]).toBe('01-04-2001');
  });

  it('bevarer en særskilt KRL-række på reguleringsdatoen selv når reguleringsprocenten er uændret', () => {
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
    expect(table?.rows.map((row) => row[0])).toEqual(['01-04-2001', '15-04-2001']);
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
