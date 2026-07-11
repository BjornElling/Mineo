// @vitest-environment jsdom
//
// REPRO af brugerrapporteret fejl (2026-06-15): en ugyldig værdi i en TABEL-datocelle kan ikke
// fortrydes (undo) efter at den er ryddet. Roden: useCellInvalidDraftChannel.clearInvalidDraft
// sendte IKKE en undoOrigin med (i modsætning til onCommitInvalid og til de almindelige felters
// clearInvalidDraftForField), så rydningen fangede ingen undo-frame → undo sprang rydningen over.
import * as React from 'react';
import { act, render } from '@testing-library/react';
import { useCellInvalidDraftChannel } from '../../../hooks/tableInput/useCellInvalidDraftChannel';
import { CellInvalidDraftScopeProvider } from '../../../contexts/CellInvalidDraftScopeContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../contexts/FormPersistenceContext';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore } from '../../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { CELL_TABLE_IDS, buildCellInvalidDraftFieldPath } from '../../../config/cellInvalidDraftScopes';

type Channel = ReturnType<typeof useCellInvalidDraftChannel>;
let channel: Channel | null = null;

const Probe = ({ gridCellKey }: { gridCellKey: string }) => {
  channel = useCellInvalidDraftChannel(gridCellKey);
  return null;
};

const renderProbe = (gridCellKey: string) =>
  render(
    <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
      <CellInvalidDraftScopeProvider pageKey="erstatningsopgoerelse" tableId={CELL_TABLE_IDS.eoOffentligeYdelser}>
        <Probe gridCellKey={gridCellKey} />
      </CellInvalidDraftScopeProvider>
    </FormPersistenceProvider>
  );

const fieldPath = buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.eoOffentligeYdelser, '', 'row1:2');
const draftsForSection = () => formPersistenceStore.getState().invalidDrafts.erstatningsopgoerelse ?? {};

describe('tabelcelle invalidDraft → undo-frame-capture', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetUndoRedoStoreForTests();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      persistedDataVersion: PERSISTED_DATA_VERSION,
      lastCommittedAt: 1,
    });
    channel = null;
  });

  it('rydning af en ugyldig celle-draft fanger sin EGEN undo-frame', () => {
    renderProbe('row1:2');

    // 1) Ugyldigt input committeres → fanger frame F1 (pre-state: tom).
    act(() => { channel!.onCommitInvalid!('12'); });
    expect(draftsForSection()[fieldPath]).toBe('12');
    const pastAfterCommit = undoRedoStore.getState().past.length;
    expect(pastAfterCommit).toBe(1);

    // 2) Rydning af den ugyldige draft (svarer til Delete på cellen). SKAL fange en frame F2.
    act(() => { channel!.clearInvalidDraft!(); });
    expect(draftsForSection()[fieldPath]).toBeUndefined();
    expect(undoRedoStore.getState().past.length).toBe(2); // ← fejler før fix (forblev 1)
  });

  it('undo efter rydning gendanner den ugyldige draft', () => {
    renderProbe('row1:2');
    act(() => { channel!.onCommitInvalid!('12'); });
    act(() => { channel!.clearInvalidDraft!(); });
    expect(draftsForSection()[fieldPath]).toBeUndefined();

    // Undo: gendan frame F2's target (committed state FØR rydningen) = invalidDraft "12".
    const plan = undoRedoStore.getState().planUndo();
    expect(plan).not.toBeNull();
    act(() => {
      formPersistenceStore.getState().restoreHistoryFrame(
        plan!.target.sections,
        plan!.target.sectionRevisions,
        plan!.target.fieldErrors,
        plan!.target.fieldErrorRevisions,
        plan!.target.invalidDrafts,
        plan!.target.invalidDraftRevisions,
        plan!.target.meta,
        2
      );
      undoRedoStore.getState().commitPlannedTransition(plan!);
    });

    expect(draftsForSection()[fieldPath]).toBe('12'); // ← fejler før fix (forblev tom)
  });
});
