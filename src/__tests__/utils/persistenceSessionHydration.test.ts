// @vitest-environment jsdom
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { getStorageKey } from '../../config/storageManifest';
import type { PersistedData } from '../../types/persistence';
import { buildSessionStorageHydrationPlan } from '../../utils/persistenceSessionHydration';

describe('persistenceSessionHydration', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  const writeSection = (key: 'satser', data: unknown, version = PERSISTED_DATA_VERSION): void => {
    const payload: PersistedData = {
      version,
      timestamp: Date.now(),
      data,
    };
    sessionStorage.setItem(getStorageKey(key), JSON.stringify(payload));
  };

  it('hydrater loadbare sektioner og rydder korrupte sektioner uden at crashe', () => {
    writeSection('satser', { aargang: 2025 });
    sessionStorage.setItem(getStorageKey('stamdata'), '{ikke-json');

    const plan = buildSessionStorageHydrationPlan();

    expect(plan.sections.satser).toEqual({ aargang: 2025 });
    expect(plan.sections.stamdata).toBeNull();
    expect(plan.keysToRemove).toContain(getStorageKey('stamdata'));
    expect(plan.notice?.type).toBe('error');
  });

  it('stripper ukendte felter og rapporterer dansk opstartsnotice', () => {
    writeSection('satser', { aargang: 2025, fjernes: true });

    const plan = buildSessionStorageHydrationPlan();

    expect(plan.sections.satser).toEqual({ aargang: 2025 });
    expect(plan.notice?.message).toContain('forældet felt');
  });

  it('starter uden sessiondata hvis sessionStorage ikke kan læses', () => {
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const getItemSpy = vi.spyOn(storageProto, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const plan = buildSessionStorageHydrationPlan();

    expect(plan.sections.satser).toBeNull();
    expect(plan.keysToRemove).toEqual([]);
    expect(plan.notice?.type).toBe('error');
    expect(plan.notice?.message).toContain('Gemte browserdata kunne ikke gennemgås');

    getItemSpy.mockRestore();
  });

  it('rapporterer versionsmismatch som validering med aktuel struktur', () => {
    writeSection('satser', { aargang: 2025 }, '1.0');

    const plan = buildSessionStorageHydrationPlan();

    expect(plan.sections.satser).toEqual({ aargang: 2025 });
    expect(plan.notice?.type).toBe('warning');
    expect(plan.notice?.message).toContain('anden dataversion blev valideret med den aktuelle struktur');
  });
});
