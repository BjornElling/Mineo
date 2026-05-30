import { describe, it, expect } from 'vitest';
import { migratePersistedSectionValue } from '../../utils/persistenceMigrations';

describe('migratePersistedSectionValue', () => {
  it('normaliserer null -> undefined dybt før migrator-trinnet (schema-evolution §3.1a)', () => {
    const input = {
      a: null,
      b: { c: null, d: 1 },
      e: [null, { f: null }],
    };

    const { value } = migratePersistedSectionValue('stamdata', input);

    // Kontrakt-rækkefølge: nullToUndefinedDeep (trin 1) skal være anvendt på input,
    // så en fremtidig sektion-migrator (trin 2) altid ser undefined frem for null.
    expect(value).toEqual({
      a: undefined,
      b: { c: undefined, d: 1 },
      e: [undefined, { f: undefined }],
    });
  });

  it('returnerer ingen issues når der ikke findes en eksplicit migrator for sektionen', () => {
    const { issues } = migratePersistedSectionValue('satser', { aargang: 2025 });
    expect(issues).toEqual([]);
  });

  it('bevarer ikke-null-værdier uændret', () => {
    const input = { aargang: 2025, navn: 'Test', flag: false, tom: '' };
    const { value } = migratePersistedSectionValue('satser', input);
    expect(value).toEqual(input);
  });
});
