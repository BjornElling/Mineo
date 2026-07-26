// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../inputCore/runtime/slimInputStore';
import React from 'react';
import { act, render } from '@testing-library/react';
import type { LoadFileResult, LoadPreflightWarning, SaveFileResult } from '../../types/fileOperations';

// ─── I/O-grænse-mocks ───────────────────────────────────────────────────────
// useFileSaveLoad ejer orkestreringen (preflight-gating, atomisk apply, fokus-restore,
// markSaved-bogføring). Selve fil-I/O og persistence-apply mockes på modulgrænsen, så
// testene hævder hookens invarianter — ikke de underliggende utils' implementering.
//
// Greenfield (WI-002 Fase 4): hooken forbruger nu de rene case-porte (`ops`) + den greenfield
// `CriticalActionCoordinator` (`criticalActions`) i stedet for det legacy args-interface
// (`combinedSectionRevisionRef`/`replaceAllPersistedData`/`getFirstBlockingInputError` osv.).
// Save/hent-tilstand drives derfor gennem den ægte produktions-runtime:
//  - "ugyldige felter blokerer save" → et REJECTED format-råinput settles på et rigtigt felt.
//  - "åbent felt kan ikke committes" → en åben editor i `activeEditorRegistry`, hvis settle KASTER
//    (fail-closed `blocked`, §1.4). Bemærk: åben editor blokerer KUN save/navigate — load er
//    `replace`-policy og settler/blokeres ALDRIG (§1.4), så "hent"-testen hævder nu det modsatte.
//  - `executePersistenceLoadApply` mockes, men KALDER den injicerede `applySnapshot`, så den ægte
//    `replaceCase` kører og hæver `replacementGeneration` (coordinatorens apply-guard, §7).

const saveToFileMock = vi.fn<(...args: unknown[]) => Promise<SaveFileResult>>();
const loadFromFileMock = vi.fn<(...args: unknown[]) => Promise<LoadFileResult>>();
const loadFromFileHandleMock = vi.fn<(...args: unknown[]) => Promise<LoadFileResult>>();
const executePersistenceLoadApplyMock =
  vi.fn<(...args: [{ result: { snapshot?: unknown }; applySnapshot: (snapshot: unknown) => void }]) =>
    Promise<{ status: 'applied' } | { status: 'applied-with-metadata-error'; message: string }>>();

vi.mock('../../utils/fileSave', () => ({
  saveToFile: (...args: unknown[]) => saveToFileMock(...args),
  SaveValidationError: class FakeSaveValidationError extends Error {},
}));

vi.mock('../../utils/fileLoad', () => ({
  loadFromFile: (...args: unknown[]) => loadFromFileMock(...args),
  loadFromFileHandle: (...args: unknown[]) => loadFromFileHandleMock(...args),
}));

vi.mock('../../utils/persistenceLoadApply', () => ({
  executePersistenceLoadApply: (
    args: { result: { snapshot?: unknown }; applySnapshot: (snapshot: unknown) => void }
  ) => executePersistenceLoadApplyMock(args),
}));

vi.mock('../../utils/fileHelpers', () => ({
  resolveDefaultDirectoryHandle: vi.fn(async () => undefined),
}));

vi.mock('../../utils/fileHandleStorage', () => ({
  deleteFileHandleFromIndexedDB: vi.fn(async () => undefined),
}));

import { useFileSaveLoad, type OverlayData } from '../../hooks/useFileSaveLoad';
import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../inputCore/react/productionInputRuntime';
import { useCaseOperations, useCriticalInputActions } from '../../inputCore/react';
import { slimInputStore } from '../../inputCore/runtime/slimInputStore';
import { dispatchInput } from '../../inputCore/runtime/dispatchInput';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { activeEditorRegistry, type ActiveEditor } from '../../inputCore/runtime/activeEditorRegistry';
import { reduceInputCommand, settleField } from '../../inputCore/inputReducer';
import { satserAargangField } from '../../inputCore/catalog/satserDescriptors';
import type { SettledInput } from '../../inputCore/settledInput';

type HookApi = ReturnType<typeof useFileSaveLoad>;

