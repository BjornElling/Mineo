import {
  formatOverenskomstAmount,
  formatOverenskomstPercent,
  hasExactDisplayedAmountMatch,
  normalizeOptionalFreeText,
} from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';

describe('eoSharedUtils', () => {
  describe('normalizeOptionalFreeText', () => {
    it('trimmer udfyldt tekst', () => {
      expect(normalizeOptionalFreeText('  Test  ')).toBe('Test');
    });

    it('returnerer undefined for tom eller whitespace-only tekst', () => {
      expect(normalizeOptionalFreeText('   ')).toBeUndefined();
      expect(normalizeOptionalFreeText(undefined)).toBeUndefined();
    });
  });

  describe('hasExactDisplayedAmountMatch', () => {
    it('matcher værdier når den danske beløbsvisning er identisk', () => {
      expect(hasExactDisplayedAmountMatch(1000, 1000)).toBe(true);
      expect(hasExactDisplayedAmountMatch(1000.004, 1000)).toBe(true);
    });

    it('afviser værdier når den danske beløbsvisning afviger', () => {
      expect(hasExactDisplayedAmountMatch(1000.01, 1000.02)).toBe(false);
    });
  });

  describe('formatOverenskomstPercent', () => {
    it('returnerer bindestreg for tom værdi', () => {
      expect(formatOverenskomstPercent(null)).toBe('-');
      expect(formatOverenskomstPercent(undefined)).toBe('-');
    });

    it('formatterer decimalværdi som procent med to decimaler', () => {
      expect(formatOverenskomstPercent(0.1234)).toBe('12,34 %');
      expect(formatOverenskomstPercent(0)).toBe('0,00 %');
    });
  });

  describe('formatOverenskomstAmount', () => {
    it('returnerer bindestreg for tom værdi', () => {
      expect(formatOverenskomstAmount(null)).toBe('-');
      expect(formatOverenskomstAmount(undefined)).toBe('-');
    });

    it('formatterer beløb i dansk format', () => {
      expect(formatOverenskomstAmount(1234.5)).toBe('1.234,50');
    });
  });
});
