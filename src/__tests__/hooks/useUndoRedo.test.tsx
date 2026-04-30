// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { useRowDrafts } from '../../rowDrafts/useRowDrafts';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import Stamdata from '../../components/pages/Stamdata';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { undoRedoStore, type HistoryFrameOrigin } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import type { ISODateString } from '../../types/branded';
import { erstatningsopgoerelseSchema, type TafPeriodeRow } from '../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { installUndoFocusTracker, __resetUndoFocusTrackerForTests } from '../../utils/undoFocusTracker';

const VALID_META = { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION };

type UndoRedoControls = ReturnType<typeof useUndoRedo>;
type TafDraftRow = { id: string; fra: string };

const origin: HistoryFrameOrigin = {
  route: '/target',
  tabKey: 'b',
  sectionKey: 'satser',
  fieldPath: 'shared-field',
  focusToken: null,
};

const stamdataOrigin: HistoryFrameOrigin = {
  route: '/stamdata',
  tabKey: null,
  sectionKey: 'stamdata',
  fieldPath: 'skadelidteFodselsdato',
  focusToken: null,
};

const createStamdataOrigin = (fieldPath: string): HistoryFrameOrigin => ({
  ...stamdataOrigin,
  fieldPath,
});

let controls: UndoRedoControls | null = null;

const Controls = () => {
  controls = useUndoRedo();
  return (
    <Routes>
      <Route path="/current" element={<div>Current</div>} />
      <Route path="/target" element={<TargetPage />} />
    </Routes>
  );
};

const TargetPage = () => {
  const { activeTab } = usePersistedActiveTab<'a' | 'b'>({
    pageId: 'target',
    allowedTabs: ['a', 'b'],
    defaultTab: 'a',
  });

  return (
    <div>
      <div data-testid="active-tab">{activeTab}</div>
      <div hidden={activeTab !== 'a'} style={{ display: activeTab === 'a' ? 'block' : 'none' }}>
        <input data-testid="hidden-target" data-mineo-undo-field-path="shared-field" />
      </div>
      <div data-section-id="target-section" hidden={activeTab !== 'b'} style={{ display: activeTab === 'b' ? 'block' : 'none' }}>
        <input data-testid="visible-target" data-mineo-undo-field-path="shared-field" />
      </div>
    </div>
  );
};

const StamdataControls = () => {
  controls = useUndoRedo();
  return (
    <Routes>
      <Route path="/satser" element={<div>Satser</div>} />
      <Route path="/stamdata" element={<Stamdata />} />
    </Routes>
  );
};

const TableUndoPage = () => {
  const form = usePersistedForm(
    erstatningsopgoerelseSchema,
    'erstatningsopgoerelse',
    createErstatningsopgoerelseInitialValues()
  );
  const nextIdRef = React.useRef(1);
  const rows = useRowDrafts<TafDraftRow, TafPeriodeRow, 'fra'>({
    getCommitted: () => form.values.tafPerioder,
    setCommitted: (updater) => {
      form.setValues((prev) => ({
        ...prev,
        tafPerioder: updater(prev.tafPerioder) ?? prev.tafPerioder,
      }));
    },
    toDraft: (committedRows) => committedRows.map((row) => ({ id: row.id, fra: row.fra ?? '' })),
    toCommittedRow: (draft, previous) => ({
      id: draft.id,
      fra: draft.fra ? draft.fra as ISODateString : undefined,
      til: previous?.til,
      loseFeriedage: previous?.loseFeriedage,
    }),
    isRowEmpty: (row) => row.fra === undefined && row.til === undefined && row.loseFeriedage === undefined,
    ensureRows: (committedRows) => (committedRows && committedRows.length > 0 ? committedRows : [{ id: 'empty' }]),
    createId: () => `r${nextIdRef.current++}`,
    createEmptyCommittedRow: (id) => ({ id }),
    resyncToken: form.formVersion,
  });

  return (
    <div>
      {rows.draftRows.map((row) => (
        <input
          key={row.id}
          data-testid={`taf-${row.id}`}
          data-mineo-undo-field-path={`${row.id}:0`}
          value={row.fra}
          onChange={(event) => rows.onFieldChange(row.id, 'fra')(event.target.value)}
          onBlur={() => rows.commitRow(row.id)}
        />
      ))}
      <button type="button" onClick={() => rows.addRow()}>Tilføj</button>
      <button type="button" onClick={() => rows.removeRow('r1')}>Slet r1</button>
    </div>
  );
};

const TableControls = () => {
  controls = useUndoRedo();
  return (
    <Routes>
      <Route path="/table" element={<TableUndoPage />} />
    </Routes>
  );
};

