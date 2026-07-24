// @vitest-environment jsdom
import { settleField, clearCase } from '../../inputCore';
import {
  __createSlimInputTestStore,
  ActiveEditorRegistry,
  CriticalActionCoordinator,
  dispatchInput,
  type SlimInputStore,
} from '../../inputCore/runtime';
import { createCaseResetOperations } from '../../persistence/caseResetOperations';
import { aargangField, createTestCatalog } from '../inputCore/testCatalog';

const catalog = createTestCatalog();

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
    store.getState().hydrate(store.getState().input, { writesBlocked: true });
    const ops = buildOps(store, new ActiveEditorRegistry());

    const result = await ops.clearAll();

    expect(result.status).toBe('cleared');
    expect(store.getState().meta.inputWritesBlocked ?? false).toBe(false);
  });
});
