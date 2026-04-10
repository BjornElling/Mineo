import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { toISODateString } from '../../types/branded';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';
import type { AmountValue } from '../../schemas/amountExpressionSchema';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });


const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  return { ...base, ...patch };
};

const hasError = (values: ErstatningsopgoerelseValues, messagePart: string): boolean => {
  const result = erstatningsopgoerelseValidator.validate(values);
  return result.errors.some((e) => e.message.includes(messagePart));
};

const isValid = (values: ErstatningsopgoerelseValues): boolean => {
  return erstatningsopgoerelseValidator.validate(values).isValid;
};

// =============================================================================
// FORLIG ANSVARSGRAD
// =============================================================================

describe('forlig ansvarsgrad', () => {
  it('accepterer gyldig brøk', () => {
    const values = makeValues({ forligAnsvarsgradBroek: '1/3' });
    expect(hasError(values, 'Brøk')).toBe(false);
  });

  it('afviser brøk med nævner 0', () => {
    const values = makeValues({ forligAnsvarsgradBroek: '1/0' });
    expect(hasError(values, 'Nævner kan ikke være 0')).toBe(true);
  });

  it('afviser brøk med tæller 0', () => {
    const values = makeValues({ forligAnsvarsgradBroek: '0/3' });
    expect(hasError(values, 'Tæller kan ikke være 0')).toBe(true);
  });

  it('afviser brøk hvor tæller > nævner', () => {
    const values = makeValues({ forligAnsvarsgradBroek: '5/3' });
    expect(hasError(values, 'Brøk kan ikke overstige 1')).toBe(true);
  });

  it('afviser ugyldigt brøk-format', () => {
    const values = makeValues({ forligAnsvarsgradBroek: 'abc' });
    expect(hasError(values, 'Brøk skal angives som fx "1/3"')).toBe(true);
  });

  it('afviser negativ brøk', () => {
    const values = makeValues({ forligAnsvarsgradBroek: '-1/3' });
    expect(hasError(values, 'Negative brøker er ikke tilladt')).toBe(true);
  });

  it('accepterer decimal-brøk med op til to decimaler', () => {
    const values = makeValues({ forligAnsvarsgradBroek: '1,5/2,5' });
    expect(hasError(values, 'Brøk')).toBe(false);
  });

  it('afviser samtidig procent og brøk', () => {
    const values = makeValues({
      forligAnsvarsgradProcent: 50,
      forligAnsvarsgradBroek: '1/3',
    });
    expect(hasError(values, 'enten procent eller brøk')).toBe(true);
  });

  it('tillader forlig-dato uden ansvarsgrad og behandler det som intet forlig', () => {
    const values = makeValues({
      forligDato: iso('2024-01-10'),
      forligAnsvarsgradProcent: undefined,
      forligAnsvarsgradBroek: undefined,
    });
    expect(hasError(values, 'Dato for forlig kræver')).toBe(false);
  });
});

// =============================================================================
// SVIE/SMERTE
// =============================================================================

describe('svie/smerte validering', () => {
  it('fanger overlappende perioder', () => {
    const values = makeValues({
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-15'), tilstand: 'sygemeldt' },
        { id: '2', fra: iso('2024-01-10'), til: iso('2024-01-20'), tilstand: 'sygemeldt' },
      ],
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    expect(hasError(values, 'overlapper')).toBe(true);
  });

  it('fanger manglende satser-år', () => {
    const values = makeValues({
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
      ],
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      svieSmerteSatserAar: undefined as unknown as number,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    expect(hasError(values, 'sats mangler')).toBe(true);
  });

  it('fanger satser-år udenfor 2005-2026', () => {
    const values = makeValues({
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
      ],
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      svieSmerteSatserAar: 2030,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    expect(hasError(values, 'Satser findes ikke')).toBe(true);
  });

  it('fanger manglende vedrører-periode', () => {
    const values = makeValues({
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
      ],
      vedroererPeriodeFra: undefined,
      vedroererPeriodeTil: undefined,
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    expect(hasError(values, 'Vedrører-perioden')).toBe(true);
  });

  it('fanger delvist udfyldt periode-række', () => {
    const values = makeValues({
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: undefined as unknown as string, tilstand: 'sygemeldt' },
      ],
    });
    expect(hasError(values, 'Til-dato mangler')).toBe(true);
  });

  it('fanger manglende delvis sygemelding sats', () => {
    const values = makeValues({
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'delvisSygemeldt' },
      ],
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: undefined as unknown as string,
    });
    expect(hasError(values, 'delvis sygemelding')).toBe(true);
  });
});

