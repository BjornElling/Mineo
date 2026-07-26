import * as React from 'react';
import { useSyncExternalStore } from 'react';
import type { FieldRef } from '../fieldDescriptor';
import type { FieldIssue } from '../inputIssue';
import {
  createClosedEditor,
  openEditor,
  changeDraft,
  settleEditor,
  cancelEditor,
  isEditorOpen,
  isSettleStale,
  type EditorLocation,
  type FieldEditorState,
} from '../editor/fieldEditorState';
import {
  deriveSettledFieldView,
  formatSettledFieldText,
  activeFieldIssueFor,
  settleIntentToCommand,
  immediateCommitCommand,
  immediateClearCommand,
  type EditorDispatch,
} from '../editor/fieldEditorEngine';
import type { EditorSettleIntent } from '../editor/fieldEditorState';
import {
  useInputEditPort,
  useInputReadPort,
  useInternalSettledSnapshot,
} from './inputRuntimeContext';
import type { EditorFocusTarget } from '../runtime/activeEditorRegistry';
import { fieldAddressesEqual } from '../fieldAddress';

// Greenfield-React (§2.3/§3.5): ÉN persisted felt-editor direkte over `FieldRef`, reader og runner. Adapteren
// ejer KUN rendering, aktivering, hit-area og navigation — den parser ikke, persisterer ikke, holder ingen
// fejlstate og vælger ingen history-policy (§3.5). Alt det ligger i den rene state-machine + engine + runner.
//
// Lukket visning afledes DIREKTE fra den afsluttede revision (§3.5): ingen lukket draftkopi, pending-prop-guard,
// fingerprint, epoch eller resync-effect. Den åbne draft er universelt inert (§1.2): tastning ændrer kun draften;
// afsluttet input, revision, issues og gates rører sig ikke, før editoren settler.

/** Hvad UI'et skal rendere. `displayText` er lukket-visning fra revisionen ELLER den åbne draft. */
export type FieldEditorView<T> = Readonly<{
  isOpen: boolean;
  /** Teksten i inputfeltet: åben draft, ellers lukket-visning fra den afsluttede revision (§3.5). */
  displayText: string;
  /** Feltets aktive røde issue fra det tokenbundne snapshot (§1.8). Vises UÆNDRET under redigering (§1.2). */
  issue: FieldIssue | undefined;
  /** Den canonical værdi, hvis feltet ikke står som rejected råtekst — til controls, der renderer værdien direkte. */
  value: T | undefined;
}>;

export type FieldEditorController<T> = FieldEditorView<T> & Readonly<{
  /** Åbn editoren (fokus/klik). `initialKey` seeder en tast-initieret åbning. No-op hvis allerede åben. */
  open: (initialKey?: string) => void;
  /** Ændrer KUN den åbne draft (§1.2). No-op når lukket. */
  changeDraft: (draft: string) => void;
  /** Afslut gennem settle-stien (blur/Enter). Udsteder settleField/clearField mod runneren. */
  settle: () => void;
  /** Escape/cancel: luk uden command; den uændrede afsluttede tilstand vises igen (§1.3). */
  cancel: () => void;
  /** Delete/Backspace på et lukket, fokuseret felt: ryd og commit straks (§1.3). No-op hvis intet at rydde. */
  clearImmediate: () => void;
  /** Dropdown/toggle/radio: commit værdien straks uden cancel-fase (§1.3/§3.6). */
  commitImmediate: (value: T) => void;
}>;

/**
 * En settle-command-override (§1.11): oversætter et settle-intent til en ALTERNATIV command i stedet for den
 * normale `settleField`/`clearField`. Bruges KUN af placeholder-celleeditoren, hvor det første ikke-tomme settle
 * skal blive en atomisk `settleFieldInNewRow` (rækkeoprettelse + feltskrivning i én transaktion). Returnerer den
 * `null`, sker der intet dispatch (tomt settle på en placeholder = ingen række oprettes). Kaldet er rent og bygger
 * kun på intentet, så editorens state-machine forbliver uændret — der er fortsat kun ÉN motor (§3.5).
 */
export type SettleCommandOverride<T> = (intent: EditorSettleIntent<T>) => EditorDispatch<T> | null;

