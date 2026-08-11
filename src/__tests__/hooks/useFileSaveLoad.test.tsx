// @vitest-environment jsdom
import { hydrateSlimInputStoreForTest } from '../../test/actSafeInputStore';
import React from 'react';
import { act, render } from '@testing-library/react';
import type { LoadFileResult, LoadPreflightWarning, SaveFileResult } from '../../types/fileOperations';

// ─── I/O-grænse-mocks ───────────────────────────────────────────────────────
// useFileSaveLoad ejer orkestreringen (preflight-gating, atomisk apply, fokus-restore,
// markSaved-bogføring). Selve fil-I/O og persistence-apply mockes på modulgrænsen, så
// testene hævder hookens invarianter — ikke de underliggende utils' implementering.
//
// Hooken forbruger de rene case-porte (`ops`) + den
// `CriticalActionCoordinator` (`criticalActions`) i stedet for det legacy args-interface
// (`combinedSectionRevisionRef`/`replaceAllPersistedData`/`getFirstBlockingInputError` osv.).
// Save/hent-tilstand drives derfor gennem den ægte produktions-runtime:
//  - "ugyldige felter blokerer save" → et REJECTED format-råinput settles på et rigtigt felt.
//  - "åbent felt kan ikke committes" → en åben editor i `activeEditorRegistry`, hvis settle KASTER
//    (fail-closed `blocked`, §1.4). Bemærk: åben editor blokerer KUN save/navigate — load er
//    `replace`-policy og settler/blokeres ALDRIG (§1.4), så "hent"-testen hævder nu det modsatte.
//  - Load-apply er delt i to mockede halvdele: den SYNKRONE
//    `applyAuthoritativeLoadSnapshot` (kalder den injicerede `applySnapshot`, så den ægte `replaceCase` kører og
//    hæver `replacementGeneration` — coordinatorens apply-guard, §7) og den asynkrone `synchronizeLoadMetadata`.

const saveToFileMock = vi.fn<(...args: unknown[]) => Promise<SaveFileResult>>();
const loadFromFileMock = vi.fn<(...args: unknown[]) => Promise<LoadFileResult>>();
const loadFromFileHandleMock = vi.fn<(...args: unknown[]) => Promise<LoadFileResult>>();
const applyAuthoritativeLoadSnapshotMock =
  vi.fn<(...args: [{ result: { snapshot?: unknown }; applySnapshot: (snapshot: unknown) => void }]) => void>();
const synchronizeLoadMetadataMock =
  vi.fn<(...args: unknown[]) =>
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
  applyAuthoritativeLoadSnapshot: (
    args: { result: { snapshot?: unknown }; applySnapshot: (snapshot: unknown) => void }
  ) => applyAuthoritativeLoadSnapshotMock(args),
  synchronizeLoadMetadata: (...args: unknown[]) => synchronizeLoadMetadataMock(...args),
}));

vi.mock('../../utils/fileHelpers', () => ({
  resolveDefaultDirectoryHandle: vi.fn(async () => undefined),
}));

// `Slet alt`s filhåndtags-oprydning skal kunne fejle i test: reset-porten LÆSER resultatet, og et
// `false` skal vises som en rest frem for at forsvinde i "Alt data slettet".
const deleteFileHandleFromIndexedDBMock = vi.fn<() => Promise<boolean>>();
vi.mock('../../utils/fileHandleStorage', () => ({
  deleteFileHandleFromIndexedDB: () => deleteFileHandleFromIndexedDBMock(),
}));

import { useFileSaveLoad, type OverlayData } from '../../hooks/useFileSaveLoad';
import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../inputCore/react';
import { useCaseOperations, useCriticalInputActions } from '../../inputCore/react';
import { slimInputStore } from '../../inputCore/runtime/slimInputStore';
import { dispatchInput } from '../../inputCore/runtime/dispatchInput';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { activeEditorRegistry, type ActiveEditor } from '../../inputCore/runtime/activeEditorRegistry';
import { reduceInputCommand, settleField } from '../../inputCore/inputReducer';
import { satserAargangField } from '../../inputCore/catalog/satserDescriptors';
import type { SettledInput } from '../../inputCore/settledInput';
import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import { writeOptionalSessionStorageValue } from '../../utils/safeSessionStorage';