// =============================================================================
// TAF
// =============================================================================

describe('TAF validering', () => {
  it('fanger delvist udfyldt TAF-periode', () => {
    const values = makeValues({
      tafPerioder: [
        { id: '1', fra: iso('2024-01-01'), til: undefined as unknown as string },
      ],
    });
    expect(hasError(values, 'Til-dato mangler')).toBe(true);
  });

  it('fanger fra > til i TAF-periode', () => {
    const values = makeValues({
      tafPerioder: [
        { id: '1', fra: iso('2024-01-20'), til: iso('2024-01-01') },
      ],
    });
    expect(hasError(values, 'Til-dato skal være efter fra-dato')).toBe(true);
  });
});

describe('SFGG validering', () => {
  it('fanger manglende valg af beregningsgrundlag for SFGG', () => {
    const values = makeValues({
      loenindkomstAnsaettelsesforhold: [{ ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1', harOverenskomst: false, pensionPct: 0 }],
      sfggAnsaettelsesforhold: [],
    });

    expect(hasError(values, 'Beregningsgrundlag for SFGG ikke valgt')).toBe(true);
  });

  it('tillader eksplicit valg af Ingen uden fejl', () => {
    const values = makeValues({
      loenindkomstAnsaettelsesforhold: [{ ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1', harOverenskomst: false, pensionPct: 0 }],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ingen',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      }],
    });

    expect(hasError(values, 'Beregningsgrundlag for SFGG ikke valgt')).toBe(false);
  });

  it('fanger referenceperiode der ikke ligger før første TAF-periode', () => {
    const values = makeValues({
      loenindkomstAnsaettelsesforhold: [{ ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1', harOverenskomst: false, pensionPct: 0 }],
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-05-01'), til: iso('2024-05-31') },
      ],
      sfggAnsaettelsesforhold: [{
        ansaettelsesforholdId: 'af-1',
        sfggBeregningskilde: 'Ferieloven',
        sfggManuelDagssats: undefined,
        sfggManuelBeloebIHenholdTil: undefined,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggReferenceperiodeFra: iso('2024-05-01'),
        sfggReferenceperiodeTil: iso('2024-05-15'),
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: undefined,
      }],
    });

    expect(hasError(values, 'Referenceperioden skal ligge før første TAF-periode')).toBe(true);
  });
});

// =============================================================================
// ØVRIGE KRAV
// =============================================================================

describe('øvrige krav validering', () => {
  it('fanger delvist udfyldt øvrige krav-række', () => {
    const values = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-01-01'), udgiftTil: '', beloeb: asAmount(100) },
      ],
    });
    expect(hasError(values, 'Udgift til mangler')).toBe(true);
  });

  it('fanger negativt beløb', () => {
    const values = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-01-01'), udgiftTil: 'Test', beloeb: asAmount(-100) },
      ],
    });
    expect(hasError(values, 'negativt')).toBe(true);
  });

  it('springer tomme rækker over', () => {
    const values = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: undefined, udgiftTil: undefined, beloeb: undefined },
      ],
    });
    expect(hasError(values, 'Udgift til mangler')).toBe(false);
  });
});

// =============================================================================
// TAF LØNUDVIKLINGSKRAV
// =============================================================================

describe('TAF lønudviklingskrav for aktiv kilde', () => {
  it('fanger manglende overenskomst ved angivet løn med overenskomstregulering', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmount(1000),
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        overenskomstId: undefined,
      },
    });
    expect(hasError(values, 'Overenskomst skal vælges')).toBe(true);
  });

  it('fanger manglende loenPaaHelligdage ved angivet loen med overenskomstregulering', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmount(1000),
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        overenskomstId: 'some-overenskomst-id',
        loenPaaHelligdage: undefined,
      },
    });
    expect(hasError(values, 'helligdage')).toBe(true);
  });

  it('kræver feriegodtgørelse ved beregningsperiode når der er indtastede lønoplysninger', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'bygge-anlaeg',
          loenPaaHelligdage: 'Almindelig løn',
          feriePct: undefined,
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '',
              col1_maaned: '',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmount(1000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });

    expect(hasError(values, 'Feriegodtgørelse/-tillæg skal udfyldes')).toBe(true);
  });

  it('kræver ikke feriegodtgørelse ved beregningsperiode uden indtastede lønoplysninger', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Overenskomst',
          overenskomstId: 'bygge-anlaeg',
          loenPaaHelligdage: 'Almindelig løn',
          feriePct: undefined,
          indtaegtsoplysningerTableData: [],
        },
      ],
    });

    expect(hasError(values, 'Feriegodtgørelse/-tillæg skal udfyldes')).toBe(false);
  });
});

