import type { StandardLoenTableRow, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  buildEoBilagIndkomstYdelserRanges,
  hasAarsloenRowOverlapWithRanges,
  hasOffentligYdelseRowOverlapWithRanges,
  shouldIncludeEoReguleringBilag,
  shouldIncludeLoenRowInEoBilag,
  shouldIncludeOffentligYdelseRowInEoBilag,
} from '../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import { resolveValgtReguleringDisplay } from '../../../domain/erstatningsopgoerelse/helpers/loenudviklingDisplay';

const iso = (value: string) => toISODateString(value);
const invalidIso = (value: string): ISODateString => value as unknown as ISODateString;

const makeLoenRow = (overrides: Partial<StandardLoenTableRow>): StandardLoenTableRow => ({
  id: 'row1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
  ...overrides,
});

const createEmployment = (overrides: Record<string, unknown> = {}) => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-base',
  ...overrides,
});

describe('erstatningsopgoerelsePdf periodefilter', () => {
  it('ignorerer ranges og medtager række i Alle-mode', () => {
    const loenRow = makeLoenRow({
      col0_dag: toISODateString('2024-01-01'),
      col1_dag: toISODateString('2024-01-31'),
    });
    const arbitraryRanges = [{ fra: iso('2025-01-01'), til: iso('2025-12-31') }] as const;

    expect(hasAarsloenRowOverlapWithRanges(loenRow, 'dag', 'Alle', arbitraryRanges)).toBe(true);

    const offentligRow: OffentligeYdelserRow = {
      id: 'oy-alle',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-31'),
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligRow, 'Alle', arbitraryRanges)).toBe(true);
  });

  it('ekskluderer række i Alle-mode når rækkens dato ikke kan parses (fail-closed)', () => {
    const arbitraryRanges = [{ fra: iso('2025-01-01'), til: iso('2025-12-31') }] as const;

    const offentligUgyldig: OffentligeYdelserRow = {
      id: 'oy-alle-invalid',
      fraDato: invalidIso('2024-02-31'),
      tilDato: invalidIso('2024-02-31'),
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligUgyldig, 'Alle', arbitraryRanges)).toBe(false);

    const loenUgyldig = makeLoenRow({
      col0_dag: invalidIso('2024-02-31'),
      col1_dag: invalidIso('2024-02-31'),
    });
    expect(hasAarsloenRowOverlapWithRanges(loenUgyldig, 'dag', 'Alle', arbitraryRanges)).toBe(false);
  });

  it('ekskluderer rækker når Perioden er valgt uden gyldige perioder (fail-closed)', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.eoNummer = '2';
    eoValues.vedroererPeriodeFra = undefined;
    eoValues.vedroererPeriodeTil = undefined;
    eoValues.tafBeregningsperiodeFra = undefined;
    eoValues.tafBeregningsperiodeTil = undefined;

    const ranges = buildEoBilagIndkomstYdelserRanges(eoValues, 'Perioden');
    expect(ranges).toHaveLength(0);

    const offentligRow: OffentligeYdelserRow = {
      id: 'oy-1',
      fraDato: toISODateString('2024-01-01'),
      tilDato: toISODateString('2024-01-31'),
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligRow, 'Perioden', ranges)).toBe(false);

    const loenRow = makeLoenRow({
      col0_dag: toISODateString('2024-01-01'),
      col1_dag: toISODateString('2024-01-31'),
    });
    expect(hasAarsloenRowOverlapWithRanges(loenRow, 'dag', 'Perioden', ranges)).toBe(false);
  });

  it('medtager via TAF-perioder når Perioden-mode er valgt', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.tafPerioder = [
      {
        ...eoValues.tafPerioder[0],
        id: 'taf-1',
        fra: iso('2024-01-01'),
        til: iso('2024-01-31'),
      },
      {
        ...eoValues.tafPerioder[0],
        id: 'taf-2',
        fra: iso('2024-02-01'),
        til: iso('2024-02-29'),
      },
    ];

    const ranges = buildEoBilagIndkomstYdelserRanges(eoValues, 'Perioden');
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ fra: iso('2024-01-01'), til: iso('2024-02-29') });

    const offentligKunBeregningsperiode: OffentligeYdelserRow = {
      id: 'oy-2',
      fraDato: toISODateString('2024-01-15'),
      tilDato: toISODateString('2024-01-20'),
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligKunBeregningsperiode, 'Perioden', ranges)).toBe(true);

    const offentligUdenOverlap: OffentligeYdelserRow = {
      id: 'oy-3',
      fraDato: toISODateString('2024-03-01'),
      tilDato: toISODateString('2024-03-15'),
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligUdenOverlap, 'Perioden', ranges)).toBe(false);
  });

  it('ekskluderer række i Perioden-mode når rækkens dato ikke kan parses (fail-closed)', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.tafPerioder = [
      {
        ...eoValues.tafPerioder[0],
        id: 'taf-1',
        fra: iso('2024-02-01'),
        til: iso('2024-02-29'),
      },
    ];

    const ranges = buildEoBilagIndkomstYdelserRanges(eoValues, 'Perioden');
    expect(ranges.length).toBeGreaterThan(0);

    const offentligUgyldig: OffentligeYdelserRow = {
      id: 'oy-invalid',
      fraDato: invalidIso('2024-02-31'),
      tilDato: invalidIso('2024-02-31'),
      ydelsestype: 'sygedagpenge',
    };
    expect(hasOffentligYdelseRowOverlapWithRanges(offentligUgyldig, 'Perioden', ranges)).toBe(false);

    const loenUgyldigDato = makeLoenRow({
      col0_dag: invalidIso('2024-02-31'),
      col1_dag: invalidIso('2024-02-31'),
    });
    expect(hasAarsloenRowOverlapWithRanges(loenUgyldigDato, 'dag', 'Perioden', ranges)).toBe(false);
  });

  it('filtrerer lønrækker i Perioden-mode selv når ansættelsesforholdet har andre overlap', () => {
    const ranges = [{ fra: iso('2022-03-18'), til: iso('2024-01-01') }] as const;
    const errorRowIds = new Set<string>();

    const rowIOverlap = makeLoenRow({
      id: 'loen-overlap',
      col0_dag: toISODateString('2024-01-01'),
      col1_dag: toISODateString('2024-01-31'),
      col2: { kind: 'number', value: 1000 },
    });
    const rowUdenforPeriode = makeLoenRow({
      id: 'loen-udenfor',
      col0_dag: toISODateString('2024-02-01'),
      col1_dag: toISODateString('2024-02-29'),
      col2: { kind: 'number', value: 1000 },
    });

    expect(
      shouldIncludeLoenRowInEoBilag({
        row: rowIOverlap,
        loenperiode: 'dag',
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(true);
    expect(
      shouldIncludeLoenRowInEoBilag({
        row: rowUdenforPeriode,
        loenperiode: 'dag',
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(false);
  });

  it('medtager lønrække med 0-beløb når dato-overlap er gyldigt', () => {
    const ranges = [{ fra: iso('2022-03-18'), til: iso('2024-01-01') }] as const;
    const errorRowIds = new Set<string>();
    const rowMedNulBeloeb = makeLoenRow({
      id: 'loen-nul',
      col0_dag: toISODateString('2023-12-15'),
      col1_dag: toISODateString('2024-01-15'),
      col2: { kind: 'number', value: 0 },
    });

    expect(
      shouldIncludeLoenRowInEoBilag({
        row: rowMedNulBeloeb,
        loenperiode: 'dag',
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(true);
  });

  it('filtrerer offentlige ydelser i Perioden-mode med samme overlapregel', () => {
    const ranges = [{ fra: iso('2022-03-18'), til: iso('2024-01-01') }] as const;
    const errorRowIds = new Set<string>();

    const ydelseIOverlap: OffentligeYdelserRow = {
      id: 'oy-overlap',
      fraDato: toISODateString('2023-12-15'),
      tilDato: toISODateString('2024-01-15'),
      ydelsestype: 'sygedagpenge',
      ydelse: { kind: 'number', value: 100 },
    };
    const ydelseUdenforPeriode: OffentligeYdelserRow = {
      id: 'oy-udenfor',
      fraDato: toISODateString('2024-02-01'),
      tilDato: toISODateString('2024-02-29'),
      ydelsestype: 'sygedagpenge',
      ydelse: { kind: 'number', value: 100 },
    };

    expect(
      shouldIncludeOffentligYdelseRowInEoBilag({
        row: ydelseIOverlap,
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(true);
    expect(
      shouldIncludeOffentligYdelseRowInEoBilag({
        row: ydelseUdenforPeriode,
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(false);
  });

  it('ekskluderer offentlig ydelse uden beløb selv når periode/type er gyldig', () => {
    const ranges = [{ fra: iso('2022-03-18'), til: iso('2024-01-01') }] as const;
    const errorRowIds = new Set<string>();
    const ydelseUdenBeloeb: OffentligeYdelserRow = {
      id: 'oy-uden-beloeb',
      fraDato: toISODateString('2023-12-15'),
      tilDato: toISODateString('2024-01-15'),
      ydelsestype: 'sygedagpenge',
      ydelse: undefined,
      tillaeg: undefined,
    };

    expect(
      shouldIncludeOffentligYdelseRowInEoBilag({
        row: ydelseUdenBeloeb,
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(false);
  });

  it('medtager offentlig ydelse med 0-beløb når dato-overlap er gyldigt', () => {
    const ranges = [{ fra: iso('2022-03-18'), til: iso('2024-01-01') }] as const;
    const errorRowIds = new Set<string>();
    const ydelseMedNulBeloeb: OffentligeYdelserRow = {
      id: 'oy-nul-beloeb',
      fraDato: toISODateString('2023-12-15'),
      tilDato: toISODateString('2024-01-15'),
      ydelsestype: 'sygedagpenge',
      ydelse: { kind: 'number', value: 0 },
      tillaeg: undefined,
    };

    expect(
      shouldIncludeOffentligYdelseRowInEoBilag({
        row: ydelseMedNulBeloeb,
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(true);
  });

  it('ekskluderer lønrække helt før erstatningsperioden', () => {
    const ranges = [{ fra: iso('2022-03-18'), til: iso('2024-01-01') }] as const;
    const errorRowIds = new Set<string>();

    const rowFoerPeriode = makeLoenRow({
      id: 'loen-foer',
      col0_dag: toISODateString('2022-02-01'),
      col1_dag: toISODateString('2022-02-28'),
      col2: { kind: 'number', value: 1000 },
    });

    expect(
      shouldIncludeLoenRowInEoBilag({
        row: rowFoerPeriode,
        loenperiode: 'dag',
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(false);
  });

  it('ekskluderer offentlig ydelse helt før erstatningsperioden', () => {
    const ranges = [{ fra: iso('2022-03-18'), til: iso('2024-01-01') }] as const;
    const errorRowIds = new Set<string>();

    const ydelseFoerPeriode: OffentligeYdelserRow = {
      id: 'oy-foer',
      fraDato: toISODateString('2022-02-01'),
      tilDato: toISODateString('2022-02-28'),
      ydelsestype: 'sygedagpenge',
    };

    expect(
      shouldIncludeOffentligYdelseRowInEoBilag({
        row: ydelseFoerPeriode,
        mode: 'Perioden',
        ranges,
        errorRowIds,
      })
    ).toBe(false);
  });

  it('skjuler regulering-bilag ved Beregningsperiode når alle arbejdsgivere med indkomst er sat til Ingen', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeFra = iso('2025-01-01');
    eoValues.tafBeregningsperiodeTil = iso('2025-01-31');
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [
          makeLoenRow({
            id: 'af-1-row-1',
            col0_maaned: '1',
            col1_maaned: '2025',
            col2: { kind: 'number', value: 10000 },
          }),
        ],
      }),
      createEmployment({
        id: 'af-2',
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        indtaegtsoplysningerTableData: [],
      }),
    ];

    expect(shouldIncludeEoReguleringBilag(eoValues)).toBe(false);
  });

  it('medtager regulering-bilag ved Beregningsperiode når en arbejdsgiver med indkomst ikke er Ingen', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeFra = iso('2025-01-01');
    eoValues.tafBeregningsperiodeTil = iso('2025-01-31');
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        indtaegtsoplysningerTableData: [
          makeLoenRow({
            id: 'af-1-row-1',
            col0_maaned: '1',
            col1_maaned: '2025',
            col2: { kind: 'number', value: 10000 },
          }),
        ],
      }),
    ];

    expect(shouldIncludeEoReguleringBilag(eoValues)).toBe(true);
  });

  it('medtager regulering-bilag ved Beregningsperiode når ingen kilder har indkomst i perioden', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeFra = iso('2025-01-01');
    eoValues.tafBeregningsperiodeTil = iso('2025-01-31');
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [],
      }),
    ];

    expect(shouldIncludeEoReguleringBilag(eoValues)).toBe(true);
  });

  it('medtager regulering-bilag ved Beregningsperiode når der ikke er ansættelsesforhold', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeFra = iso('2025-01-01');
    eoValues.tafBeregningsperiodeTil = iso('2025-01-31');
    eoValues.loenindkomstAnsaettelsesforhold = [];

    expect(shouldIncludeEoReguleringBilag(eoValues)).toBe(true);
  });

  it('skjuler regulering-bilag ved angivet løn når EO-oplysninger har lønudvikling = Ingen', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Angivet månedsløn';
    eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';

    expect(shouldIncludeEoReguleringBilag(eoValues)).toBe(false);
  });

  it('medtager regulering-bilag ved angivet løn når EO-oplysninger har lønudvikling forskellig fra Ingen', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Angivet dagsløn';
    eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Manuelt angivet';

    expect(shouldIncludeEoReguleringBilag(eoValues)).toBe(true);
  });

  it('ignorerer ansættelsesforholdenes lønudvikling når beregningsgrundlag ikke er Beregningsperiode', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Angivet månedsløn';
    eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Overenskomst';
    eoValues.loenindkomstAnsaettelsesforhold = eoValues.loenindkomstAnsaettelsesforhold.map((af) => ({
      ...af,
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [
        makeLoenRow({
          id: `${af.id}-row`,
          col0_maaned: '1',
          col1_maaned: '2025',
          col2: { kind: 'number', value: 10000 },
        }),
      ],
    }));

    expect(shouldIncludeEoReguleringBilag(eoValues)).toBe(true);
  });

  it('ignorerer EO-oplysninger lønudvikling når beregningsgrundlag er Beregningsperiode', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeFra = iso('2025-01-01');
    eoValues.tafBeregningsperiodeTil = iso('2025-01-31');
    eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        id: 'af-1',
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        indtaegtsoplysningerTableData: [
          makeLoenRow({
            id: 'af-1-row-1',
            col0_maaned: '1',
            col1_maaned: '2025',
            col2: { kind: 'number', value: 10000 },
          }),
        ],
      }),
    ];

    expect(shouldIncludeEoReguleringBilag(eoValues)).toBe(true);
  });

  it('viser navn på reguleringsform ved manuelt angivet regulering i stedet for generisk label', () => {
    const af = createEmployment({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      loenudviklingManuelNavn: 'DA-tillægstrin',
    });

    expect(resolveValgtReguleringDisplay(af)).toBe('Manuelt angivet (DA-tillægstrin)');
  });

  it('falder tilbage til Manuelt angivet når navn på reguleringsform mangler', () => {
    const af = createEmployment({
      loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      loenudviklingManuelNavn: '   ',
    });

    expect(resolveValgtReguleringDisplay(af)).toBe('Manuelt angivet');
  });

});