type HarnessHandles = {
  api: HookApi | null;
  markSaved: ReturnType<typeof vi.fn<(revision: number) => void>>;
  showOverlay: ReturnType<typeof vi.fn<(overlay: OverlayData) => void>>;
  allowExitWithoutWarning: ReturnType<typeof vi.fn<() => void>>;
  navigate: ReturnType<typeof vi.fn<(to: string, opts?: unknown) => void>>;
};

const catalog = getProductionInputCatalog();

const emptyInput = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
    renteberegning: null, varigemen: null, forsoergertab: null,
    erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

/** Data-present canonical input (et velformet satsår → hasAnyData=true). */
const inputWithData = (): SettledInput =>
  reduceInputCommand(emptyInput(), settleField(satserAargangField.bind(), '2020'), catalog).input;

/** Et REJECTED format-råinput (ikke-parsebart satsår) → blokerer save (§1.6). */
const inputWithRejected = (): SettledInput =>
  reduceInputCommand(emptyInput(), settleField(satserAargangField.bind(), 'ikke-et-tal'), catalog).input;

/** Registrerer en åben editor, hvis settle KASTER → fail-closed `blocked` (§1.4 settle-policy). */
let unregisterEditor: (() => void) | null = null;
const registerEditorThatFailsSettle = (): void => {
  const editor: ActiveEditor = {
    id: 'test-open-editor',
    isEditing: () => true,
    settle: () => {
      throw new Error('Simuleret uventet settle-fejl');
    },
    discard: () => {},
  };
  unregisterEditor = activeEditorRegistry.register(editor);
};