// =============================================================================
// STANDALONE REGLER
// =============================================================================

describe('standalone regler (vedroererPeriode)', () => {
  it('fanger vedroererPeriodeFra > vedroererPeriodeTil', () => {
    const values = makeValues({
      vedroererPeriodeFra: iso('2024-02-01'),
      vedroererPeriodeTil: iso('2024-01-01'),
    });
    expect(hasError(values, 'Til-dato skal være efter fra-dato')).toBe(true);
  });

  it('ingen fejl når fra == til', () => {
    const values = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-01'),
    });
    const result = erstatningsopgoerelseValidator.validate(values);
    const hasFraTilError = result.errors.some(
      (e) => e.path === 'vedroererPeriodeFra' && e.message.includes('Til-dato skal være efter fra-dato'),
    );
    expect(hasFraTilError).toBe(false);
  });
});

// =============================================================================
// SVIE/SMERTE EKSTRA CASES
// =============================================================================

describe('svie/smerte — ekstra valideringscases', () => {
  it('springer validering over når beregnesSvieSmerteGodtgoerelse = Nej', () => {
    const values = makeValues({
      beregnesSvieSmerteGodtgoerelse: 'Nej',
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-10'), til: iso('2024-01-01'), tilstand: 'sygemeldt' },
      ],
    });
    // Fra > til i perioden burde give fejl — men kun hvis beregning er aktiv
    expect(hasError(values, 'Til-dato skal være efter fra-dato')).toBe(false);
  });

  it('springer validering over når tidligereSsMax = Ja', () => {
    const values = makeValues({
      beregnesSvieSmerteGodtgoerelse: 'Ja',
      tidligereSsMax: 'Ja',
      svieSmertePerioder: [
        { id: '1', fra: undefined as unknown as string, til: undefined as unknown as string, tilstand: undefined as unknown as string },
      ],
    });
    // Perioden er ufuldstændig — men validering springes over ved tidligereSsMax=Ja
    expect(hasError(values, 'Fra-dato mangler')).toBe(false);
  });

  it('fanger manglende fra-dato i svie/smerte-række', () => {
    const values = makeValues({
      svieSmertePerioder: [
        { id: '1', fra: undefined as unknown as string, til: iso('2024-01-10'), tilstand: 'sygemeldt' },
      ],
    });
    expect(hasError(values, 'Fra-dato mangler')).toBe(true);
  });

  it('fanger manglende tilstand i svie/smerte-række', () => {
    const values = makeValues({
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: undefined as unknown as string },
      ],
    });
    expect(hasError(values, 'Tilstand mangler')).toBe(true);
  });

  it('fanger fra > til i svie/smerte-række', () => {
    const values = makeValues({
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-10'), til: iso('2024-01-01'), tilstand: 'sygemeldt' },
      ],
    });
    expect(hasError(values, 'Til-dato skal være efter fra-dato')).toBe(true);
  });
});

describe('TAF — clampede feriedage', () => {
  it('validerer løse feriedage mod den clampede TAF-periode', () => {
    const values = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-05'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-10'), loseFeriedage: 5 },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
    });

    const result = erstatningsopgoerelseValidator.validate(values);
    expect(
      result.errors.some((error) =>
        error.path === 'tafPerioder[0].loseFeriedage' &&
        error.message.startsWith('Løse feriedage overstiger mulige arbejdsdage i perioden')
      )
    ).toBe(true);
  });

  it('ignorerer løse feriedage når en ellers gyldig TAF-periode clampes helt bort', () => {
    const values = makeValues({
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-05'),
      tafPerioder: [
        { id: 'taf-1', fra: iso('2024-01-10'), til: iso('2024-01-12'), loseFeriedage: 5 },
      ],
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
      ],
      tafBeregningsperiodeFra: iso('2023-01-01'),
      tafBeregningsperiodeTil: iso('2023-12-31'),
    });

    const result = erstatningsopgoerelseValidator.validate(values);
    expect(
      result.errors.some((error) => error.path === 'tafPerioder[0].loseFeriedage')
    ).toBe(false);
  });
});

