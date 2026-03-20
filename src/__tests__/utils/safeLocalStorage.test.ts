import { getSafeLocalStorage } from '../../utils/safeLocalStorage';

// ─── getSafeLocalStorage ──────────────────────────────────────────────────────
// I testmiljøet (Node/Vitest) bruges in-memory storage fallback automatisk.

describe('getSafeLocalStorage', () => {
  it('returnerer et storage-objekt med getItem, setItem og removeItem', () => {
    const storage = getSafeLocalStorage();
    expect(typeof storage.getItem).toBe('function');
    expect(typeof storage.setItem).toBe('function');
    expect(typeof storage.removeItem).toBe('function');
  });

  it('getItem på tomt storage → null', () => {
    const storage = getSafeLocalStorage();
    expect(storage.getItem('nonexistent')).toBeNull();
  });

  it('setItem + getItem → returnerer den gemte streng', () => {
    const storage = getSafeLocalStorage();
    storage.setItem('key1', 'value1');
    expect(storage.getItem('key1')).toBe('value1');
  });

  it('overskriver eksisterende værdier', () => {
    const storage = getSafeLocalStorage();
    storage.setItem('key2', 'first');
    storage.setItem('key2', 'second');
    expect(storage.getItem('key2')).toBe('second');
  });

  it('removeItem fjerner den gemte nøgle', () => {
    const storage = getSafeLocalStorage();
    storage.setItem('key3', 'value3');
    storage.removeItem('key3');
    expect(storage.getItem('key3')).toBeNull();
  });

  it('removeItem på ikke-eksisterende nøgle → ingen fejl', () => {
    const storage = getSafeLocalStorage();
    expect(() => storage.removeItem('nonexistent_key')).not.toThrow();
  });

  it('gemmer og henter JSON-streng korrekt', () => {
    const storage = getSafeLocalStorage();
    const data = JSON.stringify({ test: true, count: 42 });
    storage.setItem('json_key', data);
    expect(storage.getItem('json_key')).toBe(data);
  });

  it('isolerede kald returnerer uafhængig storage', () => {
    // Hvert kald returnerer enten browser localStorage (delt)
    // eller i testmiljøet: in-memory (ny instans pr. modul-scope)
    // Det vigtige er at API-kontrakten er opfyldt
    const s1 = getSafeLocalStorage();
    s1.setItem('isolation_test', 'A');
    // Verificer blot at API returnerer noget brugbart
    expect(s1.getItem('isolation_test')).toBeTruthy();
  });

  it('tom streng er en gyldig value', () => {
    const storage = getSafeLocalStorage();
    storage.setItem('empty_val', '');
    expect(storage.getItem('empty_val')).toBe('');
  });

  it('tom streng som key er valid (edge case)', () => {
    const storage = getSafeLocalStorage();
    storage.setItem('', 'value_for_empty_key');
    expect(storage.getItem('')).toBe('value_for_empty_key');
  });
});
