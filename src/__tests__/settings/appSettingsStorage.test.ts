import { LOCAL_STORAGE_KEY, readLocalStorage, writeLocalStorage } from '../../settings/appSettingsStorage';

// ─── LOCAL_STORAGE_KEY ────────────────────────────────────────────────────────

describe('LOCAL_STORAGE_KEY', () => {
  it('er en ikke-tom streng', () => {
    expect(typeof LOCAL_STORAGE_KEY).toBe('string');
    expect(LOCAL_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it('indeholder "mineo" (navnekonvention)', () => {
    expect(LOCAL_STORAGE_KEY.toLowerCase()).toContain('mineo');
  });

  it('indeholder "v1" (versionsindikation)', () => {
    expect(LOCAL_STORAGE_KEY).toContain('v1');
  });
});

// ─── readLocalStorage / writeLocalStorage ────────────────────────────────────
// I testmiljøet (Node) bruges in-memory storage automatisk via getSafeLocalStorage.

describe('readLocalStorage', () => {
  it('ukendt nøgle → undefined', () => {
    const result = readLocalStorage('nonexistent_test_key_xyz_123');
    expect(result).toBeUndefined();
  });

  it('efter write → returnerer skrevet streng', () => {
    const key = 'test_rls_key_1';
    const value = JSON.stringify({ test: true });
    writeLocalStorage(key, value);
    expect(readLocalStorage(key)).toBe(value);
  });

  it('overskrivning → returnerer nyeste værdi', () => {
    const key = 'test_rls_key_2';
    writeLocalStorage(key, 'first_value');
    writeLocalStorage(key, 'second_value');
    expect(readLocalStorage(key)).toBe('second_value');
  });
});

describe('writeLocalStorage', () => {
  it('kaster ikke ved normal brug', () => {
    expect(() => writeLocalStorage('test_wls_key', 'test_value')).not.toThrow();
  });

  it('gemmer og henter JSON korrekt', () => {
    const key = 'test_wls_json';
    const obj = { foo: 'bar', count: 42, nested: { a: true } };
    writeLocalStorage(key, JSON.stringify(obj));
    const raw = readLocalStorage(key);
    expect(JSON.parse(raw!)).toEqual(obj);
  });

  it('tom streng som value er gyldig', () => {
    const key = 'test_wls_empty';
    writeLocalStorage(key, '');
    // Tom streng → undefined (implementation returnerer null → undefined for tomme strenge)
    // Eller tom streng direkte — afhænger af implementation
    const result = readLocalStorage(key);
    // Verificer blot at der ikke kastes, og at resultatet er string eller undefined
    expect(result === '' || result === undefined).toBe(true);
  });
});
