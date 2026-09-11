import {
  erstatningsopgoerelseSchema,
  type ErstatningsopgoerelseValues,
} from '../../schemas/formSchemas';
import { erstatningsopgoerelseValidator } from '../../validators/erstatningsopgoerelseValidator';

// Små literal-inputs holder denne kontrol uafhængig af initialværdier, defaults og
// produktionsfabrikker. Det eneste obligatoriske top-level-felt uden schema-default
// er ansættelsesforhold-samlingen.
const MINIMAL_LITERAL = {
  loenindkomstAnsaettelsesforhold: [],
} as const;

const VALIDATOR_LITERAL = {
  ...MINIMAL_LITERAL,
  kravPaaTabtArbejdsfortjeneste: 'Nej',
} as const;

const parseLiteral = (input: unknown): ErstatningsopgoerelseValues => {
  const result = erstatningsopgoerelseSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Testliteral kunne ikke parses: ${result.error.message}`);
  }
  return result.data;
};

describe('uafhængige validator-inputs', () => {
  describe('erstatningsopgoerelseSchema', () => {
    it('accepterer en minimal literal-sag', () => {
      const result = erstatningsopgoerelseSchema.safeParse(MINIMAL_LITERAL);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.loenindkomstAnsaettelsesforhold).toEqual([]);
      }
    });

    it('rapporterer ukendt top-level-felt som en faktisk Zod-issue', () => {
      const result = erstatningsopgoerelseSchema.safeParse({
        ...MINIMAL_LITERAL,
        ukendtFelt: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({
            code: 'unrecognized_keys',
            path: [],
            keys: ['ukendtFelt'],
          }),
        ]));
      }
    });

    it('rapporterer ugyldig enumværdi med den konkrete nested path', () => {
      const result = erstatningsopgoerelseSchema.safeParse({
        ...MINIMAL_LITERAL,
        loenindkomstAnsaettelsesforhold: [{
          id: 'af-literal',
          loenperiode: 'aar',
        }],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({
            code: 'invalid_value',
            path: ['loenindkomstAnsaettelsesforhold', 0, 'loenperiode'],
          }),
        ]));
      }
    });

    it('rapporterer ugyldigt heltalsinput som en faktisk Zod-issue', () => {
      const result = erstatningsopgoerelseSchema.safeParse({
        ...MINIMAL_LITERAL,
        eoAngivetLoenLoenudvikling: {
          offentligLoenTrin: 'abc',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({
            code: 'invalid_type',
            path: ['eoAngivetLoenLoenudvikling', 'offentligLoenTrin'],
            message: 'Skal være et heltal',
          }),
        ]));
      }
    });
  });

  describe('erstatningsopgoerelseValidator', () => {
    it.each([0, 100])('accepterer den gyldige ansvarsgradgrænse %s', (procent) => {
      const values = parseLiteral({
        ...VALIDATOR_LITERAL,
        forligAnsvarsgradProcent: procent,
      });

      const result = erstatningsopgoerelseValidator.validate(values);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rapporterer en overskredet ansvarsgrad med fast error-struktur', () => {
      const values = parseLiteral({
        ...VALIDATOR_LITERAL,
        forligAnsvarsgradProcent: 101,
      });

      const result = erstatningsopgoerelseValidator.validate(values);

      expect(result).toEqual({
        isValid: false,
        errors: [{
          path: 'forligAnsvarsgradProcent',
          message: 'Procent skal være mellem 0 og 100',
          severity: 'error',
        }],
      });
    });

    it('rapporterer nul i øvrige krav som en struktureret validatorfejl', () => {
      const values = parseLiteral({
        ...VALIDATOR_LITERAL,
        oevrigeKravPerioder: [{
          id: 'krav-literal',
          dato: '2024-01-01',
          udgiftTil: 'Transport',
          beloeb: { kind: 'number', value: 0 },
        }],
      });

      const result = erstatningsopgoerelseValidator.validate(values);

      expect(result).toEqual({
        isValid: false,
        errors: [{
          path: 'oevrigeKravPerioder[0].beloeb',
          message: 'Beløb skal være større end 0',
          severity: 'error',
        }],
      });
    });

    it('accepterer manuel SFGG-kilde med et aktivt literal-ansættelsesforhold', () => {
      const values = parseLiteral({
        ...VALIDATOR_LITERAL,
        kravPaaTabtArbejdsfortjeneste: 'Ja',
        beregnesUdFra: 'Angivet dagsløn',
        dagsloenenUdgoer: { kind: 'number', value: 500 },
        eoAngivetLoenLoenudvikling: {
          loenudviklingBeregningsgrundlag: 'Ingen',
        },
        loenindkomstAnsaettelsesforhold: [{
          id: 'af-sfgg-literal',
          ansatPaaSkadestidspunktet: true,
        }],
        sfggAnsaettelsesforhold: [{
          ansaettelsesforholdId: 'af-sfgg-literal',
          sfggBeregningskilde: 'Manuelt angivet',
          sfggManuelDagssats: { kind: 'number', value: 250 },
        }],
      });

      expect(erstatningsopgoerelseValidator.validate(values)).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('accepterer ASL-årslønsmaksimum som aktivt literal-statistikgrundlag', () => {
      const values = parseLiteral({
        ...VALIDATOR_LITERAL,
        kravPaaTabtArbejdsfortjeneste: 'Ja',
        beregnesUdFra: 'Angivet månedsløn',
        maanedsloenenUdgoer: { kind: 'number', value: 30000 },
        eoAngivetLoenLoenudvikling: {
          loenPaaHelligdage: 'Almindelig løn',
          loenudviklingBeregningsgrundlag: 'Statistik',
          loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
        },
      });

      expect(erstatningsopgoerelseValidator.validate(values)).toEqual({
        isValid: true,
        errors: [],
      });
    });
  });
});
