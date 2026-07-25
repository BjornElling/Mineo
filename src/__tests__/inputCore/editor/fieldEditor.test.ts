// @vitest-environment jsdom
import {
  createClosedEditor,
  openEditor,
  changeDraft,
  settleEditor,
  cancelEditor,
  isEditorOpen,
  deriveSettledFieldView,
  formatSettledFieldText,
  activeFieldIssueFor,
  settleIntentToCommand,
  immediateCommitCommand,
  immediateClearCommand,
  isSettleStale,
  type EditorLocation,
} from '../../../inputCore/editor';
import {
  __createSlimInputTestStore,
  dispatchInput,
  initializeInputRuntime,
  captureStableInputEvaluation,
  type SlimInputStore,
} from '../../../inputCore/runtime';
import {
  insertRow,
  settleField,
  clearCase,
  serializeFieldAddress,
  type FieldRef,
  type InputCatalog,
} from '../../../inputCore';
import { getCurrentInputEnvelopeStorageKey } from '../../../config/storageManifest';
import {
  createTestCatalog,
  aargangField,
  beregningsdatoField,
  belobField,
  enhedField,
  makeRow,
  rentekravRowsRef,
  testRowOrigin,
} from '../testCatalog';

const key = getCurrentInputEnvelopeStorageKey();
void key;
const LOC: EditorLocation = { locationId: 'form:test' };

// Statiske felter bindes én gang til en konkret FieldRef; editoren opererer altid på refs, aldrig descriptors.
const aargangRef = aargangField.bind();
const beregningsdatoRef = beregningsdatoField.bind();

let store: SlimInputStore;
let catalog: InputCatalog;

beforeEach(() => {
  window.sessionStorage.clear();
  store = __createSlimInputTestStore();
  catalog = createTestCatalog();
  initializeInputRuntime(store, catalog);
});

/** Læser feltets aktuelle view fra den afsluttede revision (som editoren og adapteren ville). */
const viewOf = <T>(field: FieldRef<T>) => deriveSettledFieldView(store.getState().input, field);

/** Committer et settle-intent gennem den ene write-grænse, præcis som runtime-bindingen ville. */
const dispatchSettle = <T>(state: ReturnType<typeof settleEditor<T>>): void => {
  const translated = settleIntentToCommand(state.intent);
  if (translated === null) return;
  dispatchInput(store, catalog, translated.command, { origin: translated.origin });
};

const evaluate = () => captureStableInputEvaluation(store, catalog, {});

