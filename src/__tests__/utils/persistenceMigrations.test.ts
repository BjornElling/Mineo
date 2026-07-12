import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import {
  createPersistenceMigrator,
  migratePersistedSectionValue,
  type PersistenceMigrationRegistry,
} from '../../utils/persistenceMigrations';

describe('migratePersistedSectionValue', () => {
  it('normaliserer null -> undefined dybt før migrator-trinnet (schema-evolution §3.1a)', () => {
    const input = {
      a: null,
      b: { c: null, d: 1 },
      e: [null, { f: null }],
    };

    const { value } = migratePersistedSectionValue('stamdata', input, PERSISTED_DATA_VERSION);

    // Kontrakt-rækkefølge: nullToUndefinedDeep (trin 1) skal være anvendt på input,
    // så en fremtidig sektion-migrator (trin 2) altid ser undefined frem for null.
    expect(value).toEqual({
      a: undefined,
      b: { c: undefined, d: 1 },
      e: [undefined, { f: undefined }],
    });
  });

  it('returnerer ingen issues når der ikke findes en eksplicit migrator for sektionen', () => {
    const { issues } = migratePersistedSectionValue('satser', { aargang: 2025 }, '1.0');
    expect(issues).toEqual([]);
  });

  it('bevarer ikke-null-værdier uændret', () => {
    const input = { aargang: 2025, navn: 'Test', flag: false, tom: '' };
    const { value } = migratePersistedSectionValue('satser', input, PERSISTED_DATA_VERSION);
    expect(value).toEqual(input);
  });

  it('kører den eksakte sektionsmigration fra kildeversion til current-version', () => {
    const registry = {
      stamdata: {
        '1.0': {
          toVersion: PERSISTED_DATA_VERSION,
          migrate: (value: unknown) => ({ value: { previous: value, current: true }, issues: [] }),
        },
      },
    } satisfies PersistenceMigrationRegistry;

    const migrate = createPersistenceMigrator(registry);
    const result = migrate('stamdata', { journalnr: 'J-1', tidligere: null }, '1.0');

    expect(result.value).toEqual({
      previous: { journalnr: 'J-1', tidligere: undefined },
      current: true,
    });
  });

  it('anvender kun migratorer for den konkrete sektion og kildeversion', () => {
    const registry = {
      stamdata: {
        '1.0': {
          toVersion: PERSISTED_DATA_VERSION,
          migrate: () => ({ value: { journalnr: 'migreret' }, issues: [] }),
        },
      },
    } satisfies PersistenceMigrationRegistry;
    const migrate = createPersistenceMigrator(registry);

    expect(migrate('satser', { aargang: 2025 }, '1.0').value).toEqual({ aargang: 2025 });
    expect(migrate('stamdata', { journalnr: 'J-1' }, '2.0').value).toEqual({ journalnr: 'J-1' });
  });
});
