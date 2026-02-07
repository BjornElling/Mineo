import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import { toISODateString } from '../../types/branded';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';
import type { AmountValue } from '../../schemas/amountExpressionSchema';

const iso = (value: string) => toISODateString(value);
const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(ERSTATNINGSOPGOERELSE_INITIAL_VALUES);
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
    expect(hasError(values, 'positive heltal')).toBe(true);
  });

  it('afviser negativ brøk', () => {
    const values = makeValues({ forligAnsvarsgradBroek: '-1/3' });
    expect(hasError(values, 'positive heltal')).toBe(true);
  });

  it('afviser decimal-brøk', () => {
    const values = makeValues({ forligAnsvarsgradBroek: '1.5/2.5' });
    expect(hasError(values, 'positive heltal')).toBe(true);
  });

  it('afviser samtidig procent og brøk', () => {
    const values = makeValues({
      forligAnsvarsgradProcent: 50,
      forligAnsvarsgradBroek: '1/3',
    });
    expect(hasError(values, 'enten procent eller brøk')).toBe(true);
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
    expect(hasError(values, 'Fra-dato må ikke være efter til-dato')).toBe(true);
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
