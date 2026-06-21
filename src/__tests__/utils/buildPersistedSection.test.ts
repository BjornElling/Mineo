import { buildPersistedSection } from '../../utils/buildPersistedSection';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { persistenceSchemas, type PersistedSectionMap } from '../../config/persistenceRegistry';
import type { PersistedData } from '../../types/persistence';

describe('buildPersistedSection (delt gem-primitiv for de tre validér→serialiser→re-validér-stier)', () => {
  it('pakker gyldig sektion i { version, timestamp, data } og serialiserer reload-ækvivalent', () => {
    const result = buildPersistedSection('satser', { aargang: 2025 }, 12345);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.persistedData).toEqual<PersistedData>({
      version: PERSISTED_DATA_VERSION,
      timestamp: 12345,
      data: { aargang: 2025 },
    });
    expect(JSON.parse(result.serialized)).toEqual(result.persistedData);
    // validatedData er re-valideret gennem schemaet og kan hydreres tilbage uændret.
    expect(persistenceSchemas.satser.safeParse(result.validatedData).success).toBe(true);
    expect(result.validatedData).toEqual({ aargang: 2025 });
  });

  it('rapporterer schema-trin når data ikke matcher schemaet', () => {
    const result = buildPersistedSection(
      'satser',
      { aargang: 'ugyldig' } as unknown as PersistedSectionMap['satser'],
      0
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe('schema');
    expect(result.error?.issues.length ?? 0).toBeGreaterThan(0);
  });

  it('rapporterer config-trin når schemaet mangler for nøglen', () => {
    const result = buildPersistedSection(
      'ukendt' as unknown as 'satser',
      { aargang: 2025 },
      0
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stage).toBe('config');
    expect(result.error).toBeUndefined();
  });
});
