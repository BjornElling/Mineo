import {
  amountExpressionSchema,
  amountNumberSchema,
  amountValueSchema,
  optionalAmountValueSchema,
} from '../../schemas/amountExpressionSchema';
import * as expressionAmountModule from '../../utils/expressionAmount';

describe('amountExpressionSchema', () => {
  it('bevarer AmountValue round-trip ved save/load for expression', () => {
    const original = {
      kind: 'expression' as const,
      expression: '1000+500,50',
      value: 1500.5,
    };

    const json = JSON.stringify(original);
    const loaded = JSON.parse(json) as unknown;
    const parsed = amountValueSchema.parse(loaded);

    expect(parsed).toEqual(original);
  });

  it('normaliserer floating-point artefakt (0.1 + 0.2) til 2 decimaler', () => {
    const parsed = amountNumberSchema.parse({
      kind: 'number',
      value: 0.1 + 0.2,
    });

    expect(parsed.value).toBe(0.3);
  });

  it('accepterer almindelige decimalbeløb trods binær floating-point-støj ved skalering', () => {
    expect(amountNumberSchema.parse({ kind: 'number', value: 0.29 }).value).toBe(0.29);
  });

  it('normaliserer videnskabelig notation deterministisk til schema-precision', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const parsed = amountNumberSchema.parse({
      kind: 'number',
      value: 1e-7,
    });
    warnSpy.mockRestore();

    expect(parsed.value).toBe(0);
  });

  it('bevarer canonical nul i expression-schema', () => {
    const parsed = amountExpressionSchema.parse({
      kind: 'expression',
      expression: '0-0',
      value: 0,
    });

    expect(parsed.value).toBe(0);
    expect(Object.is(parsed.value, -0)).toBe(false);
  });

  it('normaliserer stadig til 2 decimaler når parseAmountInput fejler internt', () => {
    const parseSpy = vi.spyOn(expressionAmountModule, 'parseAmountInput').mockReturnValue({
      ok: false,
      error: { kind: 'number', message: 'forced test failure' },
    });

    const parsed = amountNumberSchema.parse({
      kind: 'number',
      value: 1.239,
    });

    expect(parsed.value).toBe(1.24);
    parseSpy.mockRestore();
  });

  it('afviser persisted beløb som ikke kan bevares eksakt i øre', () => {
    expect(amountNumberSchema.safeParse({
      kind: 'number',
      value: 70_368_744_177_663.99,
    }).success).toBe(true);
    expect(amountNumberSchema.safeParse({
      kind: 'number',
      value: 70_368_744_177_664,
    }).success).toBe(false);
    expect(amountExpressionSchema.safeParse({
      kind: 'expression',
      expression: '70368744177663,99+0,01',
      value: 70_368_744_177_664,
    }).success).toBe(false);
  });

  it('afviser manipulerede eller ikke-canonical beløbsudtryk fail-closed', () => {
    expect(amountExpressionSchema.safeParse({
      kind: 'expression',
      expression: '100+25',
      value: 999,
    }).success).toBe(false);
    expect(amountExpressionSchema.safeParse({
      kind: 'expression',
      expression: '1.000+25',
      value: 1025,
    }).success).toBe(false);
    expect(amountExpressionSchema.safeParse({
      kind: 'expression',
      expression: '125',
      value: 125,
    }).success).toBe(false);
    expect(amountExpressionSchema.safeParse({
      kind: 'expression',
      expression: '100+25',
      value: 125.001,
    }).success).toBe(false);
  });

  it('parser persisted beløbstekst gennem den canonical settle-parser', () => {
    expect(optionalAmountValueSchema.parse('1.234,56')).toEqual({
      kind: 'number',
      value: 1234.56,
    });
    expect(optionalAmountValueSchema.parse('1.000+2,50')).toEqual({
      kind: 'expression',
      expression: '1000+2,50',
      value: 1002.5,
    });
  });

  it('afviser malformed persisted beløbstekst uden prefix-parsing eller implicit clear', () => {
    expect(optionalAmountValueSchema.safeParse('123abc').success).toBe(false);
    expect(optionalAmountValueSchema.safeParse('1+').success).toBe(false);
    expect(optionalAmountValueSchema.safeParse('()').success).toBe(false);
    expect(optionalAmountValueSchema.safeParse('-').success).toBe(false);
  });
});
