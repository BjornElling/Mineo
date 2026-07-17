import type { FieldRef } from '../fieldDescriptor';
import type { RejectedInput } from '../settledInput';

// Greenfield-kerne (§3.5, mineo-field-pattern Lag B): ÉN felt-editor-state-machine for både formular og
// grid. Den er ren og framework-fri — ingen React, DOM, storage eller dispatch. Den ejer KUN den åbne editors
// rå draft og lifecycle. Lukket visning er ikke state her; den afledes direkte af den afsluttede revision
// (§3.5). Der findes ingen lukket draftkopi, touched-kopi, pending-prop-guard, fingerprint eller epoch-resync.
//
// State-machinen udsteder INTENTS (settle/no-op), som runtime-bindingen oversætter til én `settleField`-
// command mod `dispatchInput`. Selve I/O, revision og history ejes af runneren (§3.6), aldrig af editoren.

/** Editorlokationens overflademetadata (§3.2/§3.5). Fokusmål er IKKE en del af datafeltets identitet. */
export type EditorLocation = Readonly<{
  /** Stabilt id for den konkrete editorlokation; bliver til `HistoryOrigin.editorLocationId` ved settle. */
  locationId: string;
}>;

/**
 * Den lukkede visning af et felt, afledt UDELUKKENDE af den afsluttede revision (§3.5). Enten vises den rå
 * rejected tekst ordret, eller den canonical værdi via `codec.format`.
 */
export type SettledFieldView<T> =
  | Readonly<{ kind: 'canonical'; value: T }>
  | Readonly<{ kind: 'rejected'; rejected: RejectedInput }>;

export type FieldEditorState<T> = Readonly<{
  field: FieldRef<T>;
  location: EditorLocation;
  /**
   * Åben-tilstand. Er den `null`, er editoren lukket, og visningen afledes af den afsluttede revision.
   * Er den sat, ejer editoren den lokale rå draft samt åbningsrevisionen (§3.5).
   */
  open: Readonly<{
    draft: string;
    /** Replacement-generationen ved åbning; almindelige inputcommits gør ikke editoren stale. */
    openedAtReplacementGeneration: number;
  }> | null;
}>;

/**
 * Draften, som editoren skal åbnes med (§3.5): rejected rå tekst vises ordret, ellers `codec.formatForEdit`.
 * En valgfri `initialKey` (tast-initieret åbning) erstatter draften med det første tegn.
 */
const seedDraft = <T>(field: FieldRef<T>, view: SettledFieldView<T>, initialKey?: string): string => {
  if (initialKey !== undefined) return initialKey;
  if (view.kind === 'rejected') return view.rejected.raw;
  return field.descriptor.codec.formatForEdit(view.value);
};

export const createClosedEditor = <T>(field: FieldRef<T>, location: EditorLocation): FieldEditorState<T> =>
  Object.freeze({ field, location, open: null });

export const isEditorOpen = <T>(state: FieldEditorState<T>): boolean => state.open !== null;

/**
 * Åbner editoren. Idempotent: en allerede åben editor bevarer sin draft (en ny åbning må ikke smide den åbne
 * draft væk). En tast-initieret åbning (`initialKey`) seeder KUN, når editoren var lukket.
 */
export const openEditor = <T>(
  state: FieldEditorState<T>,
  view: SettledFieldView<T>,
  currentReplacementGeneration: number,
  initialKey?: string
): FieldEditorState<T> => {
  if (state.open !== null) return state;
  return Object.freeze({
    ...state,
    open: Object.freeze({
      draft: seedDraft(state.field, view, initialKey),
      openedAtReplacementGeneration: currentReplacementGeneration,
    }),
  });
};

/**
 * Om et settle ville lande efter en autoritativ replacement siden editorens åbning (§3.5, mineo-field-pattern
 * Lag B: "En autoritativ replacement kan ikke passere commit-barrieren, mens editoren er åben"). En autoritativ
 * hel-sags-replacement (load/reset/`Slet alt`) hæver replacement-generationen; almindelige feltcommits gør ikke.
 * Runtime-bindingen konsulterer denne før den udsteder et settle-intent.
 * En lukket editor er aldrig stale.
 */
export const isSettleStale = <T>(state: FieldEditorState<T>, currentReplacementGeneration: number): boolean =>
  state.open !== null && currentReplacementGeneration !== state.open.openedAtReplacementGeneration;

/** Ændrer KUN den åbne draft (§1.2). Er editoren lukket, er det et no-op. */
export const changeDraft = <T>(state: FieldEditorState<T>, draft: string): FieldEditorState<T> => {
  if (state.open === null) return state;
  if (state.open.draft === draft) return state;
  return Object.freeze({ ...state, open: Object.freeze({ ...state.open, draft }) });
};

/**
 * Intentet fra et settle/cancel. `settle` bærer den rå draft + editorlokationen, som runtime-bindingen giver
 * videre som `settleField(field, raw)` + `origin`. `none` er cancel/no-op og udsteder ingen command.
 */
export type EditorSettleIntent<T> =
  | Readonly<{ kind: 'settle'; field: FieldRef<T>; raw: string; location: EditorLocation }>
  | Readonly<{ kind: 'none' }>;

/**
 * Afslutter editoren gennem settle-stien (blur, Enter, kritisk handling). Lukker altid editoren og returnerer
 * det intent, runneren skal udstede. En lukket editor giver `none`.
 */
export const settleEditor = <T>(
  state: FieldEditorState<T>
): Readonly<{ next: FieldEditorState<T>; intent: EditorSettleIntent<T> }> => {
  if (state.open === null) {
    return Object.freeze({ next: state, intent: Object.freeze({ kind: 'none' }) });
  }
  const raw = state.open.draft;
  return Object.freeze({
    next: createClosedEditor(state.field, state.location),
    intent: Object.freeze({ kind: 'settle', field: state.field, raw, location: state.location }),
  });
};

/**
 * Escape/cancel (§1.3): lukker editoren UDEN command, så den uændrede afsluttede tilstand vises igen. Et
 * efterfølgende blur må ikke settle — det garanteres af, at editoren nu er lukket (settle på lukket = `none`).
 */
export const cancelEditor = <T>(state: FieldEditorState<T>): FieldEditorState<T> =>
  createClosedEditor(state.field, state.location);
