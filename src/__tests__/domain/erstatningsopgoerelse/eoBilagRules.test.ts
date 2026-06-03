import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  getEoBilagAvailability,
  hasMidlertidigtEetYdelsestype,
} from '../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const makeValues = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  return {
    ...base,
    eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Alle',
    ...patch,
  };
};

describe('getEoBilagAvailability', () => {
  it('deaktiverer lønindkomst når der ikke er indtastet lønoplysninger i tabellen', () => {
    const values = makeValues({
      loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
    });

    const result = getEoBilagAvailability({
      eoValues: values,
    });

    expect(result.loenindkomst.enabled).toBe(false);
    expect(result.loenindkomst.disabledReason).toBe('Der er ingen fejlfrie lønrækker med beløb inden for det valgte bilagsfilter.');
  });

  it('aktiverer lønindkomst når mindst én lønrække har beløbsinput', () => {
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    employment.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: { kind: 'number', value: 1000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];

    const result = getEoBilagAvailability({
      eoValues: makeValues({ loenindkomstAnsaettelsesforhold: [employment] }),
    });

    expect(result.loenindkomst.enabled).toBe(true);
  });

  it('aktiverer lønindkomst i Perioden når TAF beregnes fra beregningsperiode og lønnen findes i beregningsperioden', () => {
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    employment.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: { kind: 'number', value: 1000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];

    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Perioden',
        tafBeregningsperiodeFra: toISODateString('2024-01-01'),
        tafBeregningsperiodeTil: toISODateString('2024-01-31'),
        tafPerioder: [{ id: 'taf-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-29'), loseFeriedage: 0 }],
        loenindkomstAnsaettelsesforhold: [employment],
      }),
    });

    expect(result.loenindkomst.enabled).toBe(true);
  });

  it('deaktiverer offentlige ydelser når tabellen er tom', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({ offentligeYdelserRows: [] }),
    });

    expect(result.offentligeYdelser.enabled).toBe(false);
    expect(result.offentligeYdelser.disabledReason).toBe('Der er ingen fejlfrie ydelsesrækker med beløb inden for det valgte bilagsfilter.');
  });

  it('deaktiverer offentlige ydelser når der kun er delvis indtastning uden beløb', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        offentligeYdelserRows: [
          { id: 'row-1', fraDato: toISODateString('2024-01-01'), tilDato: undefined, ydelse: undefined, tillaeg: undefined, ydelsestype: '' },
        ],
      }),
    });

    expect(result.offentligeYdelser.enabled).toBe(false);
  });

  it('aktiverer offentlige ydelser når mindst én række har fejlfrie beløb og overlap', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        offentligeYdelserRows: [
          { id: 'row-1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelse: { kind: 'number', value: 1000 }, tillaeg: undefined, ydelsestype: 'dagpenge' },
        ],
      }),
    });

    expect(result.offentligeYdelser.enabled).toBe(true);
  });

  it('aktiverer offentlige ydelser i Perioden når TAF beregnes fra beregningsperiode og ydelsen findes i beregningsperioden', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Perioden',
        tafBeregningsperiodeFra: toISODateString('2024-01-01'),
        tafBeregningsperiodeTil: toISODateString('2024-01-31'),
        tafPerioder: [{ id: 'taf-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-29'), loseFeriedage: 0 }],
        offentligeYdelserRows: [
          { id: 'row-1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelse: { kind: 'number', value: 1000 }, tillaeg: undefined, ydelsestype: 'dagpenge' },
        ],
      }),
    });

    expect(result.offentligeYdelser.enabled).toBe(true);
  });

  it('deaktiverer midlertidig EET når togglen "Midlertidigt EET fra Erhvervsevnetab-siden" ikke er aktiveret', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({ midlertidigtEetFraEetSiden: 'Nej' }),
    });

    expect(result.midlertidigEet.enabled).toBe(false);
    expect(result.midlertidigEet.disabledReason).toBe('Forudsætter at midlertidigt EET indsættes fra Erhvervsevnetab-siden.');
  });

  it('aktiverer midlertidig EET når togglen "Midlertidigt EET fra Erhvervsevnetab-siden" er aktiveret', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({ midlertidigtEetFraEetSiden: 'Ja' }),
    });

    expect(result.midlertidigEet.enabled).toBe(true);
  });

  it('deaktiverer regulering ved beregningsperiode når alle ansættelsesforhold mangler reguleringsvalg', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: toISODateString('2024-01-01'),
        tafBeregningsperiodeTil: toISODateString('2024-01-31'),
        loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
      }),
    });

    expect(result.regulering.enabled).toBe(false);
    expect(result.regulering.disabledReason).toBe(
      'Der er ingen løn eller offentlige ydelser, som faktisk reguleres i den aktuelle opgørelse.'
    );
  });

  it('aktiverer regulering ved beregningsperiode når ét ansættelsesforhold har valgt regulering', () => {
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    employment.loenudviklingBeregningsgrundlag = 'Statistik';

    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: toISODateString('2024-01-01'),
        tafBeregningsperiodeTil: toISODateString('2024-01-31'),
        loenindkomstAnsaettelsesforhold: [employment],
      }),
    });

    expect(result.regulering.enabled).toBe(true);
  });

  it('aktiverer regulering ved beregningsperiode når der kun findes regulering af offentlige ydelser', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        regulerOffentligeYdelser: 'Ja',
        tafBeregningsperiodeFra: toISODateString('2024-01-01'),
        tafBeregningsperiodeTil: toISODateString('2024-01-31'),
        tafPerioder: [{ id: 'taf-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-29'), loseFeriedage: 0 }],
        loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
        offentligeYdelserRows: [
          {
            id: 'row-1',
            fraDato: toISODateString('2024-01-01'),
            tilDato: toISODateString('2024-01-31'),
            ydelse: { kind: 'number', value: 1000 },
            tillaeg: undefined,
            ydelsestype: 'dagpenge',
          },
        ],
      }),
    });

    expect(result.regulering.enabled).toBe(true);
  });

  it('deaktiverer filtrerede bilag når Perioden er valgt uden TAF-perioder', () => {
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    employment.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col0_uge: '',
        col1_uge: '',
        col0_dag: undefined,
        col1_dag: undefined,
        col2: { kind: 'number', value: 1000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];
    employment.loenudviklingBeregningsgrundlag = 'Statistik';

    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Perioden',
        tafBeregningsperiodeFra: undefined,
        tafBeregningsperiodeTil: undefined,
        tafPerioder: [],
        loenindkomstAnsaettelsesforhold: [employment],
        offentligeYdelserRows: [
          { id: 'row-2', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelse: { kind: 'number', value: 1000 }, tillaeg: undefined, ydelsestype: 'dagpenge' },
        ],
      }),
    });

    expect(result.loenindkomst.enabled).toBe(false);
    expect(result.offentligeYdelser.enabled).toBe(false);
    expect(result.regulering.enabled).toBe(false);
    expect(result.loenindkomst.disabledReason).toBe('Bilag er sat til Perioden, men der findes ingen TAF-perioder at filtrere efter.');
  });

  it('deaktiverer regulering ved angivet løn når EO-lønudvikling ikke er valgt', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Angivet dagsløn',
        eoAngivetLoenLoenudvikling: {
          ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
          loenudviklingBeregningsgrundlag: undefined,
        },
      }),
    });

    expect(result.regulering.enabled).toBe(false);
    expect(result.regulering.disabledReason).toBe(
      'Der er ingen løn eller offentlige ydelser, som faktisk reguleres i den aktuelle opgørelse.'
    );
  });

  it('deaktiverer SH-dage når TAF ikke beregnes som arbejdsdage', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({ beregnesUdFra: 'Angivet månedsløn' }),
    });

    expect(result.shDage.enabled).toBe(false);
    expect(result.shDage.disabledReason).toBe('TAF beregnes som måneder. SH-dage er derfor ikke relevante.');
  });

  it('aktiverer SH-dage når TAF beregnes som arbejdsdage', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({ beregnesUdFra: 'Angivet dagsløn' }),
    });

    expect(result.shDage.enabled).toBe(true);
  });

  it('deaktiverer sygeferiegodtgørelse når alle ansættelsesforhold mangler beregningskilde eller er sat til Ingen', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        sfggAnsaettelsesforhold: [
          {
            ansaettelsesforholdId: 'af-1',
            sfggBeregningskilde: 'Ingen',
            sfggReferenceperiodeFra: undefined,
            sfggReferenceperiodeTil: undefined,
            sfggReferenceperiodeFravaersdageUdenLoen: undefined,
            sfggManuelDagssats: undefined,
            sfggManuelBeloebIHenholdTil: undefined,
            sfggManuelFoerstEfterSygeloen: 'Nej',
            sfggSatsvalg: undefined,
            sfggAlleredeBetaltBeloeb: undefined,
          },
        ],
      }),
    });

    expect(result.sygeferiegodtgoerelse.enabled).toBe(false);
    expect(result.sygeferiegodtgoerelse.disabledReason).toBe(
      'Sygeferiegodtgørelse er ikke valgt for noget ansættelsesforhold på lønindkomst-siden.'
    );
  });

  it('aktiverer sygeferiegodtgørelse når ét ansættelsesforhold har valgt beregningskilde', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        sfggAnsaettelsesforhold: [
          {
            ansaettelsesforholdId: 'af-1',
            sfggBeregningskilde: 'Ferieloven',
            sfggReferenceperiodeFra: undefined,
            sfggReferenceperiodeTil: undefined,
            sfggReferenceperiodeFravaersdageUdenLoen: undefined,
            sfggManuelDagssats: undefined,
            sfggManuelBeloebIHenholdTil: undefined,
            sfggManuelFoerstEfterSygeloen: 'Nej',
            sfggSatsvalg: undefined,
            sfggAlleredeBetaltBeloeb: undefined,
          },
        ],
      }),
    });

    expect(result.sygeferiegodtgoerelse.enabled).toBe(true);
  });
});

describe('hasMidlertidigtEetYdelsestype', () => {
  it('returnerer true når en offentlig ydelse har ydelsestypen Midlertidigt EET uden krav til beløb eller periode', () => {
    const values = makeValues({
      offentligeYdelserRows: [
        { id: 'row-1', fraDato: undefined, tilDato: undefined, ydelse: undefined, tillaeg: undefined, ydelsestype: 'midlertidigt_eet' },
      ],
    });

    expect(hasMidlertidigtEetYdelsestype(values)).toBe(true);
  });

  it('returnerer false når ingen offentlig ydelse har ydelsestypen Midlertidigt EET', () => {
    const values = makeValues({
      offentligeYdelserRows: [
        { id: 'row-1', fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-01-31'), ydelse: { kind: 'number', value: 1000 }, tillaeg: undefined, ydelsestype: 'sygedagpenge' },
      ],
    });

    expect(hasMidlertidigtEetYdelsestype(values)).toBe(false);
  });
});
