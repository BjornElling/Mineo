import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getEoBilagAvailability } from '../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

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
      hasMidlertidigEetAfgoerelser: true,
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
        col0_dag: '',
        col1_dag: '',
        col2: { kind: 'number', value: 1000 },
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];

    const result = getEoBilagAvailability({
      eoValues: makeValues({ loenindkomstAnsaettelsesforhold: [employment] }),
      hasMidlertidigEetAfgoerelser: true,
    });

    expect(result.loenindkomst.enabled).toBe(true);
  });

  it('deaktiverer offentlige ydelser når tabellen er tom', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({ offentligeYdelserRows: [] }),
      hasMidlertidigEetAfgoerelser: true,
    });

    expect(result.offentligeYdelser.enabled).toBe(false);
    expect(result.offentligeYdelser.disabledReason).toBe('Der er ingen fejlfrie ydelsesrækker med beløb inden for det valgte bilagsfilter.');
  });

  it('deaktiverer offentlige ydelser når der kun er delvis indtastning uden beløb', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        offentligeYdelserRows: [
          { id: 'row-1', fraDato: '01-01-2024', tilDato: '', ydelse: undefined, tillaeg: undefined, ydelsestype: '' },
        ],
      }),
      hasMidlertidigEetAfgoerelser: true,
    });

    expect(result.offentligeYdelser.enabled).toBe(false);
  });

  it('aktiverer offentlige ydelser når mindst én række har fejlfrie beløb og overlap', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        offentligeYdelserRows: [
          { id: 'row-1', fraDato: '01-01-2024', tilDato: '31-01-2024', ydelse: { kind: 'number', value: 1000 }, tillaeg: undefined, ydelsestype: 'dagpenge' },
        ],
      }),
      hasMidlertidigEetAfgoerelser: true,
    });

    expect(result.offentligeYdelser.enabled).toBe(true);
  });

  it('deaktiverer midlertidig EET når der ikke findes midlertidige eller delvist endelige afgørelser', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues(),
      hasMidlertidigEetAfgoerelser: false,
    });

    expect(result.midlertidigEet.enabled).toBe(false);
    expect(result.midlertidigEet.disabledReason).toBe('Der er ikke indtastet midlertidig afgørelse på erhvervsevnetab-siden.');
  });

  it('deaktiverer regulering ved beregningsperiode når alle ansættelsesforhold mangler reguleringsvalg', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: '2024-01-01',
        tafBeregningsperiodeTil: '2024-01-31',
        loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
      }),
      hasMidlertidigEetAfgoerelser: true,
    });

    expect(result.regulering.enabled).toBe(false);
    expect(result.regulering.disabledReason).toBe(
      'Der er ikke valgt lønregulering for noget ansættelsesforhold.'
    );
  });

  it('aktiverer regulering ved beregningsperiode når ét ansættelsesforhold har valgt regulering', () => {
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    employment.loenudviklingBeregningsgrundlag = 'Statistik';

    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: '2024-01-01',
        tafBeregningsperiodeTil: '2024-01-31',
        loenindkomstAnsaettelsesforhold: [employment],
      }),
      hasMidlertidigEetAfgoerelser: true,
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
        col0_dag: '',
        col1_dag: '',
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
          { id: 'row-2', fraDato: '01-01-2024', tilDato: '31-01-2024', ydelse: { kind: 'number', value: 1000 }, tillaeg: undefined, ydelsestype: 'dagpenge' },
        ],
      }),
      hasMidlertidigEetAfgoerelser: true,
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
      hasMidlertidigEetAfgoerelser: true,
    });

    expect(result.regulering.enabled).toBe(false);
    expect(result.regulering.disabledReason).toBe(
      'Der er ikke angivet regulering af lønforhold.'
    );
  });

  it('deaktiverer SH-dage når TAF ikke beregnes som arbejdsdage', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({ beregnesUdFra: 'Angivet månedsløn' }),
      hasMidlertidigEetAfgoerelser: true,
    });

    expect(result.shDage.enabled).toBe(false);
    expect(result.shDage.disabledReason).toBe('TAF beregnes som måneder. SH-dage er derfor ikke relevante.');
  });

  it('aktiverer SH-dage når TAF beregnes som arbejdsdage', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({ beregnesUdFra: 'Angivet dagsløn' }),
      hasMidlertidigEetAfgoerelser: true,
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
      hasMidlertidigEetAfgoerelser: true,
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
      hasMidlertidigEetAfgoerelser: true,
    });

    expect(result.sygeferiegodtgoerelse.enabled).toBe(true);
  });
});
