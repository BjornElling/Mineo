import { buildEODebugSygeferiegodtgoerelseRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
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