const renderStamdataUndoHarness = () => render(
  <MemoryRouter initialEntries={['/satser']}>
    <AppSettingsProvider>
      <FormPersistenceProvider>
        <StamdataControls />
      </FormPersistenceProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

const renderTableUndoHarness = () => render(
  <MemoryRouter initialEntries={['/table']}>
    <AppSettingsProvider>
      <FormPersistenceProvider>
        <TableControls />
      </FormPersistenceProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

const flushAnimationFrames = (rafCallbacks: FrameRequestCallback[], count = 10): void => {
  for (let i = 0; i < count; i += 1) {
    if (rafCallbacks.length === 0) return;
    act(() => {
      const callbacks = rafCallbacks.splice(0);
      callbacks.forEach((callback) => callback(performance.now()));
    });
  }
};

const getUndoField = (fieldPath: string): HTMLInputElement => {
  const target = document.querySelector(`[data-mineo-undo-field-path="${fieldPath}"]`);
  expect(target).toBeInstanceOf(HTMLInputElement);
  return target as HTMLInputElement;
};

describe('useUndoRedo', () => {
  beforeEach(() => {
    sessionStorage.clear();
    formPersistenceStore.getState().clearAll(VALID_META);
    formPersistenceStore.getState().clearAllFieldErrors();
    undoRedoStore.getState().clear();
    __resetUndoFocusTrackerForTests();
    installUndoFocusTracker();
    controls = null;
  });

  it('fokuserer feltet på den aktive fane efter undo til anden side', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });

    formPersistenceStore.getState().commitSection('satser', { aargang: 2025 }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    undoRedoStore.getState().capture(origin);
    formPersistenceStore.getState().commitSection('satser', { aargang: 2024 }, { schemaFingerprint: PERSISTED_DATA_VERSION });

    render(
      <MemoryRouter initialEntries={['/current']}>
        <Controls />
      </MemoryRouter>
    );

    act(() => {
      controls?.undo();
    });

    for (let i = 0; i < 10 && document.activeElement !== screen.queryByTestId('visible-target'); i += 1) {
      act(() => {
        const callbacks = rafCallbacks.splice(0);
        callbacks.forEach((callback) => callback(performance.now()));
      });
    }

    expect(screen.getByTestId('active-tab')).toHaveTextContent('b');
    expect(document.activeElement).toBe(screen.getByTestId('visible-target'));

    requestAnimationFrameSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('fokuserer Fødselsdato på Stamdata efter undo fra en anden side', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    renderStamdataUndoHarness();

    act(() => {
      formPersistenceStore.getState().commitSection('stamdata', {
        skadelidteFodselsdato: '1980-01-01' as ISODateString,
      }, { schemaFingerprint: PERSISTED_DATA_VERSION });
      undoRedoStore.getState().capture(stamdataOrigin);
      formPersistenceStore.getState().commitSection('stamdata', {
        skadelidteFodselsdato: '1981-01-01' as ISODateString,
      }, { schemaFingerprint: PERSISTED_DATA_VERSION });
      controls?.undo();
    });

    for (
      let i = 0;
      i < 10 && document.activeElement !== document.querySelector('[data-mineo-undo-field-path="skadelidteFodselsdato"]');
      i += 1
    ) {
      act(() => {
        const callbacks = rafCallbacks.splice(0);
        callbacks.forEach((callback) => callback(performance.now()));
      });
    }

    const target = document.querySelector('[data-mineo-undo-field-path="skadelidteFodselsdato"]');
    expect(target).toBeInstanceOf(HTMLInputElement);
    expect(document.activeElement).toBe(target);

    requestAnimationFrameSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('gendanner synlige Stamdata-drafts stabilt gennem flere undo og redo', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    renderStamdataUndoHarness();

    act(() => {
      undoRedoStore.getState().capture(createStamdataOrigin('journalnr'));
      formPersistenceStore.getState().commitSection('stamdata', {
        journalnr: 'SAG-1',
      }, { schemaFingerprint: PERSISTED_DATA_VERSION });

      undoRedoStore.getState().capture(createStamdataOrigin('skadelidte'));
      formPersistenceStore.getState().commitSection('stamdata', {
        journalnr: 'SAG-1',
        skadelidte: 'Test Person',
      }, { schemaFingerprint: PERSISTED_DATA_VERSION });

      undoRedoStore.getState().capture(createStamdataOrigin('skadelidteFodselsdato'));
      formPersistenceStore.getState().commitSection('stamdata', {
        journalnr: 'SAG-1',
        skadelidte: 'Test Person',
        skadelidteFodselsdato: '1980-01-01' as ISODateString,
      }, { schemaFingerprint: PERSISTED_DATA_VERSION });
    });

    act(() => {
      controls?.undo();
    });
    flushAnimationFrames(rafCallbacks);
    expect(getUndoField('journalnr')).toHaveValue('SAG-1');
    expect(getUndoField('skadelidte')).toHaveValue('Test Person');
    expect(getUndoField('skadelidteFodselsdato')).toHaveValue('');

    act(() => {
      controls?.undo();
    });
    flushAnimationFrames(rafCallbacks);
    expect(getUndoField('journalnr')).toHaveValue('SAG-1');
    expect(getUndoField('skadelidte')).toHaveValue('');
    expect(getUndoField('skadelidteFodselsdato')).toHaveValue('');

    act(() => {
      controls?.undo();
    });
    flushAnimationFrames(rafCallbacks);
    expect(getUndoField('journalnr')).toHaveValue('');
    expect(getUndoField('skadelidte')).toHaveValue('');
    expect(getUndoField('skadelidteFodselsdato')).toHaveValue('');

    act(() => {
      controls?.redo();
    });
    flushAnimationFrames(rafCallbacks);
    expect(getUndoField('journalnr')).toHaveValue('SAG-1');
    expect(getUndoField('skadelidte')).toHaveValue('');
    expect(getUndoField('skadelidteFodselsdato')).toHaveValue('');

    act(() => {
      controls?.redo();
    });
    flushAnimationFrames(rafCallbacks);
    expect(getUndoField('journalnr')).toHaveValue('SAG-1');
    expect(getUndoField('skadelidte')).toHaveValue('Test Person');
    expect(getUndoField('skadelidteFodselsdato')).toHaveValue('');

    act(() => {
      controls?.redo();
    });
    flushAnimationFrames(rafCallbacks);
    expect(getUndoField('journalnr')).toHaveValue('SAG-1');
    expect(getUndoField('skadelidte')).toHaveValue('Test Person');
    expect(getUndoField('skadelidteFodselsdato')).toHaveValue('01-01-1980');

    requestAnimationFrameSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('gendanner ugyldig dato via fieldPath selv når focusToken peger på næste felt', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    renderStamdataUndoHarness();

    act(() => {
      undoRedoStore.getState().capture({
        ...createStamdataOrigin('skadelidteFodselsdato'),
        focusToken: 'wrong-focused-field-token',
      });
      formPersistenceStore.getState().setFieldError('stamdata', 'skadelidteFodselsdato', 'input', {
        message: 'Ugyldig dato',
        severity: 'error',
        blocksSave: true,
        invalidDraft: '32-13-1980',
      });
    });

    act(() => {
      controls?.undo();
    });
    flushAnimationFrames(rafCallbacks);
    expect(getUndoField('skadelidteFodselsdato')).toHaveValue('');

    act(() => {
      controls?.redo();
    });
    flushAnimationFrames(rafCallbacks);
    expect(getUndoField('skadelidteFodselsdato')).toHaveValue('32-13-1980');
    expect(document.activeElement).toBe(getUndoField('skadelidteFodselsdato'));

    requestAnimationFrameSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('undo af tilføjet tabelrække fjerner rækken og resyncer row-drafts', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    renderTableUndoHarness();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Tilføj' }));
    });
    expect(screen.getByTestId('taf-r1')).toHaveValue('');
    expect(screen.getAllByRole('textbox')).toHaveLength(2);

    act(() => {
      controls?.undo();
    });
    flushAnimationFrames(rafCallbacks);

    expect(screen.queryByTestId('taf-r1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    requestAnimationFrameSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('undo af slettet tabelrække gendanner række og indhold i row-drafts', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    renderTableUndoHarness();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Tilføj' }));
    });
    const rowInput = screen.getByTestId('taf-r1');
    act(() => {
      rowInput.focus();
      fireEvent.change(rowInput, { target: { value: '2024-01-01' } });
      fireEvent.blur(rowInput);
    });
    expect(screen.getByTestId('taf-r1')).toHaveValue('2024-01-01');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Slet r1' }));
    });
    expect(screen.queryByTestId('taf-r1')).not.toBeInTheDocument();

    act(() => {
      controls?.undo();
    });
    flushAnimationFrames(rafCallbacks);

    expect(screen.getByTestId('taf-r1')).toHaveValue('2024-01-01');
    const restoredInputs = screen.getAllByRole('textbox');
    expect(restoredInputs).toHaveLength(2);
    expect(restoredInputs.some((input) => (input as HTMLInputElement).value === '')).toBe(true);

    requestAnimationFrameSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });
});
