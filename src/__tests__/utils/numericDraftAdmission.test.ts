import { isAmountExpressionDraftAllowed, isPercentDraftAllowed } from '../../utils/numericDraftAdmission';

describe('isAmountExpressionDraftAllowed', () => {
  it('afviser et andet decimalkomma i samme talled', () => {
    expect(isAmountExpressionDraftAllowed('1,2,3')).toBe(false);
    expect(isAmountExpressionDraftAllowed('1000,002000,')).toBe(false);
  });

  it('tillader ét decimalkomma i hvert talled i et beløbsudtryk', () => {
    expect(isAmountExpressionDraftAllowed('1,5+2,5')).toBe(true);
  });

  it('håndhæver maksimal decimalpræcision pr. talled', () => {
    expect(isAmountExpressionDraftAllowed('1,23+4,5', { maxDecimalDigits: 2 })).toBe(true);
    expect(isAmountExpressionDraftAllowed('1,234', { maxDecimalDigits: 2 })).toBe(false);
    expect(isAmountExpressionDraftAllowed('1,2a34', { maxIntegerDigits: 5, maxDecimalDigits: 2 })).toBe(false);
  });

  it('afviser unært minus når negative beløb ikke er tilladt', () => {
    expect(isAmountExpressionDraftAllowed('-1')).toBe(false);
  });
});

describe('isPercentDraftAllowed', () => {
  it('håndhæver maksimal heltalslængde', () => {
    expect(isPercentDraftAllowed('12', { maxIntegerDigits: 2 })).toBe(true);
    expect(isPercentDraftAllowed('123', { maxIntegerDigits: 2 })).toBe(false);
  });
});