describe('felt-editor-state-machine (§3.5, §1.2, §1.3)', () => {
  it('åben draft ændrer intet afsluttet input eller revision (§1.2)', () => {
    // Afsæt en gyldig værdi.
    dispatchInput(store, catalog, settleIntentToCommand(
      settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().replacementGeneration), '2010')).intent
    )!.command, {});
    const revisionEfterCommit = store.getState().revision;

    // Åbn igen og tast — intet må ændre sig i runtime.
    let editor = openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision);
    editor = changeDraft(editor, '9999');
    editor = changeDraft(editor, 'abc');

    expect(store.getState().revision).toBe(revisionEfterCommit);
    expect(aargangRef.descriptor.readCanonical(store.getState().input.sections, aargangRef.address)).toBe(2010);
    expect(isEditorOpen(editor)).toBe(true);
    expect(editor.open?.draft).toBe('abc');
  });

  it('åbner draften fra en canonical værdi via formatForEdit, og fra rejected råtekst ordret (§3.5)', () => {
    // Gyldigt settle → canonical; genåbning viser formatForEdit.
    let editor = openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision);
    editor = changeDraft(editor, '2010');
    dispatchSettle(settleEditor(editor));
    editor = openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision);
    expect(editor.open?.draft).toBe('2010');

    // Ugyldigt settle → rejected; genåbning viser den rå tekst ordret. '12x34' er ikke-parsebart format (ikke
    // blot et tal uden for interval, som nu ville committe canonical).
    editor = changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '12x34');
    dispatchSettle(settleEditor(editor));
    editor = openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision);
    expect(editor.open?.draft).toBe('12x34');
  });

  it('tast-initieret åbning seeder med tasten; genåbning på lukket felt beholder ikke tidligere draft', () => {
    const editor = openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision, '5');
    expect(editor.open?.draft).toBe('5');
  });

  it('gyldigt settle skriver canonical og fjerner rejected; ugyldigt settle er XOR (§1.5)', () => {
    // ugyldigt settle — '9x9' er ikke-parsebart format (interiør bogstav), ikke blot out-of-bounds.
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '9x9')));
    let view = viewOf(aargangRef);
    expect(view.kind).toBe('rejected');
    expect(aargangRef.descriptor.readCanonical(store.getState().input.sections, aargangRef.address)).toBeUndefined();

    // derefter gyldigt settle: rejected forsvinder, canonical skrives
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '2010')));
    view = viewOf(aargangRef);
    expect(view).toEqual({ kind: 'canonical', value: 2010 });
    expect(store.getState().input.rejectedInputs[serializeFieldAddress(aargangRef.address)]).toBeUndefined();
  });

  it('tomt settle rydder feltet uden at efterlade rejected (§1.5)', () => {
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '2010')));
    // ryd via tom draft
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '   ')));
    expect(viewOf(aargangRef)).toEqual({ kind: 'canonical', value: undefined });
    expect(store.getState().input.rejectedInputs[serializeFieldAddress(aargangRef.address)]).toBeUndefined();
  });

  it('no-op settle (uændret draft) skriver ikke en ny revision (§3.6)', () => {
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '2010')));
    const revisionEfter = store.getState().revision;
    // åbn, rør ikke draften, settle igen
    dispatchSettle(settleEditor(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision)));
    expect(store.getState().revision).toBe(revisionEfter);
  });

  it('Escape lukker uden command, og et efterfølgende blur settler ikke (§1.3)', () => {
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '2010')));
    const revisionEfter = store.getState().revision;

    let editor = openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision);
    editor = changeDraft(editor, '3000'); // ville ellers committe
    editor = cancelEditor(editor); // Escape
    expect(isEditorOpen(editor)).toBe(false);

    // efterfølgende blur → settle på lukket editor = no-op intent
    const settled = settleEditor(editor);
    expect(settled.intent.kind).toBe('none');
    dispatchSettle(settled);

    expect(store.getState().revision).toBe(revisionEfter);
    expect(aargangRef.descriptor.readCanonical(store.getState().input.sections, aargangRef.address)).toBe(2010);
  });

  it('eksisterende rød fejl bliver stående uændret under redigering; ny fejl vises først efter settle (§1.2)', () => {
    // afsæt en rejected format-fejl (ren ikke-parsebar tekst)
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().replacementGeneration), 'abc')));
    const issueFoer = activeFieldIssueFor(evaluate().issues, aargangRef);
    expect(issueFoer?.reason).toBe('format');

    // åbn og tast en gyldig værdi — issue må IKKE forsvinde, før settle
    openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision);
    const issueUnderRedigering = activeFieldIssueFor(evaluate().issues, aargangRef);
    expect(issueUnderRedigering?.reason).toBe('format');

    // efter settle af en gyldig værdi forsvinder issuet
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '2010')));
    expect(activeFieldIssueFor(evaluate().issues, aargangRef)).toBeUndefined();
  });
});