/**
 * En immediate-commit-override (§1.11): oversætter et immediate-commit-VALG (dropdown/toggle) til en ALTERNATIV
 * command. Bruges KUN af placeholder-celleeditoren, hvor et valg på en endnu ikke oprettet række skal blive en
 * atomisk `settleFieldInNewRow` (rækkeoprettelse + valg i én transaktion), i stedet for et `setImmediateField` mod
 * en ikke-eksisterende entity. Ren funktion; editorens state-machine er uændret.
 */
export type ImmediateCommitOverride<T> = (value: T) => EditorDispatch<T> | null;

/**
 * Den fælles persisted felt-editor. Bruges af både form- og grid-adapteren (§7.1 — samme suite mod begge). En
 * `focusTarget` (fx et input-element via ref) gives, så en kritisk handling kan fokusere feltet ved fail-closed.
 * `settleOverride` re-router KUN settle-command'en (placeholder-promotion, §1.11); alt andet — draft, cancel,
 * clear, issue-visning, registrering — er identisk med et almindeligt felt.
 */
export const useFieldEditor = <T>(
  field: FieldRef<T>,
  location: EditorLocation,
  focusTarget?: EditorFocusTarget,
  settleOverride?: SettleCommandOverride<T>,
  immediateCommitOverride?: ImmediateCommitOverride<T>
): FieldEditorController<T> => {
  const read = useInputReadPort();
  const edit = useInputEditPort();
  const snapshot = useInternalSettledSnapshot();
  // Feltissues kan flytte sig ved en settingsrevision uden en inputrevision. Et særskilt abonnement på det
  // tokenbundne issue-snapshot sikrer derfor, at den røde feltvisning ikke bliver stale, blot fordi det
  // afsluttede input er uændret.
  const issueSnapshot = useSyncExternalStore(read.subscribe, read.getIssues, read.getIssues);

  const [state, setState] = React.useState<FieldEditorState<T>>(() => createClosedEditor(field, location));
  const sameEditorIdentity = state.field.descriptor.id === field.descriptor.id
    && fieldAddressesEqual(state.field.address, field.address)
    && state.location.locationId === location.locationId;
  if (!sameEditorIdentity && isEditorOpen(state)) {
    throw new Error(
      `useFieldEditor: en åben editor (${state.location.locationId}) må ikke genbruges til ${location.locationId}.`
    );
  }
  // En lukket, genbrugt React-instans må straks binde næste åbning til de aktuelle props. State opdateres ved
  // selve åbningen; der er derfor ingen prop→state-effect, som kan overskrive afsluttet input eller en draft.
  const boundState = sameEditorIdentity ? state : createClosedEditor(field, location);

  // Den lukkede visning + aktive issue afledes ALTID fra den aktuelle afsluttede revision (§3.5/§1.8), aldrig
  // fra state.open.draft. Under redigering vises den åbne draft, men issuet forbliver revisionens (§1.2).
  const view = deriveSettledFieldView(snapshot.input, field);
  const issue = activeFieldIssueFor(issueSnapshot, field);

  // Én stabil ref til det aktuelle {state, view, snapshot, focusTarget} for imperative kald (registrets settle,
  // blur). `focusTarget` holdes i refen, så registreringen ikke churner, selv om kalderen sender et frisk
  // fokusmål-objekt hver render (typisk `{ focus: () => ref.current?.focus() }`).
  const latest = React.useRef({ state: boundState, view, snapshot, focusTarget, settleOverride, immediateCommitOverride });
  latest.current = { state: boundState, view, snapshot, focusTarget, settleOverride, immediateCommitOverride };
  const unregisterRef = React.useRef<(() => void) | null>(null);

  const closeActiveRegistration = React.useCallback(() => {
    unregisterRef.current?.();
    unregisterRef.current = null;
  }, []);

  const settle = React.useCallback(() => {
    // Dispatch sker SYNKRONT her (ikke inde i setState-updateren), så en kritisk handling, der afventer
    // `settle()`, med sikkerhed ser transaktionen landet, før den læser et frisk token (contract §5). React
    // kører ikke garanteret en setState-updater før `setState` returnerer uden for et event, så
    // side-effekten (dispatch) må ikke ligge i updateren.
    const current = latest.current.state;
    // Et lukket felt settler aldrig (blur efter Escape/settle må ikke committe igen, §1.3). To synkrone
    // settle-kald (fx blur + coordinatorens settle) må heller ikke dispatche to gange: `latest.current.state`
    // opdateres HER, før næste render, så det andet kald ser den lukkede tilstand.
    if (current.open === null) return;
    // §3.5: en autoritativ replacement (load/reset) på en nyere revision må ikke settle draften ind i den
    // erstattede tilstand. Luk da uden command.
    if (isSettleStale(current, latest.current.snapshot.replacementGeneration)) {
      const closed = cancelEditor(current);
      latest.current = { ...latest.current, state: closed };
      closeActiveRegistration();
      setState(closed);
      return;
    }
    const { next, intent } = settleEditor(current);
    // Placeholder-promotion re-router settle til `settleFieldInNewRow` (§1.11); ellers den normale settle-command.
    const override = latest.current.settleOverride;
    const dispatch = override !== undefined ? override(intent) : settleIntentToCommand(intent);
    // Bevar editor og draft fuldt aktive, hvis den atomiske runtime-transaktion fejler. Ellers kunne registryet
    // tro, at feltet var lukket, mens brugeren stadig så den fejlende draft, og næste kritiske handling passere.
    if (dispatch !== null) edit.dispatch(dispatch.command, dispatch.origin);
    latest.current = { ...latest.current, state: next };
    closeActiveRegistration();
    setState(next);
  }, [closeActiveRegistration, edit]);

  const cancel = React.useCallback(() => {
    // Opdatér den imperative ref synkront. Escape kan efterfølges af blur i samme browser-task, før React har
    // rendret igen; blur må da se editoren som lukket og må aldrig settle den annullerede draft.
    const closed = cancelEditor(latest.current.state);
    latest.current = { ...latest.current, state: closed };
    closeActiveRegistration();
    setState(closed);
  }, [closeActiveRegistration]);

  const open = React.useCallback(
    (initialKey?: string) => {
      const current = latest.current.state;
      const next = openEditor(
        current,
        latest.current.view,
        latest.current.snapshot.replacementGeneration,
        initialKey
      );
      if (next === current) return;

      // Registreringen er en synkron del af editoråbningen. En programmatisk save/navigation i samme task må
      // ikke kunne passere i vinduet før en React-effect.
      const unregister = edit.registry.register({
        id: location.locationId,
        isEditing: () => isEditorOpen(latest.current.state),
        settle,
        discard: cancel,
        getFocusTarget: () => latest.current.focusTarget ?? null,
      });
      unregisterRef.current = unregister;
      latest.current = { ...latest.current, state: next };
      setState(next);
    },
    [cancel, location.locationId, edit.registry, settle]
  );

  const changeDraftCallback = React.useCallback((draft: string) => {
    const next = changeDraft(latest.current.state, draft);
    latest.current = { ...latest.current, state: next };
    setState(next);
  }, []);

  const clearImmediate = React.useCallback(() => {
    const dispatch = immediateClearCommand(field, latest.current.view, location);
    if (dispatch !== null) edit.dispatch(dispatch.command, dispatch.origin);
  }, [field, location, edit]);

  const commitImmediate = React.useCallback(
    (value: T) => {
      // Valget er den autoritative kilde. Luk først draften, når dispatch er lykkedes; ved storagefejl skal
      // brugeren fortsat kunne se og håndtere sin åbne draft.
      const current = latest.current.state;
      // Placeholder-promotion (§1.11): et immediate-valg på en endnu ikke oprettet række oversættes til én atomisk
      // `settleFieldInNewRow`. Returnerer override'et `null`, sker der intet dispatch (intet at oprette).
      const override = latest.current.immediateCommitOverride;
      const dispatch = override !== undefined ? override(value) : immediateCommitCommand(field, value, location);
      if (dispatch !== null) edit.dispatch(dispatch.command, dispatch.origin);
      if (isEditorOpen(current)) {
        const closed = cancelEditor(current);
        latest.current = { ...latest.current, state: closed };
        closeActiveRegistration();
        setState(closed);
      }
    },
    [closeActiveRegistration, field, location, edit]
  );

  const open_ = isEditorOpen(boundState);
  React.useEffect(() => closeActiveRegistration, [closeActiveRegistration]);

  const displayText = boundState.open !== null ? boundState.open.draft : formatSettledFieldText(field, view);

  return {
    isOpen: open_,
    displayText,
    issue,
    value: view.kind === 'canonical' ? view.value : undefined,
    open,
    changeDraft: changeDraftCallback,
    settle,
    cancel,
    clearImmediate,
    commitImmediate,
  };
};
