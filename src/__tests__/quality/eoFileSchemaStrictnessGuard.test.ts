import { eoFileDataSchema } from '../../schemas/eoFileSchema';

describe('eo file schema strictness guard', () => {
  it('afviser ukendt top-level nøgle i eoFileDataSchema', () => {
    const result = eoFileDataSchema.safeParse({
      __test_unknown_key: true,
    });

    expect(result.success).toBe(false);
  });
});
