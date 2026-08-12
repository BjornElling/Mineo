// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import {
  ActiveEditorRegistry,
  CriticalActionCoordinator,
  type ActiveEditor,
  type CriticalAction,
  type SlimInputStore,
} from '../../../inputCore/runtime';

// Coordinatoren (§1.4/§2.2, critical-action-contract §3/§5/§7) afsluttes gennem den
// rebasede handlingsmatrix — INGEN `block`-policy. Navigation/save/download settler; load bevarer draften frem til
// vellykket replacement; undo/redo er no-op. Testene driver en syntetisk editor uden React/DOM.

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
  const discard = options?.discard ?? (() => undefined);
  const editor: ActiveEditor = Object.freeze({
    id: options?.id ?? 'test-editor',
    isEditing: options?.isEditing ?? (() => true),
    settle: async () => {
      settles += 1;
      if (options?.throwOnSettle === true) throw new Error('settle sprang');
    },
    discard,
    ...(options?.getFocusTarget ? { getFocusTarget: options.getFocusTarget } : {}),
  });
  return { editor, settleCount: () => settles };
};

const SETTLE_ACTIONS: CriticalAction[] = ['save', 'download', 'navigate', 'reload'];
describe('CriticalActionCoordinator — den rebasede §1.4-matrix', () => {
  it('afviser async apply ved typegrænsen', () => {
    const typeBoundary = () => {
      // @ts-expect-error En kritisk mutation må ikke fortsætte efter callbackens retur.
      void coordinator.applyReplacement(async () => undefined);
      // @ts-expect-error Den samme synkrone grænse gælder sektionsafgrænsede destruktive handlinger.
      void coordinator.applyDestructive(async () => undefined);
      const unionResult = (): void | Promise<void> => undefined;
      // @ts-expect-error En union med en PromiseLike-arm er heller ikke synkron.
      void coordinator.applyReplacement(unionResult);
      const thenable = (): PromiseLike<void> => Promise.resolve();
      // @ts-expect-error Vilkårlige thenables afvises på samme måde som native promises.
      void coordinator.applyReplacement(thenable);
    };
    expect(typeBoundary).toBeTypeOf('function');
  });

  it.each(SETTLE_ACTIONS)('settler den åbne editor for %s', async (action) => {
    const { editor, settleCount } = makeEditor();
    registry.register(editor);

    const result = await coordinator.prepare(action);

    expect(settleCount()).toBe(1);
    expect(result.status).toBe('committed');
  });

  it('klargør load uden at settle eller kassere draften', async () => {
    const { editor, settleCount } = makeEditor();
    registry.register(editor);

    const result = await coordinator.prepare('load');

    expect(settleCount()).toBe(0);
    expect(result.status).toBe('committed');
  });

  it.each(['undo', 'redo'] as const)('gør %s til no-op, mens editoren er åben', async (action) => {
    const { editor, settleCount } = makeEditor();
    registry.register(editor);

    const result = await coordinator.prepare(action);

    expect(settleCount()).toBe(0);
    expect(result).toEqual({ status: 'noop', reason: 'editor-open' });
  });

  it('kasserer draften efter en vellykket replacement', async () => {
    const discard = vi.fn();
    const { editor } = makeEditor({ discard });
    registry.register(editor);

    await expect(coordinator.applyReplacement(() => {
      hydrateSlimInputStoreForTest(store, store.getState().input);
      return 'erstattet';
    })).resolves.toBe('erstattet');
    expect(discard).toHaveBeenCalledOnce();
  });

  it('bevarer draften, når callbacken ikke udfører en autoritativ replacement', async () => {
    const discard = vi.fn();
    const { editor } = makeEditor({ discard });
    registry.register(editor);

    await expect(coordinator.applyReplacement(() => 'ingen mutation')).rejects.toThrow(/uden en autoritativ/);
    expect(discard).not.toHaveBeenCalled();
  });

  it('bevarer draften, når replacement fejler', async () => {
    const discard = vi.fn();
    const { editor } = makeEditor({ discard });
    registry.register(editor);

    await expect(
      coordinator.applyReplacement(() => {
        throw new Error('apply fejlede');
      })
    ).rejects.toThrow('apply fejlede');
    expect(discard).not.toHaveBeenCalled();
  });

  // Discard skal ramme den draft, handlingen ERSTATTEDE. Et registry-opslag efter apply er ikke en
  // stabil identitet — den editor, opslaget finder, kan være åbnet af brugeren i den NYE sag.
  it('kasserer ikke en editor, der er registreret EFTER replacement', async () => {
    const discardBefore = vi.fn();
    const discardAfter = vi.fn();
    const before = makeEditor({ id: 'før', discard: discardBefore });
    const unregisterBefore = registry.register(before.editor);

    await coordinator.applyReplacement(() => {
      hydrateSlimInputStoreForTest(store, store.getState().input);
      // Den erstattede editor unmountes, og brugeren åbner et felt i den netop indlæste sag.
      unregisterBefore();
      registry.register(makeEditor({ id: 'efter', discard: discardAfter }).editor);
      return 'erstattet';
    });

    expect(discardBefore).not.toHaveBeenCalled();
    expect(discardAfter).not.toHaveBeenCalled();
  });

  it('kasserer intet, når ingen editor var åben ved handlingens start', async () => {
    const discardAfter = vi.fn();

    await coordinator.applyReplacement(() => {
      hydrateSlimInputStoreForTest(store, store.getState().input);
      registry.register(makeEditor({ id: 'ny', discard: discardAfter }).editor);
      return 'erstattet';
    });

    expect(discardAfter).not.toHaveBeenCalled();
  });

  it('kasserer først draften efter en vellykket destruktiv inputtransaktion', async () => {
    const discard = vi.fn();
    const { editor, settleCount } = makeEditor({ discard });
    registry.register(editor);

    await expect(coordinator.applyDestructive(() => {
      hydrateSlimInputStoreForTest(store, store.getState().input);
      return 'slettet';
    })).resolves.toBe('slettet');
    expect(settleCount()).toBe(0);
    expect(discard).toHaveBeenCalledOnce();
  });

  it('bevarer draften, når destruktiv apply fejler eller ikke muterer input', async () => {
    const discard = vi.fn();
    const { editor } = makeEditor({ discard });
    registry.register(editor);

    await expect(coordinator.applyDestructive(() => undefined)).rejects.toThrow(/uden en autoritativ/);
    await expect(coordinator.applyDestructive(() => { throw new Error('sletning fejlede'); })).rejects.toThrow(
      'sletning fejlede'
    );
    expect(discard).not.toHaveBeenCalled();
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
      discard: () => undefined,
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
