// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import type { LoadFileResult, LoadPreflightWarning, SaveFileResult } from '../../types/fileOperations';

// ─── I/O-grænse-mocks ───────────────────────────────────────────────────────
// useFileSaveLoad ejer orkestreringen (preflight-gating, atomisk apply, fokus-restore,
// markSaved-bogføring). Selve fil-I/O og persistence-apply mockes på modulgrænsen, så
// testene hævder hookens invarianter — ikke de underliggende utils' implementering.

const saveToFileMock = vi.fn<(...args: unknown[]) => Promise<SaveFileResult>>();
const loadFromFileMock = vi.fn<(...args: unknown[]) => Promise<LoadFileResult>>();
const loadFromFileHandleMock = vi.fn<(...args: unknown[]) => Promise<LoadFileResult>>();
const executePersistenceLoadApplyMock =
  vi.fn<(...args: unknown[]) => Promise<{ status: 'applied' } | { status: 'applied-with-metadata-error'; message: string }>>();

vi.mock('../../utils/fileSave', () => ({
  saveToFile: (...args: unknown[]) => saveToFileMock(...args),
  SaveValidationError: class FakeSaveValidationError extends Error {},
}));

vi.mock('../../utils/fileLoad', () => ({
  loadFromFile: (...args: unknown[]) => loadFromFileMock(...args),
  loadFromFileHandle: (...args: unknown[]) => loadFromFileHandleMock(...args),
}));

vi.mock('../../utils/persistenceLoadApply', () => ({
  executePersistenceLoadApply: (...args: unknown[]) => executePersistenceLoadApplyMock(...args),
}));

vi.mock('../../utils/fileHelpers', () => ({
  resolveDefaultDirectoryHandle: vi.fn(async () => undefined),
}));

vi.mock('../../utils/fileHandleStorage', () => ({
  deleteFileHandleFromIndexedDB: vi.fn(async () => undefined),
}));

vi.mock('../../utils/saveBlockedFocus', () => ({
  navigateToBlockingInputError: vi.fn(async () => undefined),
}));

import { useFileSaveLoad, type OverlayData } from '../../hooks/useFileSaveLoad';
import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';
import type { BlockingInputErrorTarget } from '../../utils/saveBlockedFocus';
import { CriticalActionProvider, useCriticalActionParticipant } from '../../criticalActions/CriticalActionContext';

type HookApi = ReturnType<typeof useFileSaveLoad>;

type HarnessHandles = {
  api: HookApi | null;
  markSaved: ReturnType<typeof vi.fn<(revision: number) => void>>;
  showOverlay: ReturnType<typeof vi.fn<(overlay: OverlayData) => void>>;
  replaceAllPersistedData: ReturnType<typeof vi.fn<(snapshot: unknown) => void>>;
  clearAllData: ReturnType<typeof vi.fn<() => void>>;
  navigate: ReturnType<typeof vi.fn<(to: string, opts?: unknown) => void>>;
};

const blockingError: BlockingInputErrorTarget = {
  kind: 'field',
  pageKey: 'stamdata',
  fieldName: 'skadedato',
  message: 'Ugyldig dato',
};

