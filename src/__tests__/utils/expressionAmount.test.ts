import { parseAmountInput } from '../../utils/expressionAmount';

const parse = (input: string, overrides?: Partial<Parameters<typeof parseAmountInput>[1]>) =>
  parseAmountInput(input, {
    precision: 2,
    allowNegative: true,
    ...overrides,
  });

describe('parseAmountInput', () => {
  it('parses plain numbers with grouping and comma decimals', () => {
    const result = parse('1.000,50');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isExpression).toBe(false);
    expect(result.value?.kind).toBe('number');
    expect(result.value?.value).toBe(1000.5);
  });

  it('parses decimal input without losing ore due to floating representation', () => {
    const result = parse('2130,72');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.isExpression).toBe(false);
    expect(result.value?.kind).toBe('number');
    expect(result.value?.value).toBe(2130.72);
  });

  it('parses expressions and normalizes grouping separators', () => {
    const result = parse('1.000 + 2,5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(1002.5);
    expect(result.normalizedExpression).toBe('1000 + 2,5');
  });

  it('evaluates decimal expressions deterministically without floating ore-loss', () => {
    const result = parse('2130,72+535,56');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(2666.28);
    expect(result.normalizedExpression).toBe('2130,72+535,56');
  });

  it('does not truncate expression operands before evaluation', () => {
    const result = parse('1,239+0,009');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(1.25);
    expect(result.normalizedExpression).toBe('1,239+0,009');
  });

  it('supports unary minus in expressions', () => {
    const result = parse('2*-3');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(-6);
  });

  it('handles parentheses with unary minus', () => {
    const result = parse('-(2+3)');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(-5);
  });

  it('supports nested unary operators', () => {
    const result = parse('(-(-5))');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(5);
  });

  it('respects operator precedence (2+3*4 = 14)', () => {
    const result = parse('2+3*4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(14);
  });

  it('respects operator precedence in mixed chain (10-2*3+4/2 = 6)', () => {
    const result = parse('10-2*3+4/2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(6);
  });

  it('respects operator precedence across multiple products (2*3+4*5 = 26)', () => {
    const result = parse('2*3+4*5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(26);
  });

  it('accepts leading zeros in numbers', () => {
    const result = parse('007');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('number');
    expect(result.value?.value).toBe(7);
  });

  it('rounds decimals beyond precision for plain numbers', () => {
    const result = parse('1,235');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('number');
    expect(result.value?.value).toBe(1.24);
  });

  it('rounds expression results beyond precision', () => {
    const result = parse('1/8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(0.13);
  });

  it('rounds half values away from zero for negative results', () => {
    const result = parse('-1/8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(-0.13);
  });

  it('accepts trailing decimal separator in plain numbers', () => {
    const result = parse('18,');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('number');
    expect(result.value?.value).toBe(18);
  });

  it('returns undefined when input has no digits', () => {
    const result = parse('() + -');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeUndefined();
  });

  it('returns undefined for empty input variants', () => {
    const resultWhitespace = parse('   ');
    expect(resultWhitespace.ok).toBe(true);
    if (!resultWhitespace.ok) return;
    expect(resultWhitespace.value).toBeUndefined();

    const resultParens = parse('()');
    expect(resultParens.ok).toBe(true);
    if (!resultParens.ok) return;
    expect(resultParens.value).toBeUndefined();

    const resultPlus = parse('+');
    expect(resultPlus.ok).toBe(true);
    if (!resultPlus.ok) return;
    expect(resultPlus.value).toBeUndefined();
  });

  it('normalizes negative zero to zero', () => {
    const result = parse('-0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('number');
    expect(result.value?.value).toBe(0);
    expect(Object.is(result.value?.value, -0)).toBe(false);
  });

  it('reports invalid characters in expressions', () => {
    const result = parse('1a+2');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('expression');
    expect(result.error.message).toBe('Ugyldigt tegn');
  });

  it('reports unbalanced parentheses', () => {
    const result = parse('1+(2');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('expression');
    expect(result.error.message).toBe('Manglende slutparentes');
  });

  it('reports division by zero', () => {
    const result = parse('4/0');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('expression');
    expect(result.error.message).toBe('Division med 0');
  });

  it('rejects too many integer digits when configured', () => {
    const result = parse('1234', { maxIntegerDigits: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('number');
    expect(result.error.message).toBe('Beløb er for stort');
  });

  it('rejects input exceeding max raw length', () => {
    const result = parse('1+23', { maxRawLength: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('number');
    expect(result.error.message).toBe('Ugyldigt beløb');
  });

  it('rejects negative numbers when configured', () => {
    const result = parse('-1', { allowNegative: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('number');
    expect(result.error.message).toBe('Beløb kan ikke være negativt');
  });
});