// =============================================================================
// TAF — EKSTRA CASES
// =============================================================================

describe('TAF — fanger manglende fra-dato alene', () => {
  it('fanger manglende fra-dato med til-dato til stede', () => {
    const values = makeValues({
      tafPerioder: [
        { id: '1', fra: undefined as unknown as string, til: iso('2024-01-31') },
      ],
    });
    expect(hasError(values, 'Fra-dato mangler')).toBe(true);
  });
});

// =============================================================================
// BEREGNES UD FRA
// =============================================================================

describe('validateBeregnesUdFra', () => {
  it('fanger manglende dagsløn ved "Angivet dagsløn"', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: undefined,
    });
    expect(hasError(values, 'Dagsløn skal udfyldes')).toBe(true);
  });

  it('ingen fejl ved udfyldt dagsløn (TAF slået fra)', () => {
    const values = makeValues({
      beregnesTabtArbejdsfortjeneste: 'Nej',
      beregnesUdFra: 'Angivet dagsløn',
      dagsloenenUdgoer: asAmount(500),
    });
    expect(hasError(values, 'Dagsløn skal udfyldes')).toBe(false);
  });

  it('fanger manglende til-dato i beregningsperiode', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: undefined,
    });
    expect(hasError(values, 'Beregningsperiode til-dato mangler')).toBe(true);
  });

  it('fanger beregningsperiode fra > til', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-06-01'),
      tafBeregningsperiodeTil: iso('2024-01-01'),
    });
    expect(hasError(values, 'Til-dato skal være efter fra-dato')).toBe(true);
  });

  it('ingen fejl ved beregningsperiode fra == til', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-01-01'),
    });
    expect(hasError(values, 'Til-dato skal være efter fra-dato')).toBe(false);
  });
});

// =============================================================================
// LØNUDVIKLING KONSISTENS (validateLoenudviklingKonsistens)
// =============================================================================

describe('validateLoenudviklingKonsistens', () => {
  const makeAF = (overrides: Record<string, unknown> = {}) => ({
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    ...overrides,
  });

  it('ingen fejl med ét ansættelsesforhold (enkelt-AF kræver ingen konsistens)', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        makeAF({ loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'bygge-anlaeg', loenPaaHelligdage: 'Almindelig løn' }),
      ],
    });
    expect(hasError(values, 'ens på tværs af ansættelsesforhold')).toBe(false);
  });

  it('tillader forskelligt beregningsgrundlag på tværs af AF', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        makeAF({ loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'bygge-anlaeg', loenPaaHelligdage: 'Almindelig løn' }),
        makeAF({ loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: 'DA/LO', loenPaaHelligdage: 'Almindelig løn' }),
      ],
    });
    expect(hasError(values, 'Lønudviklingsgrundlag skal være ens')).toBe(false);
  });

  it('tillader uens overenskomst på tværs af AF', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        makeAF({ loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'bygge-anlaeg', loenPaaHelligdage: 'Almindelig løn' }),
        makeAF({ loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'handel', loenPaaHelligdage: 'Almindelig løn' }),
      ],
    });
    expect(hasError(values, 'Overenskomst skal være ens')).toBe(false);
  });

  it('tillader uens statistikmodel på tværs af AF', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        makeAF({ loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: 'DA/LO' }),
        makeAF({ loenudviklingBeregningsgrundlag: 'Statistik', loenudviklingStatistikModel: 'KL-gruppen' }),
      ],
    });
    expect(hasError(values, 'Statistikmodel skal være ens')).toBe(false);
  });

  it('ingen fejl når alle AF har samme beregningsgrundlag og overenskomst', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      tafBeregningsperiodeFra: iso('2024-01-01'),
      tafBeregningsperiodeTil: iso('2024-12-31'),
      loenindkomstAnsaettelsesforhold: [
        makeAF({ loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'bygge-anlaeg', loenPaaHelligdage: 'Almindelig løn' }),
        makeAF({ loenudviklingBeregningsgrundlag: 'Overenskomst', overenskomstId: 'bygge-anlaeg', loenPaaHelligdage: 'Almindelig løn' }),
      ],
    });
    expect(hasError(values, 'ens på tværs af ansættelsesforhold')).toBe(false);
  });
});

