import { moneyOre } from '../../../domain/money/money';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  getEoBilagAvailability,
  hasMidlertidigtEetYdelsestype,
  type EoBilagAvailabilityState,
} from '../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import type { LoenudviklingModel, OffentligeYdelserUdviklingModel } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';

/**
 * Læser årsagen ud af en inaktiv tilgængelighedstilstand. Tilstanden er en discriminated union, netop
 * fordi et inaktivt bilagsvalg ALTID skal have en årsag at vise i tooltippet – narrowingen her hævder
 * derfor invarianten frem for at omgå den med en assertion.
 */
const disabledReasonOf = (state: EoBilagAvailabilityState): string => {
  expect(state.enabled).toBe(false);
  if (state.enabled) throw new Error('forventede en inaktiv tilstand med årsag');
  return state.disabledReason;
};

const makeValues = (patch: Partial<ErstatningsopgoerelseValues> = {}): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  return {
    ...base,
    eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Alle',
    ...patch,
  };
};

const makeLoenudviklingModel = (deltaPct: number): LoenudviklingModel => ({
  loenudviklingLabel: 'Statistik',
  loenudviklingTotal: { status: 'ok', value: moneyOre(100000) },
  beregningsenhed: 'Måneder',
  beregnedeSegmenter: [
    {
      kind: 'maaneder',
      fra: toISODateString('2024-02-01'),
      til: toISODateString('2024-02-29'),
      maaneder: 1,
      maanedsloenOre: moneyOre(100000),
      deltaPct,
      amountOre: moneyOre(100000),
    },
  ],
  perAnsaettelse: [],
});

const makeOffentligeYdelserUdviklingModel = (deltaPct: number): OffentligeYdelserUdviklingModel => ({
  reguleringsLabel: 'Statslig regulering per 1. januar',
  reguleringsBaseIso: toISODateString('2024-01-31'),
  beregningsenhed: 'Måneder',
  entries: [
    {
      typeKey: 'dagpenge',
      label: 'Dagpenge',
      total: { status: 'ok', value: moneyOre(100000) },
      beregnedeSegmenter: [
        {
          kind: 'maaneder',
          fra: toISODateString('2024-02-01'),
          til: toISODateString('2024-02-29'),
          maaneder: 1,
          maanedsloenOre: moneyOre(100000),
          deltaPct,
          amountOre: moneyOre(100000),
        },
      ],
    },
  ],
  total: { status: 'ok', value: moneyOre(100000) },
});