describe('felt-editor-engine — visning, issues og immediate commit', () => {
  it('formatSettledFieldText viser rejected råtekst ordret og canonical via codec.format', () => {
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '2010')));
    expect(formatSettledFieldText(aargangRef, viewOf(aargangRef))).toBe('2010');

    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '7z7')));
    expect(formatSettledFieldText(aargangRef, viewOf(aargangRef))).toBe('7z7');
  });

  it('canonical bounds-fejl skjuler værdien for readeren men bevarer den canonical (§1.6)', () => {
    // beregningsdato < 2000 er en canonical bounds-fejl (værdien forbliver, issue afledes)
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(beregningsdatoRef, LOC), viewOf(beregningsdatoRef), store.getState().revision), '01-01-1999')));
    const issue = activeFieldIssueFor(evaluate().issues, beregningsdatoRef);
    expect(issue?.reason).toBe('bounds');
    // værdien er stadig canonical i input (ikke rejected)
    expect(store.getState().input.rejectedInputs[serializeFieldAddress(beregningsdatoRef.address)]).toBeUndefined();
    expect(beregningsdatoRef.descriptor.readCanonical(store.getState().input.sections, beregningsdatoRef.address)).toBe('1999-01-01');
    // men den offentlige reader skjuler den bag issuet
    expect(evaluate().reader.read(beregningsdatoRef).status).toBe('error');
  });

  it('immediate commit for choice committer straks (§1.3)', () => {
    // opret en række så enhed-feltet findes
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')), { origin: testRowOrigin() });
    const enhed = enhedField.bind('r1');
    const { command, origin } = immediateCommitCommand(enhed, 'uger', LOC);
    dispatchInput(store, catalog, command, { origin });
    expect(enhed.descriptor.readCanonical(store.getState().input.sections, enhed.address)).toBe('uger');
    expect(origin.editorLocationId).toBe('form:test');
    // Invariant: et FELT-commit bærer ALTID sin feltadresse. `HistoryOrigin.field` er valgfri udelukkende for
    // strukturelle rækkehandlinger (insert/delete/reorder), som ikke har ét felt — aldrig for et feltcommit.
    expect(origin.kind).toBe('field');
    if (origin.kind !== 'field') throw new Error('feltcommit skal give en field-origin');
    expect(origin.field).toEqual(enhed.address);
  });

  it('immediate clear på et lukket felt rydder til tomværdien (§1.3)', () => {
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), '2010')));
    const translated = immediateClearCommand(aargangRef, viewOf(aargangRef), LOC);
    expect(translated).not.toBeNull();
    dispatchInput(store, catalog, translated!.command, { origin: translated!.origin });
    expect(aargangRef.descriptor.readCanonical(store.getState().input.sections, aargangRef.address)).toBeUndefined();
  });

  it('immediate clear på et allerede tomt felt er guardet no-op (ingen command, ingen revision) (§3.6)', () => {
    const revisionFoer = store.getState().revision;
    // Feltet er aldrig rørt (canonical tomt, ingen rejected) → engine udsteder INGEN command.
    const translated = immediateClearCommand(aargangRef, viewOf(aargangRef), LOC);
    expect(translated).toBeNull();
    expect(store.getState().revision).toBe(revisionFoer);
  });

  it('immediate clear på et rejected felt rydder den rå tekst (§1.3)', () => {
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(aargangRef, LOC), viewOf(aargangRef), store.getState().revision), 'abc')));
    const translated = immediateClearCommand(aargangRef, viewOf(aargangRef), LOC);
    expect(translated).not.toBeNull();
    dispatchInput(store, catalog, translated!.command, { origin: translated!.origin });
    expect(store.getState().input.rejectedInputs[serializeFieldAddress(aargangRef.address)]).toBeUndefined();
    expect(viewOf(aargangRef)).toEqual({ kind: 'canonical', value: undefined });
  });

  it('en tom-draft settle-intent oversættes til clearField, ikke en rå tom settle', () => {
    const translated = settleIntentToCommand({ kind: 'settle', field: aargangRef, raw: '   ', location: LOC });
    expect(translated?.command.kind).toBe('clearField');
  });

  it('replacement-generationen fastholdes ved åbning', () => {
    const editor = openEditor(
      createClosedEditor(aargangRef, LOC),
      viewOf(aargangRef),
      store.getState().replacementGeneration
    );
    expect(editor.open?.openedAtReplacementGeneration).toBe(store.getState().replacementGeneration);
  });

  it('isSettleStale opdager en autoritativ replacement, mens editoren er åben (§3.5)', () => {
    const editor = changeDraft(openEditor(
      createClosedEditor(aargangRef, LOC),
      viewOf(aargangRef),
      store.getState().replacementGeneration
    ), '2010');
    expect(isSettleStale(editor, store.getState().replacementGeneration)).toBe(false);

    // Et almindeligt commit må ikke ligne en replacement.
    dispatchInput(store, catalog, settleField(aargangRef, '2020'), {});
    expect(isSettleStale(editor, store.getState().replacementGeneration)).toBe(false);

    // En autoritativ hel-sags-replacement hæver kun replacement-generationen.
    dispatchInput(store, catalog, clearCase(), {});
    expect(isSettleStale(editor, store.getState().replacementGeneration)).toBe(true);

    // En lukket editor er aldrig stale.
    expect(isSettleStale(cancelEditor(editor), store.getState().replacementGeneration)).toBe(false);
  });
});

describe('felt-editor i dynamisk række — placeholder-first-invalid overlever (§1.11)', () => {
  it('første fejlende settle i en ny række promoverer rækken og bevarer den rå tekst', () => {
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('row-a')), { origin: testRowOrigin() });
    const belob = belobField.bind('row-a');
    dispatchSettle(settleEditor(changeDraft(openEditor(createClosedEditor(belob, { locationId: 'grid:belob:row-a' }), deriveSettledFieldView(store.getState().input, belob), store.getState().replacementGeneration), 'ikke-et-beløb')));

    const view = deriveSettledFieldView(store.getState().input, belob);
    expect(view.kind).toBe('rejected');
    expect(view.kind === 'rejected' && view.rejected.raw).toBe('ikke-et-beløb');
    // rækken findes stadig
    expect(catalog.listEntityIds(store.getState().input.sections, rentekravRowsRef())).toContain('row-a');
  });
});