// =============================================================================
// LØNUDVIKLING KRAV FOR AKTIV KILDE (validateLoenudviklingsKravForAktivKilde)
// =============================================================================

describe('validateLoenudviklingsKravForAktivKilde — Statistik og KRL', () => {
  it('fanger manglende statistikmodel ved grundlag=Statistik', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmount(30000),
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Statistik',
        loenudviklingStatistikModel: '',
      },
    });
    expect(hasError(values, 'Statistisk beregningsmodel skal vælges')).toBe(true);
  });

  it('accepterer ASL-årslønsmaksimum som gyldig statistikmodel', () => {
    const values = makeValues({
      beregnesTabtArbejdsfortjeneste: 'Nej',
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmount(30000),
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Statistik',
        loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
      },
    });

    expect(hasError(values, 'Statistisk beregningsmodel skal vælges')).toBe(false);
  });

  it('fanger manglende KRL satstabel ved grundlag=KRL satstabel', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmount(30000),
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'KRL satstabel',
        loenudviklingKRLSatstabel: undefined,
      },
    });
    expect(hasError(values, 'KRL satstabel skal vælges')).toBe(true);
  });

  it('fanger manglende manuel reguleringsrække ved grundlag=Manuelt angivet', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmount(30000),
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        loenudviklingManuelTableData: [],
      },
    });
    expect(hasError(values, 'Mindst én manuel reguleringsrække')).toBe(true);
  });

  it('fanger manglende grundløn på manuel reguleringsrække', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      maanedsloenenUdgoer: asAmount(30000),
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        loenudviklingManuelTableData: [
          { id: 'row-1', dato: '2024-01-01', grundloen: undefined, feriepenge: '', shSoSats: '', fritvalg: '', agPension: '' },
        ],
      },
    });
    expect(hasError(values, 'Grundløn skal udfyldes')).toBe(true);
  });

  it('ingen fejl ved grundlag=Ingen (springes over)', () => {
    const values = makeValues({
      beregnesTabtArbejdsfortjeneste: 'Nej',
      eoAngivetLoenLoenudvikling: {
        ...createErstatningsopgoerelseInitialValues().eoAngivetLoenLoenudvikling,
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    });
    expect(hasError(values, 'skal vælges')).toBe(false);
  });
});

// =============================================================================
// ØVRIGE KRAV — EKSTRA CASES
// =============================================================================

describe('øvrige krav — ekstra valideringscases', () => {
  it('fanger manglende dato med udgiftTil og beloeb til stede', () => {
    const values = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: undefined, udgiftTil: 'Transport', beloeb: asAmount(500) },
      ],
    });
    expect(hasError(values, 'Dato mangler')).toBe(true);
  });

  it('fanger manglende beloeb med dato og udgiftTil til stede', () => {
    const values = makeValues({
      oevrigeKravPerioder: [
        { id: '1', dato: iso('2024-01-01'), udgiftTil: 'Transport', beloeb: undefined },
      ],
    });
    expect(hasError(values, 'Beløb mangler')).toBe(true);
  });
});

// =============================================================================
// SAMLET
// =============================================================================

describe('samlet validering', () => {
  it('er valid med default-værdier når TAF er slået fra', () => {
    const values = makeValues({ beregnesTabtArbejdsfortjeneste: 'Nej' });
    expect(isValid(values)).toBe(true);
  });

  it('default-værdier med TAF giver fejl pga. manglende beregningsperiode', () => {
    const values = makeValues({});
    expect(hasError(values, 'Beregningsperiode fra-dato mangler')).toBe(true);
  });

  it('er valid med komplet svie/smerte (TAF slået fra)', () => {
    const values = makeValues({
      beregnesTabtArbejdsfortjeneste: 'Nej',
      svieSmertePerioder: [
        { id: '1', fra: iso('2024-01-01'), til: iso('2024-01-10'), tilstand: 'sygemeldt' },
      ],
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: 'fuld',
    });
    expect(isValid(values)).toBe(true);
  });
});
