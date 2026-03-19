import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEYS,
  UI_STORAGE_KEYS,
  getStorageKey,
  isValidStorageKey,
  createActiveTabStorageKey,
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