describe('getEoBilagAvailability', () => {
  it('deaktiverer lønindkomst når der ikke er indtastet lønoplysninger i tabellen', () => {
    const values = makeValues({
      loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
    });

    const result = getEoBilagAvailability({
      eoValues: values,
    });

    expect(result.loenindkomst.enabled).toBe(false);
    expect(disabledReasonOf(result.loenindkomst)).toBe('Der er ingen lønoplysninger i TAF-perioden');
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
    expect(disabledReasonOf(result.offentligeYdelser)).toBe('Der er ingen offentlige ydelser i TAF-perioden');
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
    expect(disabledReasonOf(result.midlertidigEet)).toBe('Midlertidigt EET indsættes fra Erhvervsevnetab-siden er ikke slået til');
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
    expect(disabledReasonOf(result.regulering)).toBe(
      'Der er ingen løn eller offentlige ydelser, der reguleres'
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

  it('deaktiverer regulering når valgt lønregulering ikke giver regulering i TAF-perioden', () => {
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    employment.loenudviklingBeregningsgrundlag = 'Statistik';

    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: toISODateString('2024-01-01'),
        tafBeregningsperiodeTil: toISODateString('2024-01-31'),
        tafPerioder: [{ id: 'taf-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-29'), loseFeriedage: 0 }],
        loenindkomstAnsaettelsesforhold: [employment],
      }),
      loenudvikling: makeLoenudviklingModel(0),
      offentligeYdelserUdvikling: null,
    });

    expect(result.regulering.enabled).toBe(false);
    expect(disabledReasonOf(result.regulering)).toBe('Der sker ingen regulering i TAF-perioden');
  });

  it('aktiverer regulering når valgt lønregulering giver regulering i TAF-perioden', () => {
    const employment = createDefaultLoenindkomstAnsaettelsesforhold();
    employment.loenudviklingBeregningsgrundlag = 'Statistik';

    const result = getEoBilagAvailability({
      eoValues: makeValues({
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: toISODateString('2024-01-01'),
        tafBeregningsperiodeTil: toISODateString('2024-01-31'),
        tafPerioder: [{ id: 'taf-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-29'), loseFeriedage: 0 }],
        loenindkomstAnsaettelsesforhold: [employment],
      }),
      loenudvikling: makeLoenudviklingModel(2.5),
      offentligeYdelserUdvikling: null,
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

  it('deaktiverer regulering når offentlige ydelser er valgt reguleret men ikke reguleres i TAF-perioden', () => {
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
      loenudvikling: null,
      offentligeYdelserUdvikling: makeOffentligeYdelserUdviklingModel(0),
    });

    expect(result.regulering.enabled).toBe(false);
    expect(disabledReasonOf(result.regulering)).toBe('Der sker ingen regulering i TAF-perioden');
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
    expect(disabledReasonOf(result.loenindkomst)).toBe('Der er ingen TAF-perioder i EO-perioden');
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
    expect(disabledReasonOf(result.regulering)).toBe(
      'Der er ingen løn eller offentlige ydelser, der reguleres'
    );
  });

  it('deaktiverer SH-dage når TAF ikke beregnes som arbejdsdage', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({ beregnesUdFra: 'Angivet månedsløn' }),
    });

    expect(result.shDage.enabled).toBe(false);
    expect(disabledReasonOf(result.shDage)).toBe('TAF beregnes som måneder, og SH-dage er derfor ikke relevante');
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
    expect(disabledReasonOf(result.sygeferiegodtgoerelse)).toBe(
      'Sygeferiegodtgørelse er ikke valgt for noget ansættelsesforhold'
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

  it.each(['Nej', 'Skjul'] as const)(
    'deaktiverer alle dynamiske bilag i Perioden når kravPaaTabtArbejdsfortjeneste er %s',
    (kravPaaTabtArbejdsfortjeneste) => {
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
          kravPaaTabtArbejdsfortjeneste,
          eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Perioden',
          // Datagrundlag der ellers ville aktivere de enkelte bilag – skal ignoreres uden TAF-krav.
          beregnesUdFra: 'Angivet dagsløn',
          midlertidigtEetFraEetSiden: 'Ja',
          tafPerioder: [{ id: 'taf-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-02-29'), loseFeriedage: 0 }],
          loenindkomstAnsaettelsesforhold: [employment],
          offentligeYdelserRows: [
            { id: 'row-2', fraDato: toISODateString('2024-02-01'), tilDato: toISODateString('2024-02-29'), ydelse: { kind: 'number', value: 1000 }, tillaeg: undefined, ydelsestype: 'dagpenge' },
          ],
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

      const forventetAarsag = 'Der er ikke krav på tabt arbejdsfortjeneste i erstatningsperioden';
      for (const key of ['loenindkomst', 'offentligeYdelser', 'midlertidigEet', 'regulering', 'shDage', 'sygeferiegodtgoerelse'] as const) {
        expect(result[key].enabled).toBe(false);
        expect(disabledReasonOf(result[key])).toBe(forventetAarsag);
      }
    }
  );

  it('rører ikke bilag i Alle selvom der ikke er krav på tabt arbejdsfortjeneste', () => {
    const result = getEoBilagAvailability({
      eoValues: makeValues({
        kravPaaTabtArbejdsfortjeneste: 'Nej',
        eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Alle',
        midlertidigtEetFraEetSiden: 'Ja',
      }),
    });

    // I "Alle" gælder den TAF-krav-baserede afgrænsning ikke; midlertidig EET følger sin egen betingelse.
    expect(result.midlertidigEet.enabled).toBe(true);
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
