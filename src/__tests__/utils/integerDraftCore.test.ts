import { parseIntegerDraftForCommit } from '../../utils/integerDraftCore';

describe('parseIntegerDraftForCommit', () => {
  it('tom (efter trim) giver value undefined', () => {
    expect(parseIntegerDraftForCommit('   ', { allowNegative: false })).toEqual({ ok: true, value: undefined });
  });

  it('parser et heltal', () => {
    expect(parseIntegerDraftForCommit('42', { allowNegative: false })).toEqual({ ok: true, value: 42 });
  });

  it('afviser bogstaver med ensartet besked "Ugyldigt heltal"', () => {
    expect(parseIntegerDraftForCommit('12a', { allowNegative: false })).toEqual({
      ok: false,
      errorMessage: 'Ugyldigt heltal',
    });
  });

  it('afviser negativt tal når allowNegative=false', () => {
    expect(parseIntegerDraftForCommit('-5', { allowNegative: false })).toEqual({
      ok: false,
      errorMessage: 'Negative tal er ikke tilladt',
    });
  });

  it('tillader negativt tal når allowNegative=true', () => {
    expect(parseIntegerDraftForCommit('-5', { allowNegative: true })).toEqual({ ok: true, value: -5 });
  });

  it('håndhæver maxDigits på cifre (ekskl. fortegn)', () => {
    expect(parseIntegerDraftForCommit('1234', { allowNegative: true, maxDigits: 3 })).toEqual({
      ok: false,
      errorMessage: 'Maks 3 cifre',
    });
    expect(parseIntegerDraftForCommit('-123', { allowNegative: true, maxDigits: 3 })).toEqual({ ok: true, value: -123 });
  });

  it('udfører IKKE interval-validering (kalderen ejer min/max)', () => {
    expect(parseIntegerDraftForCommit('1000', { allowNegative: false })).toEqual({ ok: true, value: 1000 });
  });

  it('afviser heltal som Number.parseInt ellers ville afrunde stille', () => {
    expect(parseIntegerDraftForCommit('9007199254740991', { allowNegative: false }))
      .toEqual({ ok: true, value: Number.MAX_SAFE_INTEGER });
    expect(parseIntegerDraftForCommit('9007199254740992', { allowNegative: false }))
      .toEqual({ ok: false, errorMessage: 'Ugyldigt heltal' });
    expect(parseIntegerDraftForCommit('-9007199254740992', { allowNegative: true }))
      .toEqual({ ok: false, errorMessage: 'Ugyldigt heltal' });
  });
});
