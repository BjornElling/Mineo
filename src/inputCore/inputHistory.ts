import type { FieldAddress } from './fieldAddress';
import type { SettledInput } from './settledInput';

// Greenfield-kerne (§3.7): history snapshotter kun afsluttet input og strukturel fokus-origin. Runtime-
// runneren validerer target, skriver sessionen og skaber den nye monotone revision i Fase 2.

export const MAX_INPUT_HISTORY_STEPS = 50;

export type HistoryOrigin = Readonly<{
  /**
   * Feltadressen, ændringen kom fra. `undefined` for en STRUKTUREL rækkehandling (insert/delete/reorder), som
   * ikke har ét enkelt felt — der navigeres da til lokationen uden at fokusere et bestemt felt (§3.7).
   */
  field?: FieldAddress;
  editorLocationId: string;
  /**
   * Route + fane for editorlokationen, ændringen kom fra (§3.7). Eksplicit typed navigation-metadata, så undo/redo-
   * restoren kan navigere til den rette side/fane UDEN at string-parse `editorLocationId` eller udlede route af
   * `field.section`. `undefined` route = en ikke-navigerbar lokation (fx standalone); `tabKey: null` = ingen faner.
   */
  route?: string;
  tabKey?: string | null;
}>;

export type InputHistoryFrame = Readonly<{
  input: SettledInput;
  origin?: HistoryOrigin;
}>;

/** Current input ligger kun i runtime.input; history ejer ikke en konkurrerende `present`-kopi. */
export type InputHistory = Readonly<{
  past: readonly InputHistoryFrame[];
  future: readonly InputHistoryFrame[];
}>;

export const createInputHistory = (): InputHistory => Object.freeze({
  past: Object.freeze([]),
  future: Object.freeze([]),
});

const appendBounded = (
  frames: readonly InputHistoryFrame[],
  frame: InputHistoryFrame
): readonly InputHistoryFrame[] => Object.freeze(
  [...frames, frame].slice(-MAX_INPUT_HISTORY_STEPS)
);

/** Fanger før-snapshottet ved en reel inputændring og rydder redo-kæden. */
export const pushInputHistory = (
  history: InputHistory,
  previousInput: SettledInput,
  origin?: HistoryOrigin
): InputHistory => Object.freeze({
  past: appendBounded(history.past, Object.freeze({
    input: previousInput,
    ...(origin === undefined ? {} : { origin }),
  })),
  future: Object.freeze([]),
});

export const canUndo = (history: InputHistory): boolean => history.past.length > 0;
export const canRedo = (history: InputHistory): boolean => history.future.length > 0;

export type InputHistoryTransition =
  | Readonly<{ changed: false; history: InputHistory }>
  | Readonly<{ changed: true; history: InputHistory; target: InputHistoryFrame }>;

/** Vælger undo-target uden at mutere current input; runneren anvender target atomisk efter validering/storage. */
export const undoInputHistory = (
  history: InputHistory,
  currentInput: SettledInput
): InputHistoryTransition => {
  const target = history.past.at(-1);
  if (target === undefined) return Object.freeze({ changed: false, history });
  const currentFrame: InputHistoryFrame = Object.freeze({
    input: currentInput,
    ...(target.origin === undefined ? {} : { origin: target.origin }),
  });
  return Object.freeze({
    changed: true,
    target,
    history: Object.freeze({
      past: Object.freeze(history.past.slice(0, -1)),
      future: Object.freeze([currentFrame, ...history.future].slice(0, MAX_INPUT_HISTORY_STEPS)),
    }),
  });
};

/** Vælger redo-target uden at mutere current input; symmetrisk med undo og samme 50-trinsgrænse. */
export const redoInputHistory = (
  history: InputHistory,
  currentInput: SettledInput
): InputHistoryTransition => {
  const target = history.future[0];
  if (target === undefined) return Object.freeze({ changed: false, history });
  const currentFrame: InputHistoryFrame = Object.freeze({
    input: currentInput,
    ...(target.origin === undefined ? {} : { origin: target.origin }),
  });
  return Object.freeze({
    changed: true,
    target,
    history: Object.freeze({
      past: appendBounded(history.past, currentFrame),
      future: Object.freeze(history.future.slice(1)),
    }),
  });
};
