import {
  DOCUMENT_MAANEDER_DECIMALS,
  formatDocumentMaanederFixed,
  formatDocumentMaanederTrimmed,
} from '../../utils/documentMaanederFormatting';

describe('documentMaanederFormatting', () => {
  it('bruger dokumentets faste fem decimaler', () => {
    expect(DOCUMENT_MAANEDER_DECIMALS).toBe(5);
    expect(formatDocumentMaanederFixed(1)).toBe('1,00000');
  });

  it('afrunder half-away-from-zero i både fast og trimmed visning', () => {
    expect(formatDocumentMaanederFixed(1.2345651)).toBe('1,23457');
    expect(formatDocumentMaanederTrimmed(1.2345651)).toBe('1,23457');
    expect(formatDocumentMaanederTrimmed(-1.2345651)).toBe('-1,23457');
  });

  it('trimmer kun trailing nuller i den trimmede visning', () => {
    expect(formatDocumentMaanederFixed(2.5)).toBe('2,50000');
    expect(formatDocumentMaanederTrimmed(2.5)).toBe('2,5');
  });

  it('viser bindestreg for ikke-finite input', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(formatDocumentMaanederFixed(value)).toBe('-');
      expect(formatDocumentMaanederTrimmed(value)).toBe('-');
    }
  });
});
