// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../inputCore/runtime/slimInputStore';
import { hydrateSlimInputStoreForTest } from '../../test/actSafeInputStore';
import { settleField, clearCase } from '../../inputCore';
import {
  ActiveEditorRegistry,
  CriticalActionCoordinator,
  dispatchInput,
  type SlimInputStore,
} from '../../inputCore/runtime';

// Porten ejer HELE reset-transaktionen — input, sagsnær UI-sessionstate og filhåndtag — og rapporterer
// rester frem for at lade dem forsvinde i en ubetinget succes. Filhåndtagsgrænsen mockes, fordi dens
// `false`-ben er selve fundet; sessionStorage er jsdom's ægte.
const deleteFileHandleFromIndexedDBMock = vi.fn<() => Promise<boolean>>();
vi.mock('../../utils/fileHandleStorage', () => ({
  deleteFileHandleFromIndexedDB: () => deleteFileHandleFromIndexedDBMock(),
}));

import { createCaseResetOperations } from '../../persistence/caseResetOperations';
import {
  UI_STORAGE_KEYS,
  createActiveTabStorageKey,
  getCaseScopedSessionStorageKeys,
} from '../../config/storageManifest';
import { aargangField, createTestCatalog } from '../inputCore/testCatalog';

const catalog = createTestCatalog();

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  deleteFileHandleFromIndexedDBMock.mockResolvedValue(true);
});

const buildOps = (store: SlimInputStore, registry: ActiveEditorRegistry) =>
  createCaseResetOperations({
    coordinator: new CriticalActionCoordinator(store, registry),
    dispatchClearCase: () => dispatchInput(store, catalog, clearCase()),
  });

describe('caseResetOperations.clearAll', () => {
  it('rydder hele sagen og flytter replacementGeneration', async () => {
    const store = __createSlimInputTestStore();
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'));
    const generationBefore = store.getState().replacementGeneration;
    const ops = buildOps(store, new ActiveEditorRegistry());

    const result = await ops.clearAll();

    expect(result.status).toBe('cleared');
    expect(store.getState().input.sections.satser).toBeNull();
    expect(store.getState().replacementGeneration).toBeGreaterThan(generationBefore);
  });

  it('kasserer en åben draft først EFTER succes (contract §7)', async () => {
    const store = __createSlimInputTestStore();
    const registry = new ActiveEditorRegistry();
    let discarded = false;
    // Registrér en åben editor; clearAll må ikke settle den, men skal discarde den efter succes.
    registry.register({
      id: 'test-editor',
      isEditing: () => true,
      settle: () => { throw new Error('clearAll må aldrig settle'); },
      discard: () => { discarded = true; },
    });
    const ops = buildOps(store, registry);

    await ops.clearAll();

    expect(discarded).toBe(true);
  });

  it('rydder en writesBlocked current-session (§1.12 recovery)', async () => {
    const store = __createSlimInputTestStore();
    // Simulér en bevaret korrupt session: writes blokeret, men clearCase skal stadig kunne rydde.
    hydrateSlimInputStoreForTest(store, store.getState().input, { writesBlocked: true });
    const ops = buildOps(store, new ActiveEditorRegistry());

    const result = await ops.clearAll();

    expect(result.status).toBe('cleared');
    expect(store.getState().meta.inputWritesBlocked ?? false).toBe(false);
  });
});