const renderHook = (
  overrides: {
    hasData?: boolean;
    rejected?: boolean;
    openEditorFailsSettle?: boolean;
  } = {}
): HarnessHandles => {
  // Hydrér den ægte runtime FØR mount, så porten ser præcis den tilsigtede tilstand.
  const initialInput = overrides.rejected
    ? inputWithRejected()
    : overrides.hasData
      ? inputWithData()
      : emptyInput();
  __hydrateSlimInputStoreForTest(slimInputStore, initialInput);

  if (overrides.openEditorFailsSettle) {
    registerEditorThatFailsSettle();
  }

  const handles: HarnessHandles = {
    api: null,
    markSaved: vi.fn<(revision: number) => void>(),
    showOverlay: vi.fn<(overlay: OverlayData) => void>(),
    allowExitWithoutWarning: vi.fn<() => void>(),
    navigate: vi.fn<(to: string, opts?: unknown) => void>(),
  };

  const Harness = () => {
    const ops = useCaseOperations();
    const criticalActions = useCriticalInputActions();
    handles.api = useFileSaveLoad({
      settings: DEFAULT_APP_SETTINGS,
      navigate: handles.navigate as unknown as Parameters<typeof useFileSaveLoad>[0]['navigate'],
      currentPathname: '/stamdata',
      ops,
      criticalActions,
      markSaved: handles.markSaved,
      allowExitWithoutWarning: handles.allowExitWithoutWarning,
      showOverlay: handles.showOverlay,
    });
    return null;
  };

  render(
    <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
      <Harness />
    </ProductionInputRuntimeProvider>,
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
    // Kald den ægte applySnapshot, så replaceCase kører og replacementGeneration hæves
    // (coordinatorens applyReplacement-guard, §7). Ellers ville et mocket no-op apply kaste.
    executePersistenceLoadApplyMock.mockImplementation(async (args) => {
      args.applySnapshot(args.result.snapshot ?? {});
      return { status: 'applied' };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    unregisterEditor?.();
    unregisterEditor = null;
    __hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  describe('handleGem', () => {
    it('blokerer gem ved ugyldige felter og rører aldrig saveToFile', async () => {
      const handles = renderHook({ rejected: true });

      await act(async () => {
        await handles.api?.handleGem();
      });

      expect(saveToFileMock).not.toHaveBeenCalled();
      expect(handles.markSaved).not.toHaveBeenCalled();
      expect(handles.showOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning' })
      );
    });

    it('blokerer Gem når et åbent felt ikke kan committes og starter aldrig fil-I/O', async () => {
      const handles = renderHook({ openEditorFailsSettle: true });

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
      const handles = renderHook({ hasData: true });
      const expectedRevision = Number(slimInputStore.getState().revision);
      saveToFileMock.mockResolvedValue({ status: 'saved', filename: 'sag.eo', fieldCount: 1, sections: 1, verified: false });

      await act(async () => {
        await handles.api?.handleGem();
      });

      expect(handles.markSaved).toHaveBeenCalledWith(expectedRevision);
      expect(handles.showOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      );
    });

    // Critical-action-kontrakten §5: fil-pickeren ligger INDE i `saveToFile`, så friskheds-kontrollen injiceres
    // som callback og evalueres først EFTER target-resolution. Denne test simulerer, at brugeren ændrer sagen,
    // mens dialogen er åben: mocken kalder callbacken efter en mutation og skal da se den som stale.
    it('afbryder gem fail-closed, når sagen ændres mens fil-pickeren er åben (ingen skrivning)', async () => {
      const handles = renderHook({ hasData: true });
      let freshnessVerdict: boolean | undefined;

      saveToFileMock.mockImplementation(async (...args: unknown[]) => {
        const isSourceStillCurrent = args[2] as (() => boolean) | undefined;
        // Brugeren redigerer, mens pickeren står åben → ny inputrevision.
        dispatchInput(
          slimInputStore,
          getProductionInputCatalog(),
          settleField(satserAargangField.bind(), '2031')
        );
        freshnessVerdict = isSourceStillCurrent?.();
        return freshnessVerdict === false ? { status: 'stale' } : { status: 'saved', filename: 'sag.eo' };
      });

      await act(async () => {
        await handles.api?.handleGem();
      });

      expect(freshnessVerdict).toBe(false);
      expect(handles.markSaved).not.toHaveBeenCalled();
      expect(handles.showOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning', message: expect.stringContaining('ændret undervejs') })
      );
    });
  });

  describe('serialisering af filhandlinger', () => {
    it('afviser en ny manuel filhandling, mens Gem stadig er i gang', async () => {
      let resolveSave: ((result: SaveFileResult) => void) | undefined;
      saveToFileMock.mockImplementation(() => new Promise((resolve) => {
        resolveSave = resolve;
      }));
      const handles = renderHook({ hasData: true });
      let firstSave: Promise<void> | undefined;

      await act(async () => {
        firstSave = handles.api?.handleGem();
        await Promise.resolve();
      });
      expect(handles.api?.fileOperationInProgress).toBe(true);

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(loadFromFileMock).not.toHaveBeenCalled();
      expect(handles.showOverlay).toHaveBeenLastCalledWith({
        message: 'En filhandling er allerede i gang.',
        type: 'warning',
      });

      await act(async () => {
        resolveSave?.({ status: 'saved', filename: 'sag.eo' });
        await firstSave;
      });
      expect(handles.api?.fileOperationInProgress).toBe(false);
    });
  });

  describe('handleHent — atomisk preflight-gating', () => {
    it('gennemfører hent uden settle selv med en åben editor (load er replace-policy, §1.4)', async () => {
      // Rebaset §1.4: en åben editor blokerer ALDRIG load — coordinatorens `prepare("load")` er
      // replace-policy (settler ikke). Load gennemføres, og draften kasseres først ved succes.
      const handles = renderHook({ openEditorFailsSettle: true });
      loadFromFileMock.mockResolvedValue(successfulLoad());

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(loadFromFileMock).toHaveBeenCalledTimes(1);
      expect(executePersistenceLoadApplyMock).toHaveBeenCalledTimes(1);
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
    });

    it('går til overskriv-bekræftelse (ingen apply) når der allerede findes data', async () => {
      const handles = renderHook({ hasData: true });
      loadFromFileMock.mockResolvedValue(successfulLoad());

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(handles.api?.pendingOverwriteApply).not.toBeNull();
      expect(executePersistenceLoadApplyMock).not.toHaveBeenCalled();
    });

    it('anvender data straks ved tom state uden preflight-advarsel', async () => {
      const handles = renderHook({ hasData: false });
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
      const handles = renderHook({ hasData: true });
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
      const handles = renderHook({ hasData: false });
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
      const handles = renderHook({ hasData: true });
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
      const handles = renderHook({ hasData: true });
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