const renderHook = (
  overrides: {
    hasAnyData?: () => boolean;
    getFirstBlockingInputError?: () => BlockingInputErrorTarget | null;
    activeFormEditor?: boolean;
  } = {}
): HarnessHandles => {
  const handles: HarnessHandles = {
    api: null,
    markSaved: vi.fn<(revision: number) => void>(),
    showOverlay: vi.fn<(overlay: OverlayData) => void>(),
    replaceAllPersistedData: vi.fn<(snapshot: unknown) => void>(),
    clearAllData: vi.fn<() => void>(),
    navigate: vi.fn<(to: string, opts?: unknown) => void>(),
  };

  const Harness = () => {
    useCriticalActionParticipant({
      id: 'test-form-field',
      kind: 'form-field',
      isEditing: () => overrides.activeFormEditor === true,
      commit: () => true,
    });
    const revisionRef = React.useRef(7);
    handles.api = useFileSaveLoad({
      settings: DEFAULT_APP_SETTINGS,
      navigate: handles.navigate as unknown as Parameters<typeof useFileSaveLoad>[0]['navigate'],
      combinedSectionRevisionRef: revisionRef,
      markSaved: handles.markSaved,
      getFirstBlockingInputError: overrides.getFirstBlockingInputError ?? (() => null),
      currentPathname: '/stamdata',
      getPersistedData: () => null,
      replaceAllPersistedData: handles.replaceAllPersistedData as unknown as Parameters<typeof useFileSaveLoad>[0]['replaceAllPersistedData'],
      clearAllData: handles.clearAllData,
      hasAnyData: overrides.hasAnyData ?? (() => false),
      allowExitWithoutWarning: vi.fn(),
      showOverlay: handles.showOverlay,
    });
    return null;
  };

  render(
    <CriticalActionProvider>
      <Harness />
    </CriticalActionProvider>,
  );
  return handles;
};

const successfulLoad = (extra: { preflightWarning?: LoadPreflightWarning } = {}): LoadFileResult => {
  const base = {
    source: 'manual' as const,
    filename: 'sag.eo',
    fieldCount: 1,
    expectedFieldCount: 1,
    sections: 1,
    version: '1.0.0',
    snapshot: {},
  };
  if (extra.preflightWarning) {
    return { status: 'preflight', ...base, preflightWarning: extra.preflightWarning };
  }
  return { status: 'loaded', ...base };
};

