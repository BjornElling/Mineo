// @vitest-environment jsdom
import {
  UI_STORAGE_KEYS,
  isValidStorageKey,
  createActiveTabStorageKey,
  getCurrentInputEnvelopeStorageKey,
  setStorageNamespace,
  getStorageNamespace,
} from '../../config/storageManifest';

describe('UI_STORAGE_KEYS', () => {
  it('alle keys er unikke', () => {
    const values = Object.values(UI_STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('alle keys har mineo-prefix i default-namespace', () => {
    for (const key of Object.values(UI_STORAGE_KEYS)) {
      expect(key.startsWith('mineo_')).toBe(true);
    }
  });
});

describe('getCurrentInputEnvelopeStorageKey', () => {
  it('er den ene envelope-nøgle for sagsinput', () => {
    expect(getCurrentInputEnvelopeStorageKey()).toBe('mineo_input_v2');
  });
});

describe('isValidStorageKey', () => {
  it('kendte UI_STORAGE_KEYS er gyldige', () => {
    for (const key of Object.values(UI_STORAGE_KEYS)) {
      expect(isValidStorageKey(key)).toBe(true);
    }
  });

  it('inputenvelopen er gyldig', () => {
    expect(isValidStorageKey(getCurrentInputEnvelopeStorageKey())).toBe(true);
  });

  it('activeTab-keys er gyldige', () => {
    expect(isValidStorageKey('mineo_ui_activeTab_erstatningsopgoerelse')).toBe(true);
    expect(isValidStorageKey('mineo_ui_activeTab_aarsloen')).toBe(true);
  });

  it('ukendte keys er ugyldige', () => {
    expect(isValidStorageKey('unknown_key')).toBe(false);
    expect(isValidStorageKey('')).toBe(false);
    expect(isValidStorageKey('mineo_ukend')).toBe(false);
  });

  /**
   * De slettede legacy-nøgler må ikke kunne skrives igen. Skrivevagten i AST-harnessen bruger
   * `isValidStorageKey` som sit hvidlistetjek, så en genindført per-sektion-nøgle eller
   * `invalidDrafts`-kanal skal fejle her (greenfield trin 13 — modellen er slettet, ikke udskudt).
   */
  it('afviser de slettede per-sektion- og invalidDrafts-nøgler', () => {
    for (const deleted of [
      'mineo_stamdata',
      'mineo_satser',
      'mineo_aarsloen',
      'mineo_faellesAarsloen',
      'mineo_renteberegning',
      'mineo_varigemen',
      'mineo_forsoergertab',
      'mineo_erstatningsopgoerelse',
      'mineo_erhvervsevnetab',
      'mineo_invalidDrafts',
      'mineo_input',
    ]) {
      expect(isValidStorageKey(deleted), `${deleted} må ikke være en gyldig storage-nøgle`).toBe(false);
    }
  });
});

describe('createActiveTabStorageKey', () => {
  it('genererer key med korrekt prefix', () => {
    expect(createActiveTabStorageKey('erstatningsopgoerelse')).toBe('mineo_ui_activeTab_erstatningsopgoerelse');
  });

  it('genererede keys er gyldige iht. isValidStorageKey', () => {
    expect(isValidStorageKey(createActiveTabStorageKey('aarsloen'))).toBe(true);
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

  it('setStorageNamespace ændrer inputenvelope-, UI- og activeTab-keys', () => {
    setStorageNamespace('minprocesrente');
    expect(getCurrentInputEnvelopeStorageKey()).toBe('minprocesrente_input_v2');
    expect(UI_STORAGE_KEYS.sideMenuExpanded).toBe('minprocesrente_sideMenuExpanded');
    expect(createActiveTabStorageKey('aarsloen')).toBe('minprocesrente_ui_activeTab_aarsloen');
  });

  it('mineo og minprocesrente deler aldrig samme inputenvelope-key', () => {
    setStorageNamespace('mineo');
    const mineoKey = getCurrentInputEnvelopeStorageKey();
    setStorageNamespace('minprocesrente');
    expect(getCurrentInputEnvelopeStorageKey()).not.toBe(mineoKey);
  });

  it('isValidStorageKey følger aktivt namespace', () => {
    setStorageNamespace('minprocesrente');
    expect(isValidStorageKey('minprocesrente_input_v2')).toBe(true);
    // Mineos key er ikke gyldig i standalone-namespace — netop pointen med isolationen.
    expect(isValidStorageKey('mineo_input_v2')).toBe(false);
  });

  it('activeTab-præfikset er også namespace-isoleret', () => {
    setStorageNamespace('minprocesrente');
    expect(isValidStorageKey('minprocesrente_ui_activeTab_aarsloen')).toBe(true);
    expect(isValidStorageKey('mineo_ui_activeTab_aarsloen')).toBe(false);
  });
});
