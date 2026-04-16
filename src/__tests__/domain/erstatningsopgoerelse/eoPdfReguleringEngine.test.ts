import { buildReguleringsvaerdierTableData, buildReguleringIndexRows } from '../../../domain/erstatningsopgoerelse/pdf/eoPdfRegulering';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
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

describe('eoPdfReguleringEngine', () => {
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
    expect(table?.rows[0]).toEqual(['01-01-2020', '-', '-', '-']);
    // 01-03-2024 er første satsdato i laasesmedeoverenskomsten i testdata.
    // Hvis datagrundlaget ændres historisk, skal denne forventning opdateres.
    expect(table?.rows[1]?.[0]).toBe('01-03-2024');
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

  it('bevarer en særskilt række på reguleringsdatoen i privat reguleringsværdier-tabel selv når næste sats er uændret', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'bygge-anlaeg';
    af.loenPaaHelligdage = 'SH/SO udbetales';
    af.feriePct = 15;

    const table = buildReguleringsvaerdierTableData({
      ansaettelsesforhold: af,
      anvendtReguleringsdato: iso('2023-05-24'),
      tafFra: iso('2023-06-01'),
      tafTil: iso('2024-04-30'),
      tafBeregningsenhed: 'Måneder',
    });

    expect(table).not.toBeNull();
    expect(table?.rows[0]?.[0]).toBe('24-05-2023');
  });

  it('bevarer kolonneantal i privat reguleringsværdier-tabel når reguleringsdato ligger før tafFra', () => {
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
    expect(table?.rows[0]?.[0]).toBe('24-05-2023');
    expect(table?.rows.every((row) => row.length === table.columns.length)).toBe(true);
  });

  it('indsætter ikke 01-01-2024 som separat række i privat lønreguleringstabel når datoen kun vedrører SFGG', () => {
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
    expect(table?.rows.some((row) => row[0] === '01-01-2024')).toBe(false);
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
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: 'Faglaert-Koebenhavn',
        sfggAlleredeBetaltBeloeb: '0,00',
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

  it('bruger samme første tabelkolonner som eodebug for manuel arbejdsdagsbaseret regulering', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.feriePct = 16.95;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: '26-01-2024',
        grundloen: asAmountValue(177.56),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '14,37',
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
    expect(table?.columns).toEqual(['Fra-dato', 'Timeløn', 'Feriepenge', 'SH/SO', 'Fritvalg', 'Store Bededag', 'AG pens. bidrag']);
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
        dato: '',
        grundloen: asAmountValue(25174),
        feriepenge: '15,00',
        shSoSats: '',
        fritvalg: '7,00',
        agPension: '9,00',
      },
      {
        id: 'm2',
        dato: '01-03-2024',
        grundloen: asAmountValue(25174),
        feriepenge: '15,00',
        shSoSats: '',
        fritvalg: '9,00',
        agPension: '11,00',
      },
      {
        id: 'm3',
        dato: '01-04-2024',
        grundloen: asAmountValue(25895),
        feriepenge: '15,00',
        shSoSats: '',
        fritvalg: '9,00',
        agPension: '11,00',
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
    expect(table?.rows.some((row) => row[0] === '01-01-2024' && row[5] === '0,45 %')).toBe(true);
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
        dato: '',
        grundloen: asAmountValue(177.56),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '14,37',
      },
      {
        id: 'm2',
        dato: '01-04-2024',
        grundloen: asAmountValue(184.66),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '14,37',
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
    expect(table?.rows.find((row) => row[0] === '31-12-2023')).toEqual([
      '31-12-2023',
      '177,56',
      '16,95 %',
      '-',
      '-',
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
        dato: '',
        grundloen: asAmountValue(177.56),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '14,37',
      },
      {
        id: 'm2',
        dato: '01-04-2024',
        grundloen: asAmountValue(184.66),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '14,37',
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
        dato: '',
        grundloen: asAmountValue(138.15),
        feriepenge: '',
        shSoSats: '12,90',
        fritvalg: '',
        agPension: '10,15',
      },
      {
        id: 'm2',
        dato: '01-03-2024',
        grundloen: asAmountValue(142.65),
        feriepenge: '',
        shSoSats: '14,70',
        fritvalg: '',
        agPension: '10,15',
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
        dato: '',
        grundloen: asAmountValue(100),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '10,00',
      },
      {
        id: 'm2',
        dato: '01-06-2023',
        grundloen: asAmountValue(125),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '12,00',
      },
      {
        id: 'm3',
        dato: '01-02-2024',
        grundloen: asAmountValue(150),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '15,00',
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
    expect(table?.rows.find((row) => row[0] === '31-12-2023')).toEqual([
      '31-12-2023',
      '125,00',
      '16,95 %',
      '-',
      '-',
      '0 %',
      '12,00 %',
    ]);
  });

  it('bevarer manuel reference-række når brugeren har angivet en særskilt reguleringsdato med identiske værdier', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.feriePct = 16.95;
    af.loenudviklingManuelTableData = [
      {
        id: 'm1',
        dato: '',
        grundloen: asAmountValue(100),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        id: 'm2',
        dato: '10-01-2024',
        grundloen: asAmountValue(110),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
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
        dato: '',
        grundloen: asAmountValue(100),
        feriepenge: '',
        shSoSats: '10,00',
        fritvalg: '',
        agPension: '10,00',
      },
      {
        id: 'm2',
        dato: '15-02-2024',
        grundloen: asAmountValue(200),
        feriepenge: '',
        shSoSats: '20,00',
        fritvalg: '',
        agPension: '20,00',
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
    expect(table?.rows.find((row) => row[0] === '15-02-2024')).toEqual([
      '15-02-2024',
      '200,00',
      '16,95 %',
      '20,00 %',
      '-',
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
        dato: '',
        grundloen: asAmountValue(25174),
        feriepenge: '15,00',
        shSoSats: '',
        fritvalg: '7,00',
        agPension: '9,00',
      },
      {
        id: 'm2',
        dato: '01-03-2024',
        grundloen: asAmountValue(25174),
        feriepenge: '15,00',
        shSoSats: '',
        fritvalg: '9,00',
        agPension: '11,00',
      },
      {
        id: 'm3',
        dato: '01-04-2024',
        grundloen: asAmountValue(25895),
        feriepenge: '15,00',
        shSoSats: '',
        fritvalg: '9,00',
        agPension: '11,00',
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
        dato: '',
        grundloen: asAmountValue(100),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        id: 'm2',
        dato: '01-04-2024',
        grundloen: asAmountValue(110),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        id: 'm3',
        dato: '01-06-2024',
        grundloen: asAmountValue(120),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
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
        dato: '',
        grundloen: asAmountValue(141.24),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-04-2020',
        grundloen: asAmountValue(141.78),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-10-2020',
        grundloen: asAmountValue(142.85),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-04-2021',
        grundloen: asAmountValue(144.28),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-10-2021',
        grundloen: asAmountValue(145.69),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-04-2022',
        grundloen: asAmountValue(145.69),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
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
        dato: '',
        grundloen: asAmountValue(141.2411),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-04-2020',
        grundloen: asAmountValue(141.7798),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-10-2020',
        grundloen: asAmountValue(142.8511),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-04-2021',
        grundloen: asAmountValue(144.2796),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-10-2021',
        grundloen: asAmountValue(145.6933),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-04-2022',
        grundloen: asAmountValue(145.6933),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-10-2022',
        grundloen: asAmountValue(149.4018),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
      {
        dato: '01-01-2023',
        grundloen: asAmountValue(149.4018),
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
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
