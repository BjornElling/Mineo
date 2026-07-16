import type { SettledInput } from './settledInput';

// Greenfield-kerne (§3.7): history snapshotter KUN afsluttet input (og — i runtime — fokus-origin). Issues,
// beregninger, gates og åbne drafts genafledes eller ignoreres. En afløst gyldig værdi findes kun her, aldrig
// i den aktuelle tilstand (§1.5). Ren og framework-fri; runtime binder monotone revisioner ovenpå (Fase 2).

export type InputHistory = Readonly<{
  past: readonly SettledInput[];
  present: SettledInput;
  future: readonly SettledInput[];
}>;

export const createInputHistory = (present: SettledInput): InputHistory =>
  Object.freeze({ past: Object.freeze([]), present, future: Object.freeze([]) });

/** Skubber en ny afsluttet tilstand. Fremtiden ryddes; ét history-trin pr. reel ændring (§3.6/§10.20). */
export const pushInputHistory = (history: InputHistory, next: SettledInput): InputHistory => Object.freeze({
  past: Object.freeze([...history.past, history.present]),
  present: next,
  future: Object.freeze([]),
});

export const canUndo = (history: InputHistory): boolean => history.past.length > 0;
export const canRedo = (history: InputHistory): boolean => history.future.length > 0;

/** Gendanner den tidligere samlede tilstand (§1.5). Stille no-op, hvis der intet er at fortryde. */
export const undoInputHistory = (history: InputHistory): InputHistory => {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1] as SettledInput;
  return Object.freeze({
    past: Object.freeze(history.past.slice(0, -1)),
    present: previous,
    future: Object.freeze([history.present, ...history.future]),
  });
};

/** Gendanner fejltilstanden uden den tidligere canonical værdi (§1.5). Stille no-op uden fremtid. */
export const redoInputHistory = (history: InputHistory): InputHistory => {
  if (history.future.length === 0) return history;
  const next = history.future[0] as SettledInput;
  return Object.freeze({
    past: Object.freeze([...history.past, history.present]),
    present: next,
    future: Object.freeze(history.future.slice(1)),
  });
};
