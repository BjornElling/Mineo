import { parseAmountInput } from '../../utils/expressionAmount';
import { roundHalfAwayFromZero } from '../../utils/formatUtils';

const parse = (input: string, overrides?: Partial<Parameters<typeof parseAmountInput>[1]>) =>
  parseAmountInput(input, {
    precision: 2,
    allowNegative: true,
    round: (value) => roundHalfAwayFromZero(value, 2),
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

  it('parses expressions and normalizes grouping separators', () => {
    const result = parse('1.000 + 2,5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('expression');
    expect(result.value?.value).toBe(1002.5);
    expect(result.normalizedExpression).toBe('1000 + 2,5');
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

  it('accepts leading zeros in numbers', () => {
    const result = parse('007');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.kind).toBe('number');
    expect(result.value?.value).toBe(7);
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

  it('returns undefined for empty input', () => {
    const result = parse('   ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeUndefined();
    expect(result.isExpression).toBe(false);
  });
});
