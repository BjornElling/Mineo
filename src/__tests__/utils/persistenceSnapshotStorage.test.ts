// @vitest-environment jsdom
import { PERSISTED_SECTION_KEYS, type PersistedSectionMap } from '../../config/persistenceRegistry';
import { getStorageKey } from '../../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import type { PersistedData } from '../../types/persistence';
import type { FormPersistenceSections } from '../../stores/formPersistenceStore';
import { atomicWritePersistenceSections } from '../../utils/persistenceSnapshotStorage';
import { buildSessionStorageHydrationPlan } from '../../utils/persistenceSessionHydration';

const emptySections = (): FormPersistenceSections => {
  return PERSISTED_SECTION_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as FormPersistenceSections);
};

const parseStoredSection = <K extends keyof PersistedSectionMap>(key: K): PersistedData | null => {
  const raw = sessionStorage.getItem(getStorageKey(key));
  return raw ? JSON.parse(raw) as PersistedData : null;
};

describe('persistenceSnapshotStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('skriver snapshot som kan hydreres tilbage', () => {
    const sections = emptySections();
    sections.satser = { aargang: 2025 };

    atomicWritePersistenceSections(sections, () => undefined);

    expect(parseStoredSection('satser')?.version).toBe(PERSISTED_DATA_VERSION);
    const hydrated = buildSessionStorageHydrationPlan();
    expect(hydrated.sections.satser).toEqual({ aargang: 2025 });
  });

  it('skriver intet ved pre-write schema-fejl', () => {
    const sections = emptySections();
    sections.satser = { aargang: 'ugyldig' } as unknown as FormPersistenceSections['satser'];

    expect(() => atomicWritePersistenceSections(sections, () => undefined)).toThrow(
      'Kan ikke forberede persistence-snapshot'
    );
    expect(sessionStorage.getItem(getStorageKey('satser'))).toBeNull();
  });

  it('ruller storage tilbage ved commit-fejl efter skrivning', () => {
    const existing: PersistedData = {
      version: PERSISTED_DATA_VERSION,
      timestamp: 1,
      data: { aargang: 2024 },
    };
    sessionStorage.setItem(getStorageKey('satser'), JSON.stringify(existing));
    const sections = emptySections();
    sections.satser = { aargang: 2025 };

    expect(() => atomicWritePersistenceSections(sections, () => {
      throw new Error('commit-fejl');
    })).toThrow('Kunne ikke skrive persistence-snapshot atomisk');

    expect(parseStoredSection('satser')?.data).toEqual({ aargang: 2024 });
  });

  it('sletter null-sektioner og kan hydrere toRemove-stien', () => {
    sessionStorage.setItem(
      getStorageKey('satser'),
      JSON.stringify({
        version: PERSISTED_DATA_VERSION,
        timestamp: 1,
        data: { aargang: 2024 },
      } satisfies PersistedData)
    );
    const sections = emptySections();

    atomicWritePersistenceSections(sections, () => undefined);

    expect(sessionStorage.getItem(getStorageKey('satser'))).toBeNull();
    expect(buildSessionStorageHydrationPlan().sections.satser).toBeNull();
  });

  it('ruller fjernede null-sektioner tilbage ved commit-fejl efter remove', () => {
    const existing: PersistedData = {
      version: PERSISTED_DATA_VERSION,
      timestamp: 1,
      data: { aargang: 2024 },
    };
    sessionStorage.setItem(getStorageKey('satser'), JSON.stringify(existing));
    const sections = emptySections();

    expect(() => atomicWritePersistenceSections(sections, () => {
      throw new Error('commit-fejl');
    })).toThrow('Kunne ikke skrive persistence-snapshot atomisk');

    expect(parseStoredSection('satser')?.data).toEqual({ aargang: 2024 });
  });

  it('normaliserer remove-fejl under snapshot-skrivning', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const removeSpy = vi.spyOn(storageProto, 'removeItem').mockImplementation(() => {
      throw new DOMException('Quota', 'QuotaExceededError');
    });
    const sections = emptySections();

    expect(() => atomicWritePersistenceSections(sections, () => undefined)).toThrow(
      'Browserens midlertidige lager er fyldt'
    );

    removeSpy.mockRestore();
  });

  it('giver dansk fejl hvis backup ikke kan læses', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const getItemSpy = vi.spyOn(storageProto, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const sections = emptySections();
    sections.satser = { aargang: 2025 };

    expect(() => atomicWritePersistenceSections(sections, () => undefined)).toThrow(
      'Browserens midlertidige lager kunne ikke aflæses'
    );

    getItemSpy.mockRestore();
  });
});
