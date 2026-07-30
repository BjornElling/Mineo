import type { FieldRef } from '../fieldDescriptor';
import type { RejectedInput } from '../settledInput';

// Inputkernen (§3.5, mineo-field-pattern Lag B): ÉN felt-editor-state-machine for både formular og
// grid. Den er ren og framework-fri — ingen React, DOM, storage eller dispatch. Den ejer KUN den åbne editors
// rå draft og lifecycle. Lukket visning er ikke state her; den afledes direkte af den afsluttede revision
// (§3.5). Der findes ingen lukket draftkopi, touched-kopi, pending-prop-guard, fingerprint eller epoch-resync.
//
// State-machinen udsteder INTENTS (settle/no-op), som runtime-bindingen oversætter til én `settleField`-
// command mod `dispatchInput`. Selve I/O, revision og history ejes af runneren (§3.6), aldrig af editoren.

/**
 * Editorlokationens overflademetadata (§3.2/§3.5). Fokusmål er IKKE en del af datafeltets identitet.
 *
 * Lokationen EJER sin destination. `route` + `tabKey` er PÅKRÆVEDE, fordi de er det eneste sted, der ved hvor
 * feltet redigeres: samme datafelt kan have flere editorer (`faellesAarsloen` uden egen route, forligsfelterne
 * på to sider), og både undo/redo-restoren (§3.7) og save-blokeringens fokus (§1.4) navigerer efter dem. Var de
 * valgfri, ville en glemt destination gøre lokationen uopnåelig UDEN at nogen type eller test fejlede — og et
 * globalt feltadresse→fane-kort måtte kompensere og skabe en parallel destinationsmodel.
 *
 * `tabKey: null` udtrykker eksplicit "siden har ingen faner". Der findes bevidst INGEN "ikke navigerbar"-værdi:
 * hver eneste produktionslokation har en rigtig route, og et sentinel for en tilstand, ingen kode er i, ville
 * blot være en gren, intet kan nå.
 */
export type EditorLocation = Readonly<{
  /** Stabilt id for den konkrete editorlokation; bliver til `HistoryOrigin.editorLocationId` ved settle. */
  locationId: string;
  /**
   * Den route, editorlokationen hører til (fx `/forsoergertab`). Undo/redo må ALDRIG string-parse `locationId`
   * eller udlede route af `field.section`.
   */
  route: string;
  /** Fanen inden for `route` (fx `'loenindkomst'`), eller `null` for en side uden faner. */
  tabKey: string | null;
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
 * Afslutter editoren med en PROGRAMMATISK LEVERET værdi (§1.3): en handlingsknap ved siden af feltet — fx
 * »Indsæt dags dato« — udtrykker den samme afslutning som Enter, blot med en tekst, brugeren ikke har tastet.
 *
 * Den leverede tekst ERSTATTER en eventuel åben draft. Knappen er en eksplicit afslutningshandling, så den
 * halvskrevne draft er netop det, brugeren beder om at få overskrevet; at settle draften i stedet ville
 * ignorere handlingen. Editoren lukkes uanset om den var åben, og intentet er identisk med et tastet settle —
 * så råteksten går gennem feltets codec, XOR-invarianten og history på præcis samme vej (§1.5/§3.6).
 *
 * Bemærk, at der IKKE er en immediate-vej her: værdien skal parses af codecet, ikke skrives direkte som
 * canonical. `setImmediateField` er forbeholdt choice/toggle, hvor der aldrig findes en råtekst at parse.
 */
export const settleEditorWithText = <T>(
  state: FieldEditorState<T>,
  raw: string
): Readonly<{ next: FieldEditorState<T>; intent: EditorSettleIntent<T> }> => Object.freeze({
  next: createClosedEditor(state.field, state.location),
  intent: Object.freeze({ kind: 'settle', field: state.field, raw, location: state.location }),
});

/**
 * Escape/cancel (§1.3): lukker editoren UDEN command, så den uændrede afsluttede tilstand vises igen. Et
 * efterfølgende blur må ikke settle — det garanteres af, at editoren nu er lukket (settle på lukket = `none`).
 */
export const cancelEditor = <T>(state: FieldEditorState<T>): FieldEditorState<T> =>
  createClosedEditor(state.field, state.location);
