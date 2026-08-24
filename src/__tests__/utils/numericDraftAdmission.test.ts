import { isAmountExpressionDraftAllowed } from '../../utils/numericDraftAdmission';

describe('isAmountExpressionDraftAllowed', () => {
  it('afviser et andet decimalkomma i samme talled', () => {
    expect(isAmountExpressionDraftAllowed('1,2,3')).toBe(false);
    expect(isAmountExpressionDraftAllowed('1000,002000,')).toBe(false);
  });

  it('tillader ét decimalkomma i hvert talled i et beløbsudtryk', () => {
    expect(isAmountExpressionDraftAllowed('1,5+2,5')).toBe(true);
  });
});