type HookApi = ReturnType<typeof useFileSaveLoad>;

type HarnessHandles = {
  api: HookApi | null;
  markSaved: ReturnType<typeof vi.fn<(revision: number) => void>>;
  showOverlay: ReturnType<typeof vi.fn<(overlay: OverlayData) => void>>;
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
  hydrateSlimInputStoreForTest(slimInputStore, initialInput);

  if (overrides.openEditorFailsSettle) {
    registerEditorThatFailsSettle();
  }

  const handles: HarnessHandles = {
    api: null,
    markSaved: vi.fn<(revision: number) => void>(),
    showOverlay: vi.fn<(overlay: OverlayData) => void>(),
    navigate: vi.fn<(to: string, opts?: unknown) => void>(),
  };

  const Harness = () => {
    const ops = useCaseOperations(DEFAULT_APP_SETTINGS);
    const criticalActions = useCriticalInputActions();
    handles.api = useFileSaveLoad({
      settings: DEFAULT_APP_SETTINGS,
      navigate: handles.navigate as unknown as Parameters<typeof useFileSaveLoad>[0]['navigate'],
      ops,
      criticalActions,
      markSaved: handles.markSaved,
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
    sessionStorage.clear();
    // Kald den ægte applySnapshot, så replaceCase kører og replacementGeneration hæves
    // (coordinatorens applyReplacement-guard, §7). Ellers ville et mocket no-op apply kaste.
    applyAuthoritativeLoadSnapshotMock.mockImplementation((args) => {
      args.applySnapshot(args.result.snapshot ?? {});
    });
    synchronizeLoadMetadataMock.mockResolvedValue({ status: 'applied' });
    deleteFileHandleFromIndexedDBMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    unregisterEditor?.();
    unregisterEditor = null;
  hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
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

    it('gemmer ikke en urørt sag — tomheds-gaten måler mod ny-sags-baseline, ikke feltoptælling', async () => {
      // En helt ny/nulstillet sag må ikke gemmes som et rigtigt sagsartefakt. Fælden er, at
      // gaten lå i `fileSave.ts` som en feltoptælling (`hasRealData`), der regnede hver `false` og hvert
      // standardtal (satsår, lønperiode, bilagsvalg) som brugerdata. Gaten ejes nu af `hasAnyData()`, som
      // sammenligner med ny-sags-baselinen og derfor kan skelne programmets standardsvar fra brugerens input.
      const handles = renderHook(); // ingen `hasData` → urørt standardsag

      await act(async () => {
        await handles.api?.handleGem();
      });

      // Ingen fil-I/O overhovedet: pickeren må ikke engang åbne for en sag uden brugerdata.
      expect(saveToFileMock).not.toHaveBeenCalled();
      expect(handles.markSaved).not.toHaveBeenCalled();
      expect(handles.showOverlay).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Ingen data fundet at gemme', type: 'warning' })
      );
    });

    it('markerer ikke gemt når brugeren annullerer file picker', async () => {
      const handles = renderHook({ hasData: true }); // skal forbi tomheds-gaten for at nå pickeren
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
      expect(applyAuthoritativeLoadSnapshotMock).toHaveBeenCalledTimes(1);
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
      expect(applyAuthoritativeLoadSnapshotMock).not.toHaveBeenCalled();
    });

    it('går til overskriv-bekræftelse (ingen apply) når der allerede findes data', async () => {
      const handles = renderHook({ hasData: true });
      loadFromFileMock.mockResolvedValue(successfulLoad());

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(handles.api?.pendingOverwriteApply).not.toBeNull();
      expect(applyAuthoritativeLoadSnapshotMock).not.toHaveBeenCalled();
    });

    it('anvender data straks ved tom state uden preflight-advarsel', async () => {
      const handles = renderHook({ hasData: false });
      loadFromFileMock.mockResolvedValue(successfulLoad());

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(applyAuthoritativeLoadSnapshotMock).toHaveBeenCalledTimes(1);
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

      expect(applyAuthoritativeLoadSnapshotMock).toHaveBeenCalledTimes(1);
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

      expect(applyAuthoritativeLoadSnapshotMock).toHaveBeenCalledTimes(1);
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
      expect(applyAuthoritativeLoadSnapshotMock).not.toHaveBeenCalled();

      await act(async () => {
        await handles.api?.handleConfirmOverwriteApply();
      });
      expect(applyAuthoritativeLoadSnapshotMock).toHaveBeenCalledTimes(1);
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
      expect(applyAuthoritativeLoadSnapshotMock).not.toHaveBeenCalled();
    });
  });

  // ─── Filhåndtag og overskrivning ─────────────────────────────────────────
  describe('den asynkrone metadatafase ligger uden for replacement-barrieren', () => {
    it('gennemfører den autoritative apply FØR metadata-synkroniseringen afventes', async () => {
      const handles = renderHook({ hasData: false });
      loadFromFileMock.mockResolvedValue(successfulLoad());
      let generationWhenMetadataRan: number | undefined;
      let metadataResolve: (() => void) | undefined;
      synchronizeLoadMetadataMock.mockImplementation(async () => {
        generationWhenMetadataRan = slimInputStore.getState().replacementGeneration;
        await new Promise<void>((resolve) => { metadataResolve = resolve; });
        return { status: 'applied' };
      });
      const generationBefore = slimInputStore.getState().replacementGeneration;

      let load: Promise<void> | undefined;
      await act(async () => {
        load = handles.api?.handleHent();
        await Promise.resolve();
      });

      // Replacement ER gennemført, mens metadatafasen stadig venter: den holder ikke barrieren.
      expect(generationWhenMetadataRan).toBeGreaterThan(generationBefore);

      await act(async () => {
        metadataResolve?.();
        await load;
      });
      expect(handles.showOverlay).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });

    it('viser metadata-advarslen, når synkroniseringen fejler efter en gennemført apply', async () => {
      const handles = renderHook({ hasData: false });
      loadFromFileMock.mockResolvedValue(successfulLoad());
      synchronizeLoadMetadataMock.mockResolvedValue({
        status: 'applied-with-metadata-error',
        message: 'Sagen blev indlæst, men filnavn kunne ikke synkroniseres.',
      });

      await act(async () => {
        await handles.api?.handleHent();
      });

      expect(applyAuthoritativeLoadSnapshotMock).toHaveBeenCalledTimes(1);
      expect(handles.showOverlay).toHaveBeenCalledWith({
        message: 'Sagen blev indlæst, men filnavn kunne ikke synkroniseres.',
        type: 'warning',
      });
    });
  });

  describe('handleSletAlt — hel-sags-clear', () => {
    let confirmSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    afterEach(() => {
      confirmSpy.mockRestore();
    });

    it('rydder de sagsnære sessionnøgler og afslutter INDE i appen uden genindlæsning', async () => {
      // Alle fire sagsnære nøgler sættes, plus én bevidst device-scoped, som IKKE må ryddes.
      writeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilename, 'sag.eo');
      writeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis, 'Testperson');
      writeOptionalSessionStorageValue(UI_STORAGE_KEYS.eoOffentligeYdelserHelpers, '{"sygedagpengeFraDato":"2024-01-01"}');
      writeOptionalSessionStorageValue(UI_STORAGE_KEYS.loentrinFinderOverlay, '{}');
      writeOptionalSessionStorageValue(UI_STORAGE_KEYS.sideMenuExpanded, 'true');
      const handles = renderHook({ hasData: true });

      await act(async () => {
        await handles.api?.handleSletAlt();
      });

      for (const key of [
        UI_STORAGE_KEYS.lastSavedFilename,
        UI_STORAGE_KEYS.lastSavedFilenameBasis,
        UI_STORAGE_KEYS.eoOffentligeYdelserHelpers,
        UI_STORAGE_KEYS.loentrinFinderOverlay,
      ]) {
        expect(sessionStorage.getItem(key)).toBeNull();
      }
      // Uafhængig UI-præference består bevidst (reset-policyens `deviceScoped`).
      expect(sessionStorage.getItem(UI_STORAGE_KEYS.sideMenuExpanded)).toBe('true');
      expect(deleteFileHandleFromIndexedDBMock).toHaveBeenCalledTimes(1);
      // Samme afslutning som load — navigation inde i appen, besked vist direkte.
      expect(handles.navigate).toHaveBeenCalledWith('/stamdata', { replace: true });
      expect(handles.showOverlay).toHaveBeenCalledWith({ message: 'Alt data slettet', type: 'info' });
    });

    it('rapporterer en rest frem for "Alt data slettet", når filhåndtaget ikke kan ryddes', async () => {
      deleteFileHandleFromIndexedDBMock.mockResolvedValue(false);
      const handles = renderHook({ hasData: true });

      await act(async () => {
        await handles.api?.handleSletAlt();
      });

      expect(handles.showOverlay).toHaveBeenCalledWith(expect.objectContaining({
        type: 'warning',
        message: expect.stringContaining('filhåndtag'),
      }));
      expect(handles.showOverlay).not.toHaveBeenCalledWith({ message: 'Alt data slettet', type: 'info' });
      // Inputtet er stadig ryddet: den autoritative del kan ikke rulles tilbage af en storagefejl.
      expect(handles.navigate).toHaveBeenCalledWith('/stamdata', { replace: true });
    });

    it('gør intet, når brugeren afviser bekræftelsen', async () => {
      confirmSpy.mockReturnValue(false);
      const handles = renderHook({ hasData: true });
      const generationBefore = slimInputStore.getState().replacementGeneration;

      await act(async () => {
        await handles.api?.handleSletAlt();
      });

      expect(slimInputStore.getState().replacementGeneration).toBe(generationBefore);
      expect(deleteFileHandleFromIndexedDBMock).not.toHaveBeenCalled();
      expect(handles.navigate).not.toHaveBeenCalled();
    });
  });

  describe('én load-shell med injiceret filkilde', () => {
    it('kører PWA-load gennem samme kæde og bærer antallet af ignorerede filer i beskeden', async () => {
      const handles = renderHook({ hasData: false });
      loadFromFileHandleMock.mockResolvedValue(successfulLoad());

      let outcome: string | undefined;
      await act(async () => {
        outcome = await handles.api?.handleHentFromPwaRequest({
          id: 'req-1',
          fileHandle: { name: 'sag.eo' } as FileSystemFileHandle,
          fileName: 'sag.eo',
          ignoredFileCount: 2,
          createdAtEpochMs: 0,
        });
      });

      expect(outcome).toBe('applied');
      expect(applyAuthoritativeLoadSnapshotMock).toHaveBeenCalledTimes(1);
      expect(handles.showOverlay).toHaveBeenCalledWith({
        message: expect.stringContaining('2 yderligere fil(er)'),
        type: 'warning',
      });
    });

    it('rapporterer busy til PWA-fladen uden at vise en advarsel', async () => {
      saveToFileMock.mockImplementation(() => new Promise(() => undefined));
      const handles = renderHook({ hasData: true });

      let firstSave: Promise<void> | undefined;
      await act(async () => {
        firstSave = handles.api?.handleGem();
        await Promise.resolve();
      });
      void firstSave;

      let outcome: string | undefined;
      await act(async () => {
        outcome = await handles.api?.handleHentFromPwaRequest({
          id: 'req-2',
          fileHandle: { name: 'sag.eo' } as FileSystemFileHandle,
          fileName: 'sag.eo',
          ignoredFileCount: 0,
          createdAtEpochMs: 0,
        });
      });

      expect(outcome).toBe('busy');
      expect(loadFromFileHandleMock).not.toHaveBeenCalled();
      expect(handles.showOverlay).not.toHaveBeenCalled();
    });
  });
});
