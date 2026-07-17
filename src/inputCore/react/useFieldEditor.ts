import * as React from 'react';
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
} from '../editor/fieldEditorEngine';
import { useInputRuntime, useSettledSnapshot } from './inputRuntimeContext';
import type { EditorFocusTarget } from '../runtime/activeEditorRegistry';

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
 * Den fælles persisted felt-editor. Bruges af både form- og grid-adapteren (§7.1 — samme suite mod begge). En
 * `focusTarget` (fx et input-element via ref) gives, så en kritisk handling kan fokusere feltet ved fail-closed.
 */
export const useFieldEditor = <T>(
  field: FieldRef<T>,
  location: EditorLocation,
  focusTarget?: EditorFocusTarget
): FieldEditorController<T> => {
  const runtime = useInputRuntime();
  const snapshot = useSettledSnapshot();

  const [state, setState] = React.useState<FieldEditorState<T>>(() => createClosedEditor(field, location));

  // Den lukkede visning + aktive issue afledes ALTID fra den aktuelle afsluttede revision (§3.5/§1.8), aldrig
  // fra state.open.draft. Under redigering vises den åbne draft, men issuet forbliver revisionens (§1.2).
  const view = deriveSettledFieldView(snapshot.input, field);
  const issue = activeFieldIssueFor(runtime.getIssues(), field);

  // Én stabil ref til det aktuelle {state, view, snapshot, focusTarget} for imperative kald (registrets settle,
  // blur). `focusTarget` holdes i refen, så registreringen ikke churner, selv om kalderen sender et frisk
  // fokusmål-objekt hver render (typisk `{ focus: () => ref.current?.focus() }`).
  const latest = React.useRef({ state, view, snapshot, focusTarget });
  latest.current = { state, view, snapshot, focusTarget };

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
    if (isSettleStale(current, latest.current.snapshot.revision)) {
      const closed = cancelEditor(current);
      latest.current = { ...latest.current, state: closed };
      setState(closed);
      return;
    }
    const { next, intent } = settleEditor(current);
    latest.current = { ...latest.current, state: next };
    const dispatch = settleIntentToCommand(intent);
    if (dispatch !== null) runtime.dispatch(dispatch.command, dispatch.origin);
    setState(next);
  }, [runtime]);

  const cancel = React.useCallback(() => {
    setState((current) => cancelEditor(current));
  }, []);

  const open = React.useCallback(
    (initialKey?: string) => {
      setState((current) =>
        openEditor(current, latest.current.view, latest.current.snapshot.revision, initialKey)
      );
    },
    []
  );

  const changeDraftCallback = React.useCallback((draft: string) => {
    setState((current) => changeDraft(current, draft));
  }, []);

  const clearImmediate = React.useCallback(() => {
    const dispatch = immediateClearCommand(field, latest.current.view, location);
    if (dispatch !== null) runtime.dispatch(dispatch.command, dispatch.origin);
  }, [field, location, runtime]);

  const commitImmediate = React.useCallback(
    (value: T) => {
      // Immediate commit lukker en evt. åben editor uden at settle dens draft: valget er den autoritative kilde.
      setState((current) => (isEditorOpen(current) ? cancelEditor(current) : current));
      const dispatch = immediateCommitCommand(field, value, location);
      runtime.dispatch(dispatch.command, dispatch.origin);
    },
    [field, location, runtime]
  );

  // §2.2.1/§3.5: registrér den åbne editor i højst-én-aktiv-registret, mens den er åben, så critical-action-
  // coordinatoren kan settle den. Afmeldes, så snart editoren lukker eller komponenten unmountes.
  const open_ = isEditorOpen(state);
  React.useEffect(() => {
    if (!open_) return undefined;
    const unregister = runtime.registry.register({
      id: location.locationId,
      isEditing: () => isEditorOpen(latest.current.state),
      settle,
      getFocusTarget: () => latest.current.focusTarget ?? null,
    });
    return unregister;
  }, [open_, location.locationId, runtime.registry, settle]);

  const displayText = state.open !== null ? state.open.draft : formatSettledFieldText(field, view);

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
