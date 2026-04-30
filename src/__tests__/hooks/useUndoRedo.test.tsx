// @vitest-environment jsdom
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePersistedActiveTab } from '../../hooks/usePersistedActiveTab';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import Stamdata from '../../components/pages/Stamdata';
import { formPersistenceStore } from '../../stores/formPersistenceStore';
import { undoRedoStore, type HistoryFrameOrigin } from '../../stores/undoRedoStore';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import type { ISODateString } from '../../types/branded';

const VALID_META = { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION };

type UndoRedoControls = ReturnType<typeof useUndoRedo>;

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

const renderStamdataUndoHarness = () => render(
  <MemoryRouter initialEntries={['/satser']}>
    <AppSettingsProvider>
      <FormPersistenceProvider>
        <StamdataControls />
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
});
