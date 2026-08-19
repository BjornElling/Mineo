import type { FieldAddress } from './fieldAddress';
import type { SettledInput } from './settledInput';

// Inputkernen (§3.7): history snapshotter kun afsluttet input og strukturel fokus-origin. Runtime-
// runneren (`inputCore/runtime`) validerer target, skriver sessionen og skaber den nye monotone revision.

export const MAX_INPUT_HISTORY_STEPS = 50;

/**
 * Route + fane for den lokation, ændringen kom fra (§3.7). Eksplicit typed navigation-metadata, så undo/redo-
 * restoren kan navigere til den rette side/fane UDEN at string-parse `editorLocationId` eller udlede route af
 * `field.section`. `undefined` route = en ikke-navigerbar lokation (fx standalone); `tabKey: null` = ingen faner.
 *
 * Kun FELT-origins må udelade destinationen: standalone MinProcesrente-gridet er en reelt ikke-navigerbar
 * lokation, og restoren fokuserer der blot feltet uden at navigere. En STRUKTUREL rækkehandling har derimod
 * intet felt at fokusere – uden destination ville dens undo gendanne data og efterlade brugeren på en
 * vilkårlig side. Derfor kræver `CollectionHistoryOrigin` nedenfor destinationen (§3.7).
 */
type OriginDestination =
  // ALT-eller-INTET: en `tabKey` uden `route` er lydløst inert, fordi restoren kun aktiverer fanen inde i
  // `route !== undefined`-grenen (`MainLayout`). Unionen gør den inkohærens urepræsenterbar i stedet for at
  // lade et runtime-værn fange den bagefter.
  | Readonly<{ editorLocationId: string; route: string; tabKey: string | null }>
  | Readonly<{ editorLocationId: string; route?: undefined; tabKey?: undefined }>;

/** Destination der ER påkrævet: `tabKey: null` udtrykker eksplicit "siden har ingen faner". */
type RequiredOriginDestination = Readonly<{
  editorLocationId: string;
  route: string;
  tabKey: string | null;
}>;

/**
 * Hvor en ændring kom fra – en DISKRIMINERET union, så de to slags commits ikke kan forveksles:
 *
 * - `kind: 'field'` (felt-/celle-commit) SKAL bære feltadressen. Restoren fokuserer præcis den editorlokation.
 * - `kind: 'collection'` (strukturel rækkehandling: insert/delete/reorder) har intet enkelt felt, men SKAL
 *   bære collectionen, så destinationen er entydig. Restoren navigerer til lokationen uden at fokusere et felt.
 *
 * Tidligere var `field` blot valgfri; da kunne et feltcommit type-lovligt sendes uden adresse. Unionen gør den
 * fejl urepræsenterbar.
 */
export type FieldHistoryOrigin = OriginDestination & Readonly<{
  kind: 'field';
  field: FieldAddress;
}>;

/**
 * Rækkehandlingens origin. Destinationen er PÅKRÆVET i selve kernetypen – ikke kun i surface-hookens
 * `CollectionRowOrigin` – så heller ikke en direkte `dispatchInput`-kalder kan konstruere en rækkehandling
 * uden et sted at navigere hen. Uden feltadresse er route + fane det eneste, restoren har at gå efter.
 */
export type CollectionHistoryOrigin = RequiredOriginDestination & Readonly<{
  kind: 'collection';
  /** Collectionen, rækkehandlingen ramte (til diagnostik og entydig destination). */
  collection: string;
}>;

export type HistoryOrigin = FieldHistoryOrigin | CollectionHistoryOrigin;

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
