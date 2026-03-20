import { ERROR_MESSAGES, CalculationError, getUserMessage, isCalculationError } from '../../utils/errorMessages';
import type { ErrorCode } from '../../utils/errorMessages';

describe('ERROR_MESSAGES', () => {
  it('alle beskeder er ikke-tomme strenge', () => {
    for (const [_key, message] of Object.entries(ERROR_MESSAGES)) {
      expect(typeof message).toBe('string');
      expect(message.trim().length).toBeGreaterThan(0);
    }
  });

  it('indeholder kategori-nøgler for dato, beløb, tabel, beregning, fil og PDF', () => {
    expect(ERROR_MESSAGES).toHaveProperty('INVALID_DATE_FORMAT');
    expect(ERROR_MESSAGES).toHaveProperty('NEGATIVE_AMOUNT');
    expect(ERROR_MESSAGES).toHaveProperty('TABLE_EMPTY');
    expect(ERROR_MESSAGES).toHaveProperty('DIVISION_BY_ZERO');
    expect(ERROR_MESSAGES).toHaveProperty('FILE_LOAD_FAILED');
    expect(ERROR_MESSAGES).toHaveProperty('PDF_GENERATION_FAILED');
    expect(ERROR_MESSAGES).toHaveProperty('UNKNOWN_ERROR');
  });

  it('kendte beskeder matcher forventede danske tekster', () => {
    expect(ERROR_MESSAGES.INVALID_DATE_FORMAT).toContain('dd-mm-åååå');
    expect(ERROR_MESSAGES.DIVISION_BY_ZERO).toContain('arbejdsdage');
    expect(ERROR_MESSAGES.FILE_CORRUPTED).toContain('korrupt');
  });
});

describe('CalculationError', () => {
  it('er instanceof Error', () => {
    const error = new CalculationError('DIVISION_BY_ZERO');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CalculationError);
  });

  it('name = "CalculationError"', () => {
    const error = new CalculationError('DIVISION_BY_ZERO');
    expect(error.name).toBe('CalculationError');
  });

  it('code matches given error code', () => {
    const error = new CalculationError('FILE_LOAD_FAILED');
    const code: ErrorCode = error.code;
    expect(code).toBe('FILE_LOAD_FAILED');
  });

  it('message = teknisk besked hvis givet', () => {
    const error = new CalculationError('CALCULATION_FAILED', 'teknisk årsag');
    expect(error.message).toBe('teknisk årsag');
  });

  it('message = bruger-besked hvis ingen teknisk besked', () => {
    const error = new CalculationError('DIVISION_BY_ZERO');
    expect(error.message).toBe(ERROR_MESSAGES.DIVISION_BY_ZERO);
  });

  it('cause bevares fra options-objekt', () => {
    const originalError = new Error('root cause');
    const error = new CalculationError('CALCULATION_FAILED', { cause: originalError });
    expect(error.cause).toBe(originalError);
  });

  it('stack trace er sat', () => {
    const error = new CalculationError('UNKNOWN_ERROR');
    expect(error.stack).toBeDefined();
  });

  it('alle ErrorCode-værdier kan bruges', () => {
    const codes: ErrorCode[] = Object.keys(ERROR_MESSAGES) as ErrorCode[];
    for (const code of codes) {
      expect(() => new CalculationError(code)).not.toThrow();
    }
  });
});

describe('getUserMessage', () => {
  it('CalculationError → returnerer korrekt bruger-besked', () => {
    const error = new CalculationError('DIVISION_BY_ZERO', 'teknisk årsag');
    const message = getUserMessage(error);
    expect(message).toBe(ERROR_MESSAGES.DIVISION_BY_ZERO);
  });

  it('generisk Error → returnerer UNKNOWN_ERROR besked', () => {
    const error = new Error('noget gik galt');
    const message = getUserMessage(error);
    expect(message).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
  });

  it('besked er altid en streng', () => {
    expect(typeof getUserMessage(new Error('test'))).toBe('string');
    expect(typeof getUserMessage(new CalculationError('FILE_LOAD_FAILED'))).toBe('string');
  });
});

describe('isCalculationError', () => {
  it('CalculationError → true', () => {
    const error = new CalculationError('VALIDATION_ERROR');
    expect(isCalculationError(error)).toBe(true);
  });

  it('generisk Error → false', () => {
    const error = new Error('ikke en CalculationError');
    expect(isCalculationError(error)).toBe(false);
  });

  it('fungerer som type guard', () => {
    const error: Error = new CalculationError('TABLE_EMPTY');
    if (isCalculationError(error)) {
      expect(error.code).toBe('TABLE_EMPTY');
    } else {
      throw new Error('Forventede CalculationError');
    }
  });
});
