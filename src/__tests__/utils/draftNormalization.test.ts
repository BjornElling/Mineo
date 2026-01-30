import {
  trimWhitespaceEdges,
  trimToAlphanumericEdges,
  trimToNumericEdgesPreserveLeadingMinus,
  prefixZeroBeforeLeadingComma,
  stripAmountGroupingSeparators,
} from '../../utils/draftNormalization';

describe('trimWhitespaceEdges', () => {
  it('trims leading and trailing whitespace', () => {
    expect(trimWhitespaceEdges('  abc  ')).toBe('abc');
    expect(trimWhitespaceEdges('\n\t  abc\t')).toBe('abc');
  });

  it('returns empty string unchanged', () => {
    expect(trimWhitespaceEdges('')).toBe('');
  });
});

describe('trimToAlphanumericEdges', () => {
  it('trims to first and last letter or digit', () => {
    expect(trimToAlphanumericEdges('  10 % ')).toBe('10');
    expect(trimToAlphanumericEdges(' kr. 1.000,00 ')).toBe('kr. 1.000,00');
    expect(trimToAlphanumericEdges(' / 12/34 -')).toBe('12/34');
  });

  it('handles unicode letters and digits', () => {
    expect(trimToAlphanumericEdges('  åøæ  ')).toBe('åøæ');
    expect(trimToAlphanumericEdges('  رقم١٢٣  ')).toBe('رقم١٢٣');
  });

  it('returns empty string if no letters or digits are present', () => {
    expect(trimToAlphanumericEdges('---')).toBe('');
    expect(trimToAlphanumericEdges(' , . / ')).toBe('');
  });
});

describe('trimToNumericEdgesPreserveLeadingMinus', () => {
  it('extracts numeric core', () => {
    expect(trimToNumericEdgesPreserveLeadingMinus(' 123 ')).toBe('123');
    expect(trimToNumericEdgesPreserveLeadingMinus('abc100def')).toBe('100');
  });

  it('preserves a single leading minus before first digit', () => {
    expect(trimToNumericEdgesPreserveLeadingMinus('-100')).toBe('-100');
    expect(trimToNumericEdgesPreserveLeadingMinus('abc-100')).toBe('-100');
    expect(trimToNumericEdgesPreserveLeadingMinus('--100')).toBe('-100');
    expect(trimToNumericEdgesPreserveLeadingMinus('- 100')).toBe('- 100');
  });

  it('treats all unicode minus/hyphen characters as minus', () => {
    expect(trimToNumericEdgesPreserveLeadingMinus('−100')).toBe('-100'); // U+2212
    expect(trimToNumericEdgesPreserveLeadingMinus('–100')).toBe('-100'); // en dash
    expect(trimToNumericEdgesPreserveLeadingMinus('—100')).toBe('-100'); // em dash
    expect(trimToNumericEdgesPreserveLeadingMinus('abc−100')).toBe('-100');
  });

  it('collapses multiple minus types into a single ASCII minus', () => {
    expect(trimToNumericEdgesPreserveLeadingMinus('−–—100')).toBe('-100');
  });

  it('preserves leading decimal comma', () => {
    expect(trimToNumericEdgesPreserveLeadingMinus(',50')).toBe(',50');
    expect(trimToNumericEdgesPreserveLeadingMinus('-,50')).toBe('-,50');
    expect(trimToNumericEdgesPreserveLeadingMinus('kr. ,50')).toBe(',50');
    expect(trimToNumericEdgesPreserveLeadingMinus('kr. −,50')).toBe('-,50');
  });

  it('returns empty string if no digits are present', () => {
    expect(trimToNumericEdgesPreserveLeadingMinus('abc')).toBe('');
    expect(trimToNumericEdgesPreserveLeadingMinus('---')).toBe('');
    expect(trimToNumericEdgesPreserveLeadingMinus(',')).toBe('');
  });
});

describe('prefixZeroBeforeLeadingComma', () => {
  it('prefixes zero before leading comma', () => {
    expect(prefixZeroBeforeLeadingComma(',50')).toBe('0,50');
  });

  it('prefixes zero after minus and before comma', () => {
    expect(prefixZeroBeforeLeadingComma('-,50')).toBe('-0,50');
  });

  it('leaves other values unchanged', () => {
    expect(prefixZeroBeforeLeadingComma('0,50')).toBe('0,50');
    expect(prefixZeroBeforeLeadingComma('-0,50')).toBe('-0,50');
    expect(prefixZeroBeforeLeadingComma('')).toBe('');
  });
});

describe('stripAmountGroupingSeparators', () => {
  it('removes all dots aggressively', () => {
    expect(stripAmountGroupingSeparators('1.234.567')).toBe('1234567');
    expect(stripAmountGroupingSeparators('-1.000,50')).toBe('-1000,50');
  });

  it('leaves empty string unchanged', () => {
    expect(stripAmountGroupingSeparators('')).toBe('');
  });
});

describe('full amount normalization pipeline (integration sanity)', () => {
  it('handles typical Danish inputs', () => {
    const input = ' kr. −1.234,50 ';
    const step1 = trimWhitespaceEdges(input);
    const step2 = trimToNumericEdgesPreserveLeadingMinus(step1);
    const step3 = stripAmountGroupingSeparators(step2);
    const step4 = prefixZeroBeforeLeadingComma(step3);

    expect(step4).toBe('-1234,50');
  });

  it('handles leading decimal amounts', () => {
    const input = '−,50';
    const step1 = trimToNumericEdgesPreserveLeadingMinus(input);
    const step2 = prefixZeroBeforeLeadingComma(step1);

    expect(step2).toBe('-0,50');
  });
});
