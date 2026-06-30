// @vitest-environment jsdom
import {
  STORAGE_KEYS,
  UI_STORAGE_KEYS,
  getStorageKey,
  isValidStorageKey,
  createActiveTabStorageKey,
  getKnownStorageKeys,
  setStorageNamespace,
  getStorageNamespace,
} from '../../config/storageManifest';
import type { StorageKey } from '../../config/storageManifest';

describe('STORAGE_KEYS', () => {
  it('indeholder alle forventede pagekeys', () => {
    expect(STORAGE_KEYS).toHaveProperty('stamdata');
    expect(STORAGE_KEYS).toHaveProperty('satser');
    expect(STORAGE_KEYS).toHaveProperty('aarsloen');
    expect(STORAGE_KEYS).toHaveProperty('renteberegning');
    expect(STORAGE_KEYS).toHaveProperty('varigemen');
    expect(STORAGE_KEYS).toHaveProperty('forsoergertab');
    expect(STORAGE_KEYS).toHaveProperty('erstatningsopgoerelse');
    expect(STORAGE_KEYS).toHaveProperty('erhvervsevnetab');
  });

  it('alle keys starter med "mineo_"', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(key).toMatch(/^mineo_/);
    }
  });

  it('alle keys er unikke', () => {
    const values = Object.values(STORAGE_KEYS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

describe('UI_STORAGE_KEYS', () => {
  it('alle UI keys er unikke', () => {
    const values = Object.values(UI_STORAGE_KEYS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('alle UI keys starter med "mineo_"', () => {
    for (const key of Object.values(UI_STORAGE_KEYS)) {
      expect(key).toMatch(/^mineo_/);
    }
  });
});

describe('getStorageKey', () => {
  it('returnerer korrekt sessionStorage key for stamdata', () => {
    expect(getStorageKey('stamdata')).toBe('mineo_stamdata');
  });

  it('returnerer korrekt key for erstatningsopgoerelse', () => {
    expect(getStorageKey('erstatningsopgoerelse')).toBe('mineo_erstatningsopgoerelse');
  });

  it('returnerer korrekt key for alle pageKeys', () => {
    const allPageKeys = Object.keys(STORAGE_KEYS) as StorageKey[];
    for (const pageKey of allPageKeys) {
      expect(getStorageKey(pageKey)).toBe(STORAGE_KEYS[pageKey]);
    }
  });
});

describe('isValidStorageKey', () => {
  it('kendte STORAGE_KEYS er gyldige', () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(isValidStorageKey(key)).toBe(true);
    }
  });

  it('kendte UI_STORAGE_KEYS er gyldige', () => {
    for (const key of Object.values(UI_STORAGE_KEYS)) {
      expect(isValidStorageKey(key)).toBe(true);
    }
  });

  it('dynamiske activeTab keys er gyldige', () => {
    expect(isValidStorageKey('mineo_ui_activeTab_erstatningsopgoerelse')).toBe(true);
    expect(isValidStorageKey('mineo_ui_activeTab_aarsloen')).toBe(true);
  });

  it('ukendte keys er ugyldige', () => {
    expect(isValidStorageKey('unknown_key')).toBe(false);
    expect(isValidStorageKey('')).toBe(false);
    expect(isValidStorageKey('mineo_ukend')).toBe(false);
  });
});

describe('createActiveTabStorageKey', () => {
  it('genererer key med korrekt prefix', () => {
    const key = createActiveTabStorageKey('erstatningsopgoerelse');
    expect(key).toBe('mineo_ui_activeTab_erstatningsopgoerelse');
  });

  it('genererede keys er gyldige iht. isValidStorageKey', () => {
    const key = createActiveTabStorageKey('aarsloen');
    expect(isValidStorageKey(key)).toBe(true);
  });
});

describe('getKnownStorageKeys', () => {
  it('medtager dynamiske activeTab-keys fra aktuelt namespace', () => {
    const activeTabKey = createActiveTabStorageKey('erstatningsopgoerelse');

    expect(getKnownStorageKeys([activeTabKey])).toContain(activeTabKey);
  });

  it('ignorerer keys fra andre namespaces', () => {
    setStorageNamespace('minprocesrente');
    try {
      expect(getKnownStorageKeys(['mineo_ui_activeTab_erstatningsopgoerelse'])).not.toContain(
        'mineo_ui_activeTab_erstatningsopgoerelse'
      );
    } finally {
      setStorageNamespace('mineo');
    }
  });
});

describe('storage namespace isolation', () => {
  afterEach(() => {
    // Gendan default-namespace, så mutationen ikke lækker til andre tests.
    setStorageNamespace('mineo');
  });

  it('default-namespace er "mineo"', () => {
    expect(getStorageNamespace()).toBe('mineo');
  });

  it('setStorageNamespace ændrer alle domæne-keys til det nye prefix', () => {
    setStorageNamespace('minprocesrente');
    expect(getStorageKey('renteberegning')).toBe('minprocesrente_renteberegning');
    expect(getStorageKey('stamdata')).toBe('minprocesrente_stamdata');
  });

  it('setStorageNamespace ændrer UI-keys og activeTab-keys', () => {
    setStorageNamespace('minprocesrente');
    expect(UI_STORAGE_KEYS.sideMenuExpanded).toBe('minprocesrente_sideMenuExpanded');
    expect(createActiveTabStorageKey('aarsloen')).toBe('minprocesrente_ui_activeTab_aarsloen');
  });

  it('mineo og minprocesrente deler aldrig samme renteberegning-key', () => {
    setStorageNamespace('mineo');
    const mineoKey = getStorageKey('renteberegning');
    setStorageNamespace('minprocesrente');
    const standaloneKey = getStorageKey('renteberegning');
    expect(mineoKey).not.toBe(standaloneKey);
  });

  it('isValidStorageKey følger aktivt namespace', () => {
    setStorageNamespace('minprocesrente');
    expect(isValidStorageKey('minprocesrente_renteberegning')).toBe(true);
    // Mineos key er ikke gyldig i standalone-namespace — netop pointen med isolationen.
    expect(isValidStorageKey('mineo_renteberegning')).toBe(false);
  });
});
