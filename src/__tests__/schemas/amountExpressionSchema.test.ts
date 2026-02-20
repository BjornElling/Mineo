import {
  amountExpressionSchema,
  amountNumberSchema,
  amountValueSchema,
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

  it('normaliserer videnskabelig notation deterministisk til schema-precision', () => {
    const parsed = amountNumberSchema.parse({
      kind: 'number',
      value: 1e-7,
    });

    expect(parsed.value).toBe(0);
  });

  it('normaliserer negativ nul til nul i expression-schema', () => {
    const parsed = amountExpressionSchema.parse({
      kind: 'expression',
      expression: '-0',
      value: -0,
    });

    expect(parsed.value).toBe(0);
    expect(Object.is(parsed.value, -0)).toBe(false);
  });

  it('normaliserer stadig til 2 decimaler når parseAmountInput fejler internt', () => {
    const parseSpy = vi.spyOn(expressionAmountModule, 'parseAmountInput').mockReturnValue({
      ok: false,
      error: 'forced test failure',
    });

    const parsed = amountNumberSchema.parse({
      kind: 'number',
      value: 1.239,
    });

    expect(parsed.value).toBe(1.24);
    parseSpy.mockRestore();
  });
});