describe('caseResetOperations.clearAll — reset-policyen', () => {
  it('rydder hver sagsnær manifestnøgle og lader de device-scopede bestå', async () => {
    const caseScoped = getCaseScopedSessionStorageKeys();
    expect(caseScoped.length).toBeGreaterThan(0);
    for (const key of caseScoped) sessionStorage.setItem(key, 'sagsnær værdi');
    sessionStorage.setItem(UI_STORAGE_KEYS.sideMenuExpanded, 'true');
    sessionStorage.setItem(UI_STORAGE_KEYS.devtoolsLastSeenIssueId, '42');
    const store = __createSlimInputTestStore();

    const result = await buildOps(store, new ActiveEditorRegistry()).clearAll();

    expect(result.status).toBe('cleared');
    expect(result.residue).toEqual([]);
    for (const key of caseScoped) expect(sessionStorage.getItem(key)).toBeNull();
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.sideMenuExpanded)).toBe('true');
    expect(sessionStorage.getItem(UI_STORAGE_KEYS.devtoolsLastSeenIssueId)).toBe('42');
  });

  it('rydder aktiv fanehistorik, så den næste sag bruger hver sides standardfane', async () => {
    const activeTabs = [
      createActiveTabStorageKey('erstatningsopgoerelse'),
      createActiveTabStorageKey('erhvervsevnetab'),
      createActiveTabStorageKey('renteberegning'),
      createActiveTabStorageKey('varigemen'),
    ];
    for (const key of activeTabs) sessionStorage.setItem(key, 'tidligere-fane');
    const store = __createSlimInputTestStore();

    const result = await buildOps(store, new ActiveEditorRegistry()).clearAll();

    expect(result.status).toBe('cleared');
    for (const key of activeTabs) expect(sessionStorage.getItem(key)).toBeNull();
  });

  it('rapporterer filhåndtaget som en rest, når sletningen ikke kan verificeres', async () => {
    deleteFileHandleFromIndexedDBMock.mockResolvedValue(false);
    const store = __createSlimInputTestStore();

    const result = await buildOps(store, new ActiveEditorRegistry()).clearAll();

    expect(result.status).toBe('cleared-with-residue');
    expect(result.residue).toEqual([
      { kind: 'fileHandle', detail: 'gemt filhåndtag til direkte Gem' },
    ]);
    // Inputtet er ryddet uanset: den autoritative del kan ikke rulles tilbage af en storagefejl.
    expect(store.getState().input.sections.satser).toBeNull();
  });

  it('rapporterer hver sessionnøgle, der ikke kunne fjernes', async () => {
    // jsdom's `sessionStorage` er en Proxy, så en `vi.spyOn`-metode på instansen aldrig kaldes; hele objektet
    // udskiftes derfor. Kun `removeItem` fejler: den autoritative input-clear SKRIVER (og skal lykkes — ellers
    // fail-closer transaktionen selv, hvilket er en anden, allerede dækket sti), mens den efterfølgende
    // oprydning af de sagsnære nøgler ikke kan verificeres. Præcis det ben skal give en rest.
    const realSessionStorage = window.sessionStorage;
    const backing = new Map<string, string>();
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => { backing.set(key, value); },
        removeItem: () => { throw new Error('lager utilgængeligt'); },
        key: () => null,
        get length() { return backing.size; },
      },
    });
    const store = __createSlimInputTestStore();

    try {
      const result = await buildOps(store, new ActiveEditorRegistry()).clearAll();

      expect(result.status).toBe('cleared-with-residue');
      expect(result.residue).toHaveLength(getCaseScopedSessionStorageKeys().length);
      expect(result.residue.every((entry) => entry.kind === 'sessionStorageKey')).toBe(true);
    } finally {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, value: realSessionStorage });
    }
  });

  it('rydder også, når filhåndtagsgrænsen kaster? — nej: en kastende grænse er ikke en rest, men en fejl', async () => {
    // Bevidst afgrænsning: `deleteFileHandleFromIndexedDB` fanger selv sine fejl og returnerer boolean. Kaster
    // den alligevel, er det en programmeringsfejl i grænsen — den skal boble til use-casens catch og vise
    // "Kunne ikke slette data", ikke maskeres som en delvis succes.
    deleteFileHandleFromIndexedDBMock.mockRejectedValue(new Error('uventet'));
    const store = __createSlimInputTestStore();

    await expect(buildOps(store, new ActiveEditorRegistry()).clearAll()).rejects.toThrow('uventet');
  });
});
