import { buildEODebugSygeferiegodtgoerelseRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import * as eoPdfLoenudviklingModule from '../../../domain/erstatningsopgoerelse/eoPdfLoenudvikling';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

const createValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: [
    {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      navnPaaArbejdssted: 'Arbejdssted 1',
    },
  ],
});

describe('buildEODebugSygeferiegodtgoerelseRows', () => {
  it('viser en almindelig fejl-række når beregningsgrundlag ikke er valgt', () => {
    const values = createValues();
    values.sfggAnsaettelsesforhold = [];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual([
      {
        id: `sfgg.beregningskilde.${values.loenindkomstAnsaettelsesforhold[0].id}`,
        label: 'Sygeferiegodtgørelse beregnes ud fra',
        displayValue: 'Intet valgt',
        status: 'error',
        message: 'Intet valgt',
      },
    ]);
  });

  it('viser bemærkning og fejl på satsvalg ved differentieret direkte SFGG-sats', () => {
    const values = createValues();
    values.periodeTilBeregningFra = '2014-06-01';
    values.periodeTilBeregningTil = '2014-06-30';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'bygningsoverenskomsten',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        manuelDagssats: undefined,
        manuelBeloebIHenholdTil: undefined,
        manuelFoerstEfterSygeloen: 'Nej',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: undefined,
        satsvalg: undefined,
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    const buildLoenudviklingModelSpy = vi.spyOn(eoPdfLoenudviklingModule, 'buildLoenudviklingModel');

    try {
      const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
        journalnr: undefined,
        skadestype: 'Arbejdsulykke',
        skadesdato: '2014-12-31',
      });

      expect(buildLoenudviklingModelSpy).not.toHaveBeenCalled();
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `sfgg.bemaerkningFoer2015.${values.loenindkomstAnsaettelsesforhold[0].id}`,
            label: 'Bemærk',
            displayValue: expect.stringContaining('samtlige TAF-perioder er indtastet ovenfor'),
            status: 'ok',
          }),
          expect.objectContaining({
            id: `sfgg.satsvalg.${values.loenindkomstAnsaettelsesforhold[0].id}`,
            label: 'Uddannelse og arbejdssted',
            displayValue: 'Intet valgt',
            status: 'error',
            message: 'Intet valgt',
          }),
        ])
      );
      expect(rows).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `sfgg.overenskomstensReferenceperiode.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          }),
        ])
      );
    } finally {
      buildLoenudviklingModelSpy.mockRestore();
    }
  });

  it('viser valgt overenskomstnavn som separat debug-række ved overenskomstbaseret SFGG', () => {
    const values = createValues();
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: 0,
        alleredeBetaltBeloeb: '0,00',
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.overenskomst.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Overenskomst (angivet ovenfor)',
          displayValue: 'Bygge-/anlægsoverenskomsten',
          status: 'ok',
        }),
      ])
    );
  });

  it('viser overenskomstens referenceperiode som separat debug-række ved overenskomstbaseret SFGG', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      feriePct: 12.5,
      fritvalgPct: 5,
      shSoPct: 4,
      storeBededagPct: 1,
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 10000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: '2023-12-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 0,
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-01-15',
        til: '2024-01-15',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.beregningskilde.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Sygeferiegodtgørelse beregnes ud fra',
          displayValue: 'Overenskomst',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.overenskomstensReferenceperiode.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Overenskomstens referenceperiode',
          displayValue: 'Følger ferieloven (4 uger)',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.foerstEfterSygeloen.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Først sygeferiegodtgørelse efter ophør af sygeløn',
          displayValue: 'Nej',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.referenceperiodeantal.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Antal arbejdsdage (21 hverdage - 2 SH-dage) =',
          displayValue: '19 arbejdsdage',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.referencesats.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Referencesats (10.000,00 x 12,5 % / 19 arbejdsdage) =',
          displayValue: '65,79 kr./arbejdsdag',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.eftertabel.feriepengeHvisIkkeSkade.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Feriepenge, hvis skaden ikke var sket',
          displayValue: '65,79',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.eftertabel.feriepengeModtaget.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Feriepenge modtaget i perioden',
          displayValue: '0,00',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.eftertabel.alleredeBetalt.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Allerede betalt sygeferiegodtgørelse i perioden',
          displayValue: '0,00',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.eftertabel.beregnet.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Beregnet sygeferiegodtgørelse',
          displayValue: '65,79',
          status: 'ok',
        }),
      ])
    );
  });

  it('viser fejl på beregningskilden når overenskomst-ID ikke kan slås op', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'ukendt-overenskomst-id',
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: 0,
        alleredeBetaltBeloeb: '0,00',
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.beregningskilde.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          displayValue: 'Overenskomst',
          status: 'error',
          message: 'Ukendt overenskomst-ID',
        }),
      ])
    );
  });

  it('viser fejl-række når overenskomst ikke er valgt ovenfor og skjuler efterfølgende SFGG-rækker', () => {
    const values = createValues();
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: false,
      overenskomstId: undefined,
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: '2023-12-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 0,
        alleredeBetaltBeloeb: '0,00',
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.beregningskilde.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          displayValue: 'Overenskomst',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.overenskomst.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Overenskomst (angivet ovenfor)',
          displayValue: 'Ingen overenskomst valgt',
          status: 'error',
          message: 'Ingen overenskomst valgt',
        }),
      ])
    );
    expect(rows.find((row) => row.id === `sfgg.foerstEfterSygeloen.${values.loenindkomstAnsaettelsesforhold[0].id}`)).toBeUndefined();
    expect(rows.find((row) => row.id === `sfgg.referenceperiode.${values.loenindkomstAnsaettelsesforhold[0].id}`)).toBeUndefined();
    expect(rows.find((row) => row.id === `sfgg.referencesats.${values.loenindkomstAnsaettelsesforhold[0].id}`)).toBeUndefined();
  });

  it('viser dagssats-fejl ved manuelt angivet SFGG uden dagssats', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Manuelt angivet',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: 0,
        manuelDagssats: undefined,
        manuelFoerstEfterSygeloen: 'Nej',
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-01-15',
        til: '2024-01-15',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.dagssats.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Dagssats',
          status: 'error',
          message: 'Dagssats mangler',
        }),
      ])
    );
  });

  it('viser dagssats-fejl også uden TAF-perioder når manuel dagssats mangler', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Manuelt angivet',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: 0,
        manuelDagssats: undefined,
        manuelFoerstEfterSygeloen: 'Nej',
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.dagssats.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Dagssats',
          status: 'error',
          message: 'Dagssats mangler',
        }),
      ])
    );
  });

  it('viser Ja når manuelt angivet SFGG først beregnes efter ophør af sygeløn', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 10000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Manuelt angivet',
        referenceperiodeFra: '2023-12-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 0,
        manuelDagssats: { kind: 'number', value: 100 },
        manuelFoerstEfterSygeloen: 'Ja',
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-01-15',
        til: '2024-01-15',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.foerstEfterSygeloen.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Først sygeferiegodtgørelse efter ophør af sygeløn',
          displayValue: 'Ja',
          status: 'ok',
        }),
      ])
    );
    expect(rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Forklaring',
          displayValue: 'Der beregnes først sygeferiegodtgørelse efter ophør af arbejdsgiverbetalt sygeløn.',
        }),
      ])
    );
  });

  it('viser referencesatsen med kr./dag når TAF beregnes som måneder', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet månedsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 10000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Ferieloven',
        referenceperiodeFra: '2023-12-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 1,
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-01-15',
        til: '2024-01-15',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.referenceperiodeantal.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Antal hverdage i perioden (21 hverdage - 1 fraværsdage u. løn) =',
          displayValue: '20 hverdage',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.referencesats.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Referencesats (10.000,00 x 12,5 % / 20 hverdage) =',
          displayValue: '62,50 kr./dag',
          status: 'ok',
        }),
      ])
    );
  });

  it('viser reguleringsindeks i SFGG-tabellen ved overenskomstbaseret referencesats og splitter ved reguleringsdato', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 10000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: '2023-12-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 0,
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-02-26',
        til: '2024-03-05',
        loseFeriedage: undefined,
      },
    ];
    const buildLoenudviklingModelSpy = vi
      .spyOn(eoPdfLoenudviklingModule, 'buildLoenudviklingModel')
      .mockImplementation(() => ({
        loenudviklingLabel: 'Overenskomst',
        loenudviklingTotal: { status: 'ok', value: 0 },
        beregnedeSegmenter: [],
        perAnsaettelse: [
          {
            ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
            loenudviklingLabel: 'Overenskomst',
            loenudviklingTotal: { status: 'ok', value: 0 },
            beregnedeSegmenter: [
              {
                kind: 'arbejdsdage',
                fra: '2024-02-26',
                til: '2024-02-29',
                arbejdsdage: 4,
                dagsloenOre: 0,
                deltaPct: 0,
                amountOre: 0,
              },
              {
                kind: 'arbejdsdage',
                fra: '2024-03-01',
                til: '2024-03-05',
                arbejdsdage: 3,
                dagsloenOre: 0,
                deltaPct: 5.03,
                amountOre: 0,
              },
            ],
          },
        ],
      }));

    try {
      const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
        journalnr: undefined,
        skadestype: 'Arbejdsulykke',
        skadesdato: '2024-01-01',
      });

      const tableRow = rows.find((row) => row.id === `sfgg.tabel.${values.loenindkomstAnsaettelsesforhold[0].id}`);
      expect(tableRow).toEqual(
        expect.objectContaining({
          id: `sfgg.tabel.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'SFGG-beregning',
          status: 'ok',
        })
      );
      expect(tableRow?.displayValue).toContain('Fra-dato | Til-dato | Indeks | Sats | Antal arbejdsdage | Feriepengekrav');
      expect(tableRow?.displayValue).toContain('26-02-2024 | 29-02-2024 | 100,00 | 65,79 |');
      expect(tableRow?.displayValue).toContain('01-03-2024 | 05-03-2024 | 105,03 | 69,10 |');
      expect(tableRow?.displayValue).toContain('I alt |  |  |  |  | ');
    } finally {
      buildLoenudviklingModelSpy.mockRestore();
    }
  });

  it('viser reguleringsindeks i SFGG-tabellen med reel beregningsperiode-model', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Beregningsperiode';
    values.periodeTilBeregningFra = '2023-12-01';
    values.periodeTilBeregningTil = '2023-12-31';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      feriePct: 16.95,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 2666.28 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: '2023-12-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 0,
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-02-26',
        til: '2024-03-05',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    const tableRow = rows.find((row) => row.id === `sfgg.tabel.${values.loenindkomstAnsaettelsesforhold[0].id}`);
    expect(tableRow?.displayValue).toContain('Fra-dato | Til-dato | Indeks | Sats |');
    expect(tableRow?.displayValue).toContain('26-02-2024 | 29-02-2024 | 100,00 | 21,52 |');
    expect(tableRow?.displayValue).toContain('01-03-2024 | 05-03-2024 | 105,08 | 22,61 |');
  });

  it('viser referencesats som overenskomstfastsat ved direkte overenskomstsats uden referenceperiode', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'bygningsoverenskomsten',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 10000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: undefined,
        satsvalg: 'Faglaert-Koebenhavn',
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-01-15',
        til: '2024-01-15',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows.find((row) => row.id === `sfgg.referencesats.${values.loenindkomstAnsaettelsesforhold[0].id}`)).toEqual(
      expect.objectContaining({
        id: `sfgg.referencesats.${values.loenindkomstAnsaettelsesforhold[0].id}`,
        label: 'Referencesats',
        displayValue: 'Fastsættes i overenskomsten',
        status: 'ok',
      })
    );
    expect(rows.find((row) => row.id === `sfgg.referenceperiode.${values.loenindkomstAnsaettelsesforhold[0].id}`)).toBeUndefined();
    expect(rows.find((row) => row.id === `sfgg.referenceperiodeantal.${values.loenindkomstAnsaettelsesforhold[0].id}`)).toBeUndefined();
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.satsvalg.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          status: 'ok',
        }),
      ])
    );
  });

  it('viser SFGG-tabel for Transportoverenskomsten (ATL) ved direkte overenskomstsats', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'transportoverenskomsten-atl',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: undefined,
        satsvalg: 'Faglaert-Provinsen',
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-01-26',
        til: '2024-03-05',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.tabel.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'SFGG-beregning',
          displayValue: expect.stringContaining('26-01-2024 | 29-02-2024 | 146,20 |'),
        }),
      ])
    );
  });

  it('viser fejl når direkte overenskomstsats ikke kan fastsættes i TAF-perioden', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'transportoverenskomsten-atl',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst',
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: undefined,
        satsvalg: undefined,
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2010-01-04',
        til: '2010-01-05',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2010-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.referencesats.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Referencesats',
          displayValue: 'Fastsættes i overenskomsten',
          status: 'ok',
        }),
        expect.objectContaining({
          id: `sfgg.dagssats.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Dagssats',
          status: 'error',
          message: 'Dagssats kunne ikke fastsættes for den valgte overenskomst i TAF-perioden',
        }),
      ])
    );
    expect(rows.find((row) => row.id === `sfgg.tabel.${values.loenindkomstAnsaettelsesforhold[0].id}`)).toBeUndefined();
  });

  it('fejler ikke hele SFGG-debug når lønudviklingsmodellen mangler beregningsgrundlag', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      harOverenskomst: true,
      overenskomstId: 'industriens-overenskomst',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: undefined,
      indtaegtsoplysningerTableData: [{
        id: 'loen-dec-2023',
        col0_maaned: '12',
        col1_maaned: '2023',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 10000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Overenskomst',
        referenceperiodeFra: undefined,
        referenceperiodeTil: undefined,
        referenceperiodeFravaersdageUdenLoen: undefined,
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-01-15',
        til: '2024-01-15',
        loseFeriedage: undefined,
      },
    ];

    const buildLoenudviklingModelSpy = vi
      .spyOn(eoPdfLoenudviklingModule, 'buildLoenudviklingModel')
      .mockImplementation(() => {
        throw new Error('Loenudvikling kan ikke beregnes: mangler beregningsgrundlag');
      });

    try {
      expect(() =>
        buildEODebugSygeferiegodtgoerelseRows(values, {
          journalnr: undefined,
          skadestype: 'Arbejdsulykke',
          skadesdato: '2024-01-01',
        })
      ).not.toThrow();

      const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
        journalnr: undefined,
        skadestype: 'Arbejdsulykke',
        skadesdato: '2024-01-01',
      });

      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `sfgg.beregningskilde.${values.loenindkomstAnsaettelsesforhold[0].id}`,
            displayValue: 'Overenskomst',
            status: 'ok',
          }),
        ])
      );
    } finally {
      buildLoenudviklingModelSpy.mockRestore();
    }
  });

  it('viser formel på feriepenge modtaget i perioden når der er lønindkomst i TAF-perioden', () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 10000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Ferieloven',
        referenceperiodeFra: '2023-12-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 0,
        alleredeBetaltBeloeb: '0,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-01-15',
        til: '2024-01-15',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.eftertabel.feriepengeModtaget.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: expect.stringContaining('Feriepenge modtaget i perioden ('),
        }),
      ])
    );
  });

  it("clamp'er beregnet sygeferiegodtgørelse til 0 når fradragene overstiger feriepengekravet", () => {
    const values = createValues();
    values.eoNummer = '2';
    values.beregnesUdFra = 'Angivet dagsløn';
    values.loenindkomstAnsaettelsesforhold[0] = {
      ...values.loenindkomstAnsaettelsesforhold[0],
      feriePct: 12.5,
      indtaegtsoplysningerTableData: [{
        id: 'loen-jan-2024',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 10000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      }],
    };
    values.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: values.loenindkomstAnsaettelsesforhold[0].id,
        beregnesUdFra: 'Ferieloven',
        referenceperiodeFra: '2023-12-01',
        referenceperiodeTil: '2023-12-31',
        referenceperiodeFravaersdageUdenLoen: 0,
        alleredeBetaltBeloeb: '100,00',
      },
    ];
    values.tafPerioder = [
      {
        id: 'taf-1',
        fra: '2024-01-15',
        til: '2024-01-15',
        loseFeriedage: undefined,
      },
    ];

    const rows = buildEODebugSygeferiegodtgoerelseRows(values, {
      journalnr: undefined,
      skadestype: 'Arbejdsulykke',
      skadesdato: '2024-01-01',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `sfgg.eftertabel.beregnet.${values.loenindkomstAnsaettelsesforhold[0].id}`,
          label: 'Beregnet sygeferiegodtgørelse',
          displayValue: '0,00',
          status: 'ok',
        }),
      ])
    );
  });
});