describe('useFileSaveLoad', () => {
  beforeEach(() => {
    executePersistenceLoadApplyMock.mockResolvedValue({ status: 'applied' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleGem', () => {
    it('blokerer gem ved ugyldige felter og rører aldrig saveToFile', async () => {
      const handles = renderHook({
        getFirstBlockingInputError: () => blockingError,
      });

      await act(async () => {
        await handles.api?.handleGem();
      });

      expect(saveToFileMock).not.toHaveBeenCalled();
      expect(handles.markSaved).not.toHaveBeenCalled();
      expect(handles.showOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning' })
      );
    });

    it('markerer ikke gemt når brugeren annullerer file picker', async () => {
      const handles = renderHook();
      saveToFileMock.mockResolvedValue({ status: 'cancelled' });

      await act(async () => {
        await handles.api?.handleGem();
      });

      expect(handles.markSaved).not.toHaveBeenCalled();
    });

    it('markerer gemt med den committede revision ved succesfuldt gem', async () => {
      const handles = renderHook();
      saveToFileMock.mockResolvedValue({ status: 'saved', filename: 'sag.eo', fieldCount: 1, sections: 1, verified: false });

      await act(async () => {
        await handles.api?.handleGem();
      });

      expect(handles.markSaved).toHaveBeenCalledWith(7);
      expect(handles.showOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      );
    });
  });

  describe('handleHent — atomisk preflight-gating', () => {
    it('blokerer hent når et aktivt felt ikke kan committes', async () => {
      const handles = renderHook({ activeFormEditor: true });

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(loadFromFileMock).not.toHaveBeenCalled();
      expect(executePersistenceLoadApplyMock).not.toHaveBeenCalled();
    });

    it('sætter pendingLoadResult og anvender IKKE data ved preflight-advarsel', async () => {
      const handles = renderHook();
      loadFromFileMock.mockResolvedValue(
        successfulLoad({ preflightWarning: { loadedCount: 1, issues: [] } })
      );

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(handles.api?.pendingLoadResult).not.toBeNull();
      expect(executePersistenceLoadApplyMock).not.toHaveBeenCalled();
      expect(handles.replaceAllPersistedData).not.toHaveBeenCalled();
    });

    it('går til overskriv-bekræftelse (ingen apply) når der allerede findes data', async () => {
      const handles = renderHook({ hasAnyData: () => true });
      loadFromFileMock.mockResolvedValue(successfulLoad());

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(handles.api?.pendingOverwriteApply).not.toBeNull();
      expect(executePersistenceLoadApplyMock).not.toHaveBeenCalled();
    });

    it('anvender data straks ved tom state uden preflight-advarsel', async () => {
      const handles = renderHook({ hasAnyData: () => false });
      loadFromFileMock.mockResolvedValue(successfulLoad());

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(executePersistenceLoadApplyMock).toHaveBeenCalledTimes(1);
      expect(handles.showOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      );
    });
  });

  describe('handleConfirmOverwriteApply', () => {
    it('anvender det ventende snapshot og navigerer til stamdata', async () => {
      const handles = renderHook({ hasAnyData: () => true });
      loadFromFileMock.mockResolvedValue(successfulLoad());

      await act(async () => {
        await handles.api?.handleHent();
      });
      expect(handles.api?.pendingOverwriteApply).not.toBeNull();

      await act(async () => {
        await handles.api?.handleConfirmOverwriteApply();
      });

      expect(executePersistenceLoadApplyMock).toHaveBeenCalledTimes(1);
      expect(handles.navigate).toHaveBeenCalledWith('/stamdata', { replace: true });
      expect(handles.api?.pendingOverwriteApply).toBeNull();
    });
  });

  describe('handleLoadDespiteIssues', () => {
    it('anvender det ventende preflight-snapshot med advarsels-overlay', async () => {
      const handles = renderHook({ hasAnyData: () => false });
      loadFromFileMock.mockResolvedValue(
        successfulLoad({ preflightWarning: { loadedCount: 1, issues: [] } })
      );

      await act(async () => {
        await handles.api?.handleHent();
      });
      expect(handles.api?.pendingLoadResult).not.toBeNull();

      await act(async () => {
        await handles.api?.handleLoadDespiteIssues();
      });

      expect(executePersistenceLoadApplyMock).toHaveBeenCalledTimes(1);
      expect(handles.showOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning' })
      );
      expect(handles.api?.pendingLoadResult).toBeNull();
    });
  });

  describe('load-flow tilstandsmaskine', () => {
    it('preflight → "Indlæs trods fejl" fører til overskriv-bekræftelse når der findes data (aldrig begge dialoger samtidig)', async () => {
      const handles = renderHook({ hasAnyData: () => true });
      loadFromFileMock.mockResolvedValue(
        successfulLoad({ preflightWarning: { loadedCount: 1, issues: [] } })
      );

      await act(async () => {
        await handles.api?.handleHent();
      });
      // Fase 1: kun preflight-dialogen — de to states er gensidigt udelukkende.
      expect(handles.api?.pendingLoadResult).not.toBeNull();
      expect(handles.api?.pendingOverwriteApply).toBeNull();

      await act(async () => {
        await handles.api?.handleLoadDespiteIssues();
      });
      // Fase 2: preflight lukket, overskriv-bekræftelse åben — stadig kun én ad gangen, ingen apply endnu.
      expect(handles.api?.pendingLoadResult).toBeNull();
      expect(handles.api?.pendingOverwriteApply).not.toBeNull();
      expect(executePersistenceLoadApplyMock).not.toHaveBeenCalled();

      await act(async () => {
        await handles.api?.handleConfirmOverwriteApply();
      });
      expect(executePersistenceLoadApplyMock).toHaveBeenCalledTimes(1);
      expect(handles.api?.pendingLoadResult).toBeNull();
      expect(handles.api?.pendingOverwriteApply).toBeNull();
    });

    it('dismissPendingLoad fører flowet tilbage til idle uden at anvende data', async () => {
      const handles = renderHook({ hasAnyData: () => true });
      loadFromFileMock.mockResolvedValue(successfulLoad());

      await act(async () => {
        await handles.api?.handleHent();
      });
      expect(handles.api?.pendingOverwriteApply).not.toBeNull();

      act(() => {
        handles.api?.dismissPendingLoad();
      });
      expect(handles.api?.pendingOverwriteApply).toBeNull();
      expect(handles.api?.pendingLoadResult).toBeNull();
      expect(executePersistenceLoadApplyMock).not.toHaveBeenCalled();
    });
  });
});
