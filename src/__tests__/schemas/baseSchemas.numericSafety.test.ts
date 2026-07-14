import { decimalNumber, wholeNumber } from '../../schemas/formSchemas/baseSchemas';

describe('formularschemaernes numeriske sikkerhed', () => {
  it('afviser usikre heltal fra både canonical number og legacy-streng', () => {
    expect(wholeNumber.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(true);
    expect(wholeNumber.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
    expect(wholeNumber.safeParse('9007199254740992').success).toBe(false);
  });

  it('afviser decimalværdier der ikke kan bevares ved feltets to decimaler', () => {
    expect(decimalNumber.safeParse(0.29).success).toBe(true);
    expect(decimalNumber.safeParse(1.234).success).toBe(false);
    expect(decimalNumber.safeParse(70_368_744_177_663.99).success).toBe(true);
    expect(decimalNumber.safeParse(70_368_744_177_664).success).toBe(false);
    expect(decimalNumber.safeParse('90071992547409,92').success).toBe(false);
  });
});
