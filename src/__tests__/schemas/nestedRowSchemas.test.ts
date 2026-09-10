import { z } from 'zod';
import {
  aslAfgoerelseRowSchema,
  ferieperiodeRowSchema,
  loenindkomstAnsaettelsesforholdSchema,
  loenudviklingManuelProcentsatsRowSchema,
  loenudviklingManuelRowSchema,
  offentligeYdelserRowSchema,
  oevrigeKravRowSchema,
  rentekravRowSchema,
  standardLoenTableRowSchema,
  svieSmertePeriodeRowSchema,
  sygeferiegodtgoerelseAnsaettelsesforholdRowSchema,
  tafPeriodeRowSchema,
} from '../../schemas/formSchemas';

type NestedRowSchemaCase = Readonly<{
  name: string;
  schema: z.ZodType;
  requiredKey: string;
  invalidPath: readonly (string | number)[];
  valid: Record<string, unknown>;
  unknown: Record<string, unknown>;
  missing: Record<string, unknown>;
  invalid: Record<string, unknown>;
}>;

// Små literal-fixtures holder testen uafhængig af initialværdier, kataloger og validator-defaults.
// Hver række repræsenterer de fire relevante schema-partitioner: gyldig, ukendt, manglende og ugyldig.
const NESTED_ROW_SCHEMA_CASES: readonly NestedRowSchemaCase[] = [
  {
    name: 'standard løntabelrække',
    schema: standardLoenTableRowSchema,
    requiredKey: 'id',
    invalidPath: ['col0_dag'],
    valid: { id: 'row-1' },
    unknown: { id: 'row-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'row-1', col0_dag: 'ikke-en-dato' },
  },
  {
    name: 'nested ansættelsesforholdrække',
    schema: loenindkomstAnsaettelsesforholdSchema,
    requiredKey: 'id',
    invalidPath: ['loenperiode'],
    valid: { id: 'af-1' },
    unknown: { id: 'af-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'af-1', loenperiode: 'aar' },
  },
  {
    name: 'rentekravrække',
    schema: rentekravRowSchema,
    requiredKey: 'id',
    invalidPath: ['enhed'],
    valid: { id: 'row-1', enhed: 'dage' },
    unknown: { id: 'row-1', enhed: 'dage', ukendtFelt: true },
    missing: { enhed: 'dage' },
    invalid: { id: 'row-1', enhed: 'timer' },
  },
  {
    name: 'svie- og smerteperiode',
    schema: svieSmertePeriodeRowSchema,
    requiredKey: 'id',
    invalidPath: ['tilstand'],
    valid: { id: 'row-1' },
    unknown: { id: 'row-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'row-1', tilstand: 'ukendt-tilstand' },
  },
  {
    name: 'TAF-periode',
    schema: tafPeriodeRowSchema,
    requiredKey: 'id',
    invalidPath: ['loseFeriedage'],
    valid: { id: 'row-1' },
    unknown: { id: 'row-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'row-1', loseFeriedage: 'ikke-et-tal' },
  },
  {
    name: 'ferieperiode',
    schema: ferieperiodeRowSchema,
    requiredKey: 'id',
    invalidPath: ['fra'],
    valid: { id: 'row-1' },
    unknown: { id: 'row-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'row-1', fra: '2024-02-30' },
  },
  {
    name: 'sygeferiegodtgørelsesansættelsesforhold',
    schema: sygeferiegodtgoerelseAnsaettelsesforholdRowSchema,
    requiredKey: 'ansaettelsesforholdId',
    invalidPath: ['sfggBeregningskilde'],
    valid: { ansaettelsesforholdId: 'af-1' },
    unknown: { ansaettelsesforholdId: 'af-1', ukendtFelt: true },
    missing: {},
    invalid: { ansaettelsesforholdId: 'af-1', sfggBeregningskilde: 'ukendt-kilde' },
  },
  {
    name: 'øvrigt erstatningskrav',
    schema: oevrigeKravRowSchema,
    requiredKey: 'id',
    invalidPath: ['dato'],
    valid: { id: 'row-1' },
    unknown: { id: 'row-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'row-1', dato: 'ugyldig-dato' },
  },
  {
    name: 'offentlig ydelse',
    schema: offentligeYdelserRowSchema,
    requiredKey: 'id',
    invalidPath: ['fraDato'],
    valid: { id: 'row-1' },
    unknown: { id: 'row-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'row-1', fraDato: 'ugyldig-dato' },
  },
  {
    name: 'manuel lønudvikling',
    schema: loenudviklingManuelRowSchema,
    requiredKey: 'id',
    invalidPath: ['feriepenge'],
    valid: { id: 'row-1' },
    unknown: { id: 'row-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'row-1', feriepenge: 'ikke-en-procent' },
  },
  {
    name: 'manuel lønudvikling med procentsats',
    schema: loenudviklingManuelProcentsatsRowSchema,
    requiredKey: 'id',
    invalidPath: ['procent'],
    valid: { id: 'row-1' },
    unknown: { id: 'row-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'row-1', procent: 'ikke-en-procent' },
  },
  {
    name: 'ASL-afgørelse',
    schema: aslAfgoerelseRowSchema,
    requiredKey: 'id',
    invalidPath: ['afgoerelsesDato'],
    valid: { id: 'row-1' },
    unknown: { id: 'row-1', ukendtFelt: true },
    missing: {},
    invalid: { id: 'row-1', afgoerelsesDato: 'ugyldig-dato' },
  },
];

describe('nested row-schemas', () => {
  it.each(NESTED_ROW_SCHEMA_CASES)('$name accepterer en minimal literal-række', ({ schema, valid }) => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(NESTED_ROW_SCHEMA_CASES)('$name afviser ukendt felt', ({ schema, unknown }) => {
    const result = schema.safeParse(unknown);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it.each(NESTED_ROW_SCHEMA_CASES)('$name afviser manglende identitetsfelt', ({ schema, requiredKey, missing }) => {
    const result = schema.safeParse(missing);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => (
        issue.code === 'invalid_type'
        && issue.path.length === 1
        && issue.path[0] === requiredKey
      ))).toBe(true);
    }
  });

  it.each(NESTED_ROW_SCHEMA_CASES)('$name afviser ugyldig feltværdi i den relevante partition', ({ schema, invalid, invalidPath }) => {
    const result = schema.safeParse(invalid);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => (
        issue.path.length === invalidPath.length
        && issue.path.every((segment, index) => segment === invalidPath[index])
      ))).toBe(true);
    }
  });
});
