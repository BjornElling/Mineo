import { erstatningsopgoerelseSchema } from '../../schemas/formSchemas';

describe('TD-019 – erstatningsopgørelsens obligatoriske top-level-felt', () => {
  it('rapporterer manglende ansættelsesforholdssamling som en konkret Zod-issue', () => {
    const result = erstatningsopgoerelseSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([{
        expected: 'array',
        code: 'invalid_type',
        path: ['loenindkomstAnsaettelsesforhold'],
        message: 'Invalid input: expected array, received undefined',
      }]);
    }
  });
});
