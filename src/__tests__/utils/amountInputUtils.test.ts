import { sanitizePastedAmount } from '../../utils/amountInputUtils';

describe('amountInputUtils', () => {
  it('removes all non-allowed characters on paste', () => {
    expect(sanitizePastedAmount('ab1c2,3d')).toBe('12,3');
  });
});
