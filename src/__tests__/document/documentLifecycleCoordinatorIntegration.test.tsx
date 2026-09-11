// @vitest-environment jsdom
import * as React from 'react';
import { act, renderHook } from '@testing-library/react';
import {
  createEvaluationSourceToken,
  type FieldRef,
} from '../../inputCore';
import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  ActiveEditorRegistry,
  CriticalActionCoordinator,
  type SlimInputStore,
} from '../../inputCore/runtime';
import { __createSlimInputTestStore } from '../../inputCore/runtime/slimInputStore';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  useFieldEditor,
  type InputRuntimeBinding,
} from '../../inputCore/react';
import type { FieldEditorController } from '../../inputCore/react/useFieldEditor';
import { aargangField, createTestCatalog, testLocation } from '../inputCore/testCatalog';
import { documentActionFromDefinition } from '../../document/definition/documentAction';
import { defineDocumentOutput, type DocumentDefinition } from '../../document/definition/documentDefinition';
import type { DocumentExecutionEnvironment } from '../../document/definition/documentExecutionEnvironment';
import { executeDocumentDownload } from '../../document/definition/documentLifecycle';
import {
  blockedProjection,
  type DocumentDiagnostics,
  type DocumentFailure,
  type DocumentOutcome,
} from '../../document/definition/documentOutcome';
import { triggerDocumentDownload } from '../../document/downloadArtifact';

vi.mock('../../document/downloadArtifact', () => ({
  triggerDocumentDownload: vi.fn(),
}));

const triggerMock = vi.mocked(triggerDocumentDownload);

describe('dokument-livscyklus – rigtig editor og coordinator', () => {
  let store: SlimInputStore;
  let registry: ActiveEditorRegistry;
  let catalog: ReturnType<typeof createTestCatalog>;
  let binding: InputRuntimeBinding;

  beforeEach(() => {
    store = __createSlimInputTestStore();
    registry = new ActiveEditorRegistry();
    catalog = createTestCatalog();
    const getEvaluation = () => {
      const state = store.getState();
      return createInputEvaluation({
        input: state.input,
        catalog,
        sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
      });
    };
    binding = createInputRuntimeBinding(
      store,
      catalog,
      registry,
      getEvaluation,
      () => getEvaluation().issues
    );
    triggerMock.mockClear();
  });

  const wrapper = (runtime: InputRuntimeBinding) => {
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <InputRuntimeProvider binding={runtime}>{children}</InputRuntimeProvider>
    );
    Wrapper.displayName = 'DokumentLifecycleTestProvider';
    return Wrapper;
  };

  const runWithEditor = async (raw: string): Promise<{
    outcome: DocumentOutcome;
    editor: FieldEditorController<number | undefined>;
    projectedYear: number | undefined;
    rendered: number;
  }> => {
    const field: FieldRef<number | undefined> = aargangField.bind();
    const editorHook = renderHook(
      () => useFieldEditor(field, testLocation('dokument-lifecycle-editor')),
      { wrapper: wrapper(binding) }
    );
    act(() => editorHook.result.current.open());
    act(() => editorHook.result.current.changeDraft(raw));

    let projectedYear: number | undefined;
    let rendered = 0;
    const definition: DocumentDefinition<void, { year: number }, void, never> = defineDocumentOutput({
      id: 'satser',
      brevhoved: { kind: 'none' },
      labels: { documentName: 'testdokument' },
      project: ({ evaluation }) => {
        const value = evaluation.reader.read(field);
        if (value.status === 'error') return blockedProjection('test:invalid-input', value.issue.message);
        if (value.value === undefined) return blockedProjection('test:missing-input', 'Satsår mangler');
        projectedYear = value.value;
        return { status: 'ready', input: { year: value.value } };
      },
      loadRenderer: async () => async () => {
        rendered += 1;
        return { blob: new Blob(['test']), filename: 'test.pdf' };
      },
    });
    const coordinator = new CriticalActionCoordinator(store, registry);
    const environment: DocumentExecutionEnvironment<void, void, never> = Object.freeze({
      captureSource: () => {
        const state = store.getState();
        const sourceToken = createEvaluationSourceToken(state.revision, state.settingsRevision);
        return {
          evaluation: createInputEvaluation({ input: state.input, catalog, sourceToken }),
          gateSettings: undefined,
          renderSettings: undefined,
        };
      },
      readCurrentSourceToken: () => {
        const state = store.getState();
        return createEvaluationSourceToken(state.revision, state.settingsRevision);
      },
      criticalActions: coordinator,
      resolveFormat: () => 'pdf',
      createSession: async () => ({
        format: 'pdf' as const,
        render: async () => new Blob(['session']),
      }),
      resolveVisBrevhoved: () => false,
      reportFailure: (_failure: DocumentFailure, _diagnostics: DocumentDiagnostics) => undefined,
      showRuntimeFailureLocally: false,
    });

    let outcome: DocumentOutcome | undefined;
    await act(async () => {
      outcome = await executeDocumentDownload(
        documentActionFromDefinition(definition),
        undefined,
        environment
      );
    });
    if (outcome === undefined) throw new Error('Dokumentdownload gav intet outcome');

    return { outcome, editor: editorHook.result.current, projectedYear, rendered };
  };

  it('download finaliserer den rigtige åbne editor før frisk capture og projektion', async () => {
    const result = await runWithEditor('2024');

    expect(result.outcome).toEqual({ status: 'downloaded' });
    expect(result.projectedYear).toBe(2024);
    expect(result.editor.isOpen).toBe(false);
    expect(result.rendered).toBe(1);
    expect(triggerMock).toHaveBeenCalledTimes(1);
  });

  it('et rejected settle-resultat blokerer den friske projektion før lazy-load', async () => {
    const result = await runWithEditor('20x4');

    expect(result.outcome).toMatchObject({
      status: 'rejected',
      rejection: { kind: 'gate-blocked', phase: 'gate' },
    });
    expect(result.editor.isOpen).toBe(false);
    expect(result.projectedYear).toBeUndefined();
    expect(result.rendered).toBe(0);
    expect(triggerMock).not.toHaveBeenCalled();
  });
});
