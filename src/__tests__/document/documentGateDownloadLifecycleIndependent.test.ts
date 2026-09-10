/**
 * Selvstændigt gate-versus-download-spor for dokumentlivscyklussen.
 *
 * `documentGatePreflightParity.test.ts` sammenligner definitionens fælles resolver og kan derfor
 * ikke alene bevise, at den reaktive `DocumentOutput.evaluateGate` og den faktiske
 * `executeDocumentDownload` hver især går gennem den rigtige overflade. Denne test kalder de to
 * offentlige spor separat og måler deres observerbare rækkefølge.
 *
 * Den reaktive gate er et øjebliksbillede. Downloaden må derfor ikke genbruge dens ready-resultat:
 * efter settle skal den selv capturere, projicere og først derefter lazy-loade renderer og session.
 * En blokering i det friske spor skal stoppe før renderer, writer-session, render og fil-I/O.
 */
import {
  createDocumentSourceContext,
  type DocumentSourceContext,
} from '../../document/definition/documentSourceContext';
import {
  closeDocumentDefinition,
} from '../../document/definition/documentCatalog';
import {
  defineDocumentOutput,
  type DocumentDefinition,
} from '../../document/definition/documentDefinition';
import { documentActionFromDefinition } from '../../document/definition/documentAction';
import type { DocumentExecutionEnvironment } from '../../document/definition/documentExecutionEnvironment';
import { executeDocumentDownload } from '../../document/definition/documentLifecycle';
import { blockedProjection } from '../../document/definition/documentOutcome';
import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import { triggerDocumentDownload } from '../../document/downloadArtifact';
import { createEmptySettledInput } from '../../inputCore';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
  type EvaluationSourceToken,
} from '../../inputCore/evaluationSource';
import { createInputEvaluation } from '../../inputCore/inputReader';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { CriticalActionCoordinator } from '../../inputCore/runtime/criticalActionCoordinator';
import { ActiveEditorRegistry } from '../../inputCore/runtime/activeEditorRegistry';
import { __createSlimInputTestStore } from '../../inputCore/runtime/slimInputStore';

vi.mock('../../document/downloadArtifact', () => ({
  triggerDocumentDownload: vi.fn(),
}));

const triggerMock = vi.mocked(triggerDocumentDownload);
const catalog = getProductionInputCatalog();

type GateStatus = 'ready' | 'blocked';
type GateChannel = 'reactive' | 'download';
type GateSettings = Readonly<{ status: GateStatus; channel: GateChannel }>;
type RenderSettings = Readonly<{ format: 'pdf' }>;
type TestInput = Readonly<{ marker: string }>;

type Harness = Readonly<{
  definition: DocumentDefinition<void, TestInput, GateSettings, never>;
  environment: DocumentExecutionEnvironment<GateSettings, RenderSettings, never>;
  evaluation: ReturnType<typeof createInputEvaluation>;
  sourceToken: EvaluationSourceToken;
  calls: {
    capture: number;
    project: number;
    loadRenderer: number;
    createSession: number;
    render: number;
    reportFailure: number;
    events: string[];
  };
  setDownloadGateStatus: (status: GateStatus) => void;
}>;

const createHarness = (): Harness => {
  const sourceToken = createEvaluationSourceToken(
    createInputRevision(0),
    createSettingsRevision(0)
  );
  const evaluation = createInputEvaluation({
    input: createEmptySettledInput(),
    catalog,
    sourceToken,
  });
  const calls = {
    capture: 0,
    project: 0,
    loadRenderer: 0,
    createSession: 0,
    render: 0,
    reportFailure: 0,
    events: [] as string[],
  };
  let downloadGateStatus: GateStatus = 'ready';
  const store = __createSlimInputTestStore();
  const criticalActions = new CriticalActionCoordinator(store, new ActiveEditorRegistry());

  const definition: DocumentDefinition<void, TestInput, GateSettings, never> = defineDocumentOutput({
    id: 'satser',
    brevhoved: { kind: 'none' },
    labels: { documentName: 'testdokument' },
    project: (context: DocumentSourceContext<GateSettings>) => {
      calls.project += 1;
      calls.events.push(`project:${context.settings.channel}:${context.settings.status}`);
      return context.settings.status === 'ready'
        ? { status: 'ready', input: { marker: 'godkendt' } }
        : blockedProjection('test:blocked', 'Testgaten blokerer dokumentet');
    },
    loadRenderer: async () => {
      calls.loadRenderer += 1;
      calls.events.push('load-renderer');
      return async (session, _input, _context) => {
        calls.render += 1;
        calls.events.push('render');
        await session.render({ model: { blocks: [] }, properties: {} });
        return { blob: new Blob(['test']), filename: 'test.pdf' };
      };
    },
  });

  const environment: DocumentExecutionEnvironment<GateSettings, RenderSettings, never> = Object.freeze({
    captureSource: () => {
      calls.capture += 1;
      calls.events.push(`capture:${downloadGateStatus}`);
      return {
        evaluation,
        gateSettings: { status: downloadGateStatus, channel: 'download' as const },
        renderSettings: { format: 'pdf' as const },
      };
    },
    readCurrentSourceToken: () => sourceToken,
    criticalActions,
    resolveFormat: () => 'pdf',
    createSession: async () => {
      calls.createSession += 1;
      calls.events.push('create-session');
      const session: DocumentGenerationSession = Object.freeze({
        format: 'pdf',
        render: async () => {
          calls.events.push('session-render');
          return new Blob(['session']);
        },
      });
      return session;
    },
    resolveVisBrevhoved: () => false,
    reportFailure: () => {
      calls.reportFailure += 1;
    },
    showRuntimeFailureLocally: false,
  });

  return {
    definition,
    environment,
    evaluation,
    sourceToken,
    calls,
    setDownloadGateStatus: (status) => {
      downloadGateStatus = status;
    },
  };
};

