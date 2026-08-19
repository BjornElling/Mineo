// @vitest-environment jsdom
import {
  UI_STORAGE_KEYS,
  isValidStorageKey,
  createActiveTabStorageKey,
  getCaseScopedSessionStorageKeys,
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

/**
 * Reset-policyen. At HVER nøgle er klassificeret håndhæves af compileren (`satisfies`); det, en test
 * kan tilføje, er at klassifikationen faktisk deler mængden – begge sider er ikke-tomme, og en nøgle kan ikke
 * være begge steder. En tom `caseScoped`-side ville gøre `Slet alt`s oprydning til en no-op, der ser grøn ud.
 */
describe('reset-policyen (getCaseScopedSessionStorageKeys)', () => {
  it('deler de statiske manifestnøgler i to ikke-tomme, disjunkte sider', () => {
    const caseScoped = getCaseScopedSessionStorageKeys();
    const allKeys = Object.values(UI_STORAGE_KEYS);
    const staticCaseScoped = caseScoped.filter((key) => allKeys.includes(key));
    const deviceScoped = allKeys.filter((key) => !staticCaseScoped.includes(key));

    expect(staticCaseScoped.length).toBeGreaterThan(0);
    expect(deviceScoped.length).toBeGreaterThan(0);
    expect(staticCaseScoped.length + deviceScoped.length).toBe(allKeys.length);
  });

  it('rydder de sagsnære nøgler og bevarer de uafhængige UI-præferencer', () => {
    const caseScoped = getCaseScopedSessionStorageKeys();

    // Filnavns-metadata og de to sagsnære hjælpeflader beskriver PRÆCIS den sag, der slettes.
    expect(caseScoped).toContain(UI_STORAGE_KEYS.lastSavedFilename);
    expect(caseScoped).toContain(UI_STORAGE_KEYS.lastSavedFilenameBasis);
    expect(caseScoped).toContain(UI_STORAGE_KEYS.eoOffentligeYdelserHelpers);
    expect(caseScoped).toContain(UI_STORAGE_KEYS.loentrinFinderOverlay);
    // Uafhængig UI-/devtools-tilstand beskriver ikke sagen og ryddes bevidst IKKE (contract §3.7).
    expect(caseScoped).not.toContain(UI_STORAGE_KEYS.sideMenuExpanded);
    expect(caseScoped).not.toContain(UI_STORAGE_KEYS.devtoolsLastSeenIssueId);
  });

  it('rydder alle sagsnære aktive-fane-nøgler', () => {
    const caseScoped = getCaseScopedSessionStorageKeys();

    expect(caseScoped).toContain(createActiveTabStorageKey('erstatningsopgoerelse'));
    expect(caseScoped).toContain(createActiveTabStorageKey('erhvervsevnetab'));
    expect(caseScoped).toContain(createActiveTabStorageKey('renteberegning'));
    expect(caseScoped).toContain(createActiveTabStorageKey('varigemen'));
  });

  it('følger det aktive namespace', async () => {
    vi.resetModules();
    await import('../../apps/minprocesrente/standaloneStorageNamespace');
    const standaloneManifest = await import('../../config/storageManifest');
    for (const key of standaloneManifest.getCaseScopedSessionStorageKeys()) {
        expect(key.startsWith('minprocesrente_')).toBe(true);
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
   * `invalidDrafts`-kanal skal fejle her – modellen er slettet, ikke udskudt.
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
  it('default-namespace er "mineo"', () => {
    expect(getStorageNamespace()).toBe('mineo');
  });

  it('standalone-modulet låser inputenvelope-, UI- og activeTab-keys til sit namespace', async () => {
    vi.resetModules();
    await import('../../apps/minprocesrente/standaloneStorageNamespace');
    const standaloneManifest = await import('../../config/storageManifest');

    expect(standaloneManifest.getCurrentInputEnvelopeStorageKey()).toBe('minprocesrente_input_v2');
    expect(standaloneManifest.UI_STORAGE_KEYS.sideMenuExpanded).toBe('minprocesrente_sideMenuExpanded');
    expect(standaloneManifest.createActiveTabStorageKey('aarsloen')).toBe('minprocesrente_ui_activeTab_aarsloen');
  });

  it('afviser at skifte namespace efter initialisering', () => {
    setStorageNamespace('mineo');
    expect(() => setStorageNamespace('minprocesrente')).toThrow(/allerede låst/);
  });

  it('isValidStorageKey følger standalone-namespacet', async () => {
    vi.resetModules();
    await import('../../apps/minprocesrente/standaloneStorageNamespace');
    const standaloneManifest = await import('../../config/storageManifest');
    expect(standaloneManifest.isValidStorageKey('minprocesrente_input_v2')).toBe(true);
    // Mineos key er ikke gyldig i standalone-namespace – netop pointen med isolationen.
    expect(standaloneManifest.isValidStorageKey('mineo_input_v2')).toBe(false);
  });

  it('activeTab-præfikset er også namespace-isoleret', async () => {
    vi.resetModules();
    await import('../../apps/minprocesrente/standaloneStorageNamespace');
    const standaloneManifest = await import('../../config/storageManifest');
    expect(standaloneManifest.isValidStorageKey('minprocesrente_ui_activeTab_aarsloen')).toBe(true);
    expect(standaloneManifest.isValidStorageKey('mineo_ui_activeTab_aarsloen')).toBe(false);
  });
});
