// @vitest-environment jsdom
//
// Regressionstest for undo/redo celle-identitet i useRowDrafts-baserede tabeller.
//
// Invariant: et tabel-celle-commit skal tagge history-framet med den redigerede celles
// identitet (fieldPath = `rowId:colIndex`), så undo/redo lander fokus på den rigtige celle.
// Uden fieldColIndex-mappingen falder origin tilbage til focus-trackeren, som ved blur
// peger på det *næste* felt — det var rodårsagen bag de oprindelige undo-fokus-fejl.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../contexts/RoutePathnameProvider';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { __resetUndoRedoStoreForTests, undoRedoStore } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import type { ISODateString } from '../../types/branded';
import { erstatningsopgoerelseSchema, type TafPeriodeRow } from '../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { installUndoFocusTracker, __resetUndoFocusTrackerForTests } from '../../utils/undoFocusTracker';
import { toISODateString } from '../../types/branded';

type TafDraftRow = { id: string; fra: string; til: string };

// To celler i samme tabel: kolonne 0 (fra) og kolonne 1 (til).
// Hver celle bærer sit eget undo-field-path (rowId:colIndex), præcis som de rigtige
// Table*Input-celler gør. commitRow committer via useRowDrafts → setCommitted → setValues.
const TableUndoPage = () => {
  const form = usePersistedForm(
    erstatningsopgoerelseSchema,
    'erstatningsopgoerelse',
    createErstatningsopgoerelseInitialValues()
  );
  const nextIdRef = React.useRef(1);
  const rows = useRowDrafts<TafDraftRow, TafPeriodeRow, 'fra' | 'til'>({
    getCommitted: () => form.values.tafPerioder,
    setCommitted: (updater, origin) => {
      form.setValues((prev) => ({
        ...prev,
        tafPerioder: updater(prev.tafPerioder) ?? prev.tafPerioder,
      }), origin);
    },
    toDraft: (committedRows) =>
      committedRows.map((row) => ({ id: row.id, fra: row.fra ?? '', til: row.til ?? '' })),
    toCommittedRow: (draft, previous) => ({
      id: draft.id,
      fra: draft.fra ? (draft.fra as ISODateString) : undefined,
      til: draft.til ? (draft.til as ISODateString) : undefined,
      loseFeriedage: previous?.loseFeriedage,
    }),
    isRowEmpty: (row) => row.fra === undefined && row.til === undefined && row.loseFeriedage === undefined,
    ensureRows: (committedRows) => (committedRows && committedRows.length > 0 ? committedRows : [{ id: 'empty' }]),
    createId: () => `r${nextIdRef.current++}`,
    createEmptyCommittedRow: (id) => ({ id }),
    fieldColIndex: { fra: 0, til: 1 },
    resyncToken: form.formVersion,
  });

  return (
    <div>
      {rows.draftRows.map((row) => (
        <React.Fragment key={row.id}>
          <input
            data-testid={`fra-${row.id}`}
            data-mineo-undo-field-path={`${row.id}:0`}
            value={row.fra}
            onChange={(event) => rows.onFieldChange(row.id, 'fra')(event.target.value)}
            onBlur={() => rows.commitRow(row.id)}
          />
          <input
            data-testid={`til-${row.id}`}
            data-mineo-undo-field-path={`${row.id}:1`}
            value={row.til}
            onChange={(event) => rows.onFieldChange(row.id, 'til')(event.target.value)}
            onBlur={() => rows.commitRow(row.id)}
          />
        </React.Fragment>
      ))}
    </div>
  );
};

const renderHarness = () =>
  render(
    <MemoryRouter initialEntries={['/erstatningsopgoerelse']}>
      <AppSettingsProvider>
        <RoutePathnameProvider>
          <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
            <Routes>
              <Route path="/erstatningsopgoerelse" element={<TableUndoPage />} />
            </Routes>
          </FormPersistenceProvider>
        </RoutePathnameProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );

describe('undo/redo celle-identitet (repro)', () => {
  beforeEach(() => {
    __resetUndoRedoStoreForTests();
    __resetUndoFocusTrackerForTests();
    formPersistenceStore.setState({
      sections: { ...formPersistenceStore.getState().sections, erstatningsopgoerelse: null },
      meta: { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
    });
    installUndoFocusTracker();
  });

  const pastOrigins = () => undoRedoStore.getState().past.map((frame) => frame.origin.fieldPath);

  // Den initiale række får et genereret id; vi læser det fra DOM i stedet for at hardcode.
  const findCells = (container: HTMLElement) => {
    const fra = container.querySelector('input[data-testid^="fra-"]') as HTMLInputElement;
    const til = container.querySelector('input[data-testid^="til-"]') as HTMLInputElement;
    const rowId = fra.getAttribute('data-mineo-undo-field-path')!.replace(/:0$/, '');
    return { fra, til, rowId };
  };

  it('tagger hvert celle-commit med den redigerede celles fieldPath', () => {
    const { container } = renderHarness();
    const { fra, til, rowId } = findCells(container);

    // Rediger celle 0 (fra), tab væk → blur committer celle 0 mens fokus er på celle 1.
    act(() => {
      fireEvent.change(fra, { target: { value: toISODateString('2024-01-01') } });
    });
    act(() => {
      til.focus(); // fokus flytter til celle 1 FØR commit (som ved tab)
      fireEvent.blur(fra);
    });

    // Rediger celle 1 (til), tab væk.
    act(() => {
      fireEvent.change(til, { target: { value: toISODateString('2024-02-01') } });
    });
    act(() => {
      fireEvent.blur(til);
    });

    // FORVENTNING: to frames, hver tagget med sin egen celle.
    // RØD NU: framet for celle 0 bliver tagget med "<rowId>:1" (focus-trackerens næste felt),
    // ikke "<rowId>:0".
    const origins = pastOrigins();
    expect(origins).toContain(`${rowId}:0`);
    expect(origins).toContain(`${rowId}:1`);
  });

  it('skaber ét frame pr. celle-commit (ikke ét samlet)', () => {
    const { container } = renderHarness();
    const { fra, til } = findCells(container);

    act(() => {
      fireEvent.change(fra, { target: { value: toISODateString('2024-01-01') } });
      fireEvent.blur(fra);
    });
    act(() => {
      fireEvent.change(til, { target: { value: toISODateString('2024-02-01') } });
      fireEvent.blur(til);
    });

    // To distinkte brugerhandlinger → to undo-frames.
    expect(undoRedoStore.getState().past).toHaveLength(2);
  });
});
