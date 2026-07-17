// @vitest-environment jsdom
import {
  __createSlimInputTestStore,
  ActiveEditorRegistry,
  CriticalActionCoordinator,
  type ActiveEditor,
  type CriticalAction,
  type SlimInputStore,
} from '../../../inputCore/runtime';

// Fase 2.2 (§1.4/§2.2, critical-action-contract §3/§5/§7): den greenfield-coordinator afsluttes gennem den
// rebasede handlingsmatrix — INGEN `block`-policy. Navigation/save/download settler; load/undo/redo ignorerer
// den åbne editor. Testene driver en syntetisk `ActiveEditor`, så coordinatoren isoleres fra React/DOM.

let store: SlimInputStore;
let registry: ActiveEditorRegistry;
let coordinator: CriticalActionCoordinator;

beforeEach(() => {
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
  coordinator = new CriticalActionCoordinator(store, registry);
});

/** En syntetisk editor, der registrerer, hvor mange gange den er blevet settlet, og evt. kaster. */
const makeEditor = (options?: Partial<ActiveEditor> & { throwOnSettle?: boolean }): {
  editor: ActiveEditor;
  settleCount: () => number;
} => {
  let settles = 0;
  const editor: ActiveEditor = Object.freeze({
    id: options?.id ?? 'test-editor',
    isEditing: options?.isEditing ?? (() => true),
    settle: async () => {
      settles += 1;
      if (options?.throwOnSettle === true) throw new Error('settle sprang');
    },
    ...(options?.getFocusTarget ? { getFocusTarget: options.getFocusTarget } : {}),
  });
  return { editor, settleCount: () => settles };
};

const SETTLE_ACTIONS: CriticalAction[] = ['save', 'download', 'navigate'];
const IGNORE_ACTIONS: CriticalAction[] = ['load', 'undo', 'redo'];

describe('CriticalActionCoordinator — den rebasede §1.4-matrix', () => {
  it.each(SETTLE_ACTIONS)('settler den åbne editor for %s', async (action) => {
    const { editor, settleCount } = makeEditor();
    registry.register(editor);

    const result = await coordinator.prepare(action);

    expect(settleCount()).toBe(1);
    expect(result.status).toBe('committed');
  });

  it.each(IGNORE_ACTIONS)('settler ALDRIG editoren for %s (no-settle-reglen)', async (action) => {
    const { editor, settleCount } = makeEditor();
    registry.register(editor);

    const result = await coordinator.prepare(action);

    expect(settleCount()).toBe(0);
    expect(result.status).toBe('committed');
  });

  it('gør ingenting med editoren, når den ikke redigerer', async () => {
    const { editor, settleCount } = makeEditor({ isEditing: () => false });
    registry.register(editor);

    const result = await coordinator.prepare('save');

    expect(settleCount()).toBe(0);
    expect(result.status).toBe('committed');
  });

  it('leverer et frisk EvaluationSourceToken ved committed', async () => {
    const result = await coordinator.prepare('save');
    expect(result.status).toBe('committed');
    if (result.status !== 'committed') throw new Error('forventede committed');
    expect(result.token.inputRevision).toBe(store.getState().revision);
    expect(result.token.settingsRevision).toBe(store.getState().settingsRevision);
  });

  it('committer uden editor registreret', async () => {
    const result = await coordinator.prepare('navigate');
    expect(result.status).toBe('committed');
  });
});

describe('CriticalActionCoordinator — fail-closed og serialisering', () => {
  it('blokerer fail-closed, hvis settle kaster (contract §2)', async () => {
    const focus = { focus: () => undefined };
    const { editor } = makeEditor({ throwOnSettle: true, getFocusTarget: () => focus });
    registry.register(editor);

    const result = await coordinator.prepare('save');

    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') throw new Error('forventede blocked');
    expect(result.reason).toBe('settle-failed');
    expect(result.editorId).toBe('test-editor');
    expect(result.target).toBe(focus);
  });

  it('serialiserer samtidige klargøringer, så samme editor ikke settles parallelt', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const editor: ActiveEditor = Object.freeze({
      id: 'serial',
      isEditing: () => true,
      settle: async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await Promise.resolve();
        concurrent -= 1;
      },
    });
    registry.register(editor);

    await Promise.all([
      coordinator.prepare('save'),
      coordinator.prepare('navigate'),
      coordinator.prepare('download'),
    ]);

    expect(maxConcurrent).toBe(1);
  });

  it('lader en fejlende klargøring ikke blokere en efterfølgende', async () => {
    const throwing = makeEditor({ id: 'boom', throwOnSettle: true });
    const unregister = registry.register(throwing.editor);
    const blocked = await coordinator.prepare('save');
    expect(blocked.status).toBe('blocked');

    unregister();
    const ok = makeEditor({ id: 'ok' });
    registry.register(ok.editor);
    const committed = await coordinator.prepare('save');
    expect(committed.status).toBe('committed');
    expect(ok.settleCount()).toBe(1);
  });
});

describe('ActiveEditorRegistry — højst én aktiv editor (§3.5)', () => {
  it('afviser en anden samtidig registrering', () => {
    const a = makeEditor({ id: 'a' });
    const b = makeEditor({ id: 'b' });
    registry.register(a.editor);
    expect(() => registry.register(b.editor)).toThrow(/allerede en aktiv editor/);
  });

  it('tillader en ny registrering efter afmelding', () => {
    const a = makeEditor({ id: 'a' });
    const unregister = registry.register(a.editor);
    unregister();
    const b = makeEditor({ id: 'b' });
    expect(() => registry.register(b.editor)).not.toThrow();
  });

  it('getEditing returnerer null, når editoren ikke redigerer', () => {
    const a = makeEditor({ id: 'a', isEditing: () => false });
    registry.register(a.editor);
    expect(registry.getEditing()).toBeNull();
  });

  it('getEditing returnerer editoren, når den redigerer', () => {
    const a = makeEditor({ id: 'a' });
    registry.register(a.editor);
    expect(registry.getEditing()).toBe(a.editor);
  });
});
