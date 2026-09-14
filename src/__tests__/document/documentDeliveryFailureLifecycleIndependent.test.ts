/**
 * Selvstændigt facit for livscyklussens sidste runtimegrænse.
 *
 * De øvrige lifecycle-tests dækker fejl ved settle, capture, writer-load og rendering. Denne
 * test dækker den særskilte `deliver`-fase: også en fejl i den eneste afleveringsfunktion skal
 * blive et runtime-failure og nå failure-sinken med korrekt output og fase.
 *
 * Testen bygger kun et syntetisk artifact og mocker browserens afleveringsside. Den kræver derfor
 * hverken fysisk PDF-/Word-rendering eller eksterne artefakter.
 */
import { createEvaluationSourceToken, createInputRevision, createSettingsRevision } from '../../inputCore';
import { defineDocumentOutput, type DocumentDefinition } from '../../document/definition/documentDefinition';
import { documentActionFromDefinition } from '../../document/definition/documentAction';
import type { DocumentExecutionEnvironment } from '../../document/definition/documentExecutionEnvironment';
import { executeDocumentDownload } from '../../document/definition/documentLifecycle';
import type { DocumentDiagnostics, DocumentFailure } from '../../document/definition/documentOutcome';
import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import { triggerDocumentDownload } from '../../document/downloadArtifact';

vi.mock('../../document/downloadArtifact', () => ({
  triggerDocumentDownload: vi.fn(),
}));

const triggerMock = vi.mocked(triggerDocumentDownload);
const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));

describe('dokument-livscyklus – runtimefejl ved levering', () => {
  beforeEach(() => {
    triggerMock.mockReset();
  });

  it('klassificerer en kastet filaflevering som runtimefejl i deliver-fasen', async () => {
    const reportFailure = vi.fn<(failure: DocumentFailure, diagnostics: DocumentDiagnostics) => void>();
    const artifact = { blob: new Blob(['test']), filename: 'test.pdf' };
    triggerMock.mockImplementation(() => {
      throw new Error('browserens filaflevering fejlede');
    });

    const definition: DocumentDefinition<void, undefined, void, never> = defineDocumentOutput({
      id: 'satser',
      brevhoved: { kind: 'none' },
      labels: { documentName: 'testdokument' },
      project: () => ({ status: 'ready' as const, input: undefined }),
      loadRenderer: async () => async () => artifact,
    });
    const environment: DocumentExecutionEnvironment<void, void, never> = Object.freeze({
      captureSource: () => ({
        evaluation: { issues: { sourceToken }, reader: { sourceToken } } as never,
        gateSettings: undefined,
        renderSettings: undefined,
      }),
      readCurrentSourceToken: () => sourceToken,
      criticalActions: { prepare: async () => ({ status: 'committed', token: sourceToken }) } as never,
      resolveFormat: () => 'pdf',
      createSession: async (): Promise<DocumentGenerationSession> => ({
        format: 'pdf',
        render: async () => new Blob(),
      }),
      resolveVisBrevhoved: () => false,
      reportFailure,
      showRuntimeFailureLocally: false,
    });

    const outcome = await executeDocumentDownload(
      documentActionFromDefinition(definition),
      undefined,
      environment
    );

    expect(outcome).toMatchObject({
      status: 'failed',
      failure: { kind: 'runtime', phase: 'deliver' },
    });
    expect(triggerMock).toHaveBeenCalledTimes(1);
    expect(triggerMock).toHaveBeenCalledWith(artifact);
    expect(reportFailure).toHaveBeenCalledTimes(1);
    expect(reportFailure).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'runtime', phase: 'deliver' }),
      { outputId: 'satser', phase: 'deliver' }
    );
  });
});