const reactiveContext = (
  harness: Harness,
  status: GateStatus
): DocumentSourceContext<GateSettings> => createDocumentSourceContext(
  harness.evaluation,
  { status, channel: 'reactive' }
);

describe('dokumentgate og reel download-livscyklus – separate spor', () => {
  beforeEach(() => {
    triggerMock.mockClear();
  });

  it('en reaktiv ready-gate autoriserer ikke et nyt blocked download-snapshot', async () => {
    const harness = createHarness();
    const output = closeDocumentDefinition(harness.definition, harness.environment);

    const reactiveGate = output.evaluateGate(reactiveContext(harness, 'ready'), undefined);
    harness.setDownloadGateStatus('blocked');
    const outcome = await executeDocumentDownload(
      documentActionFromDefinition(harness.definition),
      undefined,
      harness.environment
    );

    expect(reactiveGate).toEqual({ canDownload: true, sourceToken: harness.sourceToken });
    expect(outcome).toMatchObject({
      status: 'rejected',
      rejection: { kind: 'gate-blocked', phase: 'gate', reasons: [{ code: 'test:blocked' }] },
    });
    expect(harness.calls.events).toEqual([
      'project:reactive:ready',
      'capture:blocked',
      'project:download:blocked',
    ]);
    expect(harness.calls.loadRenderer).toBe(0);
    expect(harness.calls.createSession).toBe(0);
    expect(harness.calls.render).toBe(0);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('en blocked gate og download stopper før lazy renderer, session, render og fil-I/O', async () => {
    const harness = createHarness();
    harness.setDownloadGateStatus('blocked');
    const output = closeDocumentDefinition(harness.definition, harness.environment);

    const reactiveGate = output.evaluateGate(reactiveContext(harness, 'blocked'), undefined);
    const outcome = await executeDocumentDownload(
      documentActionFromDefinition(harness.definition),
      undefined,
      harness.environment
    );

    expect(reactiveGate.canDownload).toBe(false);
    expect(outcome).toMatchObject({ status: 'rejected', rejection: { kind: 'gate-blocked' } });
    if (reactiveGate.canDownload || outcome.status !== 'rejected' || outcome.rejection.kind !== 'gate-blocked') return;
    expect(reactiveGate.reasons).toEqual(outcome.rejection.reasons);
    expect(harness.calls.events).toEqual([
      'project:reactive:blocked',
      'capture:blocked',
      'project:download:blocked',
    ]);
    expect(harness.calls.loadRenderer).toBe(0);
    expect(harness.calls.createSession).toBe(0);
    expect(harness.calls.render).toBe(0);
    expect(harness.calls.reportFailure).toBe(0);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('et ready download fortsætter først efter separat frisk gate og leverer filen', async () => {
    const harness = createHarness();
    const output = closeDocumentDefinition(harness.definition, harness.environment);

    const reactiveGate = output.evaluateGate(reactiveContext(harness, 'ready'), undefined);
    const outcome = await executeDocumentDownload(
      documentActionFromDefinition(harness.definition),
      undefined,
      harness.environment
    );

    expect(reactiveGate.canDownload).toBe(true);
    expect(outcome).toEqual({ status: 'downloaded' });
    expect(harness.calls.events).toEqual([
      'project:reactive:ready',
      'capture:ready',
      'project:download:ready',
      'load-renderer',
      'create-session',
      'render',
      'session-render',
    ]);
    expect(harness.calls.loadRenderer).toBe(1);
    expect(harness.calls.createSession).toBe(1);
    expect(harness.calls.render).toBe(1);
    expect(triggerMock).toHaveBeenCalledTimes(1);
  });
});
