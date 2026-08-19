/**
 * Den udtømmende matrix, del 1: livscyklussens egne cases.
 *
 * Kontrakten kræver ni cases pr. output. Fem af dem er DEFINITIONSUAFHÆNGIGE af konstruktion – de
 * afhænger kun af `documentLifecycle.ts`' rækkefølge, ikke af hvad definitionen projicerer:
 *
 *   - åben draft, som settler gyldigt
 *   - åben draft, som settler fejlende
 *   - input-/settingsrevisionsændring under lazy-load
 *   - direkte programmatisk aktivering
 *   - "for blokerede cases sker der ikke lazy-load, generatorimport eller fil-I/O"
 *
 * Havde hvert output sin egen kopi af livscyklussen, ville de fem være per-output – og en kopi kunne
 * mangle et trin, uden at nogen anden kopi blev rød. Den duplikering findes ikke: der er ét
 * `executeDocumentDownload`, og alle 21 outputs går gennem det. At teste de fem cases 21 gange ville
 * derfor teste den samme kodesti 21 gange og give falsk tryghed om, at dækningen var per-output.
 *
 * Her testes de derfor ÉN gang mod kernen, med en syntetisk definition, hvis `project`, `loadRenderer`
 * og renderer er fuldt instrumenterede. Det er strengere end en per-output-test kunne være: en ægte
 * definition kan ikke fortælle om dens `loadRenderer` blev kaldt.
 *
 * Del 2 – de fire GATE-cases (ugyldigt format, bounds, missing, warning, ikke-relevant fejl) – er
 * per-definition og ligger i `documentGateMatrix.test.ts`.
 */
import type { CriticalActionCoordinator } from '../../inputCore/runtime/criticalActionCoordinator';
import { createEvaluationSourceToken, createInputRevision, createSettingsRevision } from '../../inputCore';
import type { EvaluationSourceToken } from '../../inputCore/evaluationSource';
import type { InputEvaluation } from '../../inputCore/inputReader';
import { defineDocumentOutput, type DocumentDefinition } from '../../document/definition/documentDefinition';
import { documentActionFromDefinition } from '../../document/definition/documentAction';
import type { DocumentExecutionEnvironment } from '../../document/definition/documentExecutionEnvironment';
import { executeDocumentDownload } from '../../document/definition/documentLifecycle';
import { blockedProjection, type DocumentFailure } from '../../document/definition/documentOutcome';
import { triggerDocumentDownload } from '../../document/downloadArtifact';

vi.mock('../../document/downloadArtifact', () => ({
  triggerDocumentDownload: vi.fn(),
}));

const triggerMock = vi.mocked(triggerDocumentDownload);

const tokenAt = (revision: number): EvaluationSourceToken =>
  createEvaluationSourceToken(createInputRevision(revision), createSettingsRevision(1));

/**
 * Et minimalt `InputEvaluation`. Livscyklussen læser kun `issues.sourceToken` af det; resten går
 * uændret videre til definitionens `project`, som her er syntetisk.
 */
const evaluationAt = (token: EvaluationSourceToken): InputEvaluation =>
  ({ issues: { sourceToken: token }, reader: { sourceToken: token } }) as unknown as InputEvaluation;

type Preparation =
  | Readonly<{ status: 'committed'; token: EvaluationSourceToken }>
  | Readonly<{ status: 'blocked'; target: { focus: () => void } | null }>
  | Readonly<{ status: 'noop' }>;

/** Ét instrumenteret miljø + én instrumenteret definition. Alt der kan observeres, observeres. */
const createHarness = (options: Readonly<{
  /** Revisionen ved hver `readCurrentSourceToken`-forespørgsel, i rækkefølge. */
  currentTokens?: readonly number[];
  capturedRevision?: number;
  preparation?: Preparation;
  projectResult?: 'ready' | 'blocked';
  prepareThrows?: boolean;
  captureThrows?: boolean;
  renderThrows?: boolean;
}> = {}) => {
  const {
    capturedRevision = 1,
    preparation = { status: 'committed', token: tokenAt(1) } as Preparation,
    projectResult = 'ready',
    prepareThrows = false,
    captureThrows = false,
    renderThrows = false,
  } = options;

  const calls = {
    prepare: 0,
    project: 0,
    loadRenderer: 0,
    createSession: 0,
    render: 0,
    focus: 0,
    reportFailure: [] as DocumentFailure[],
  };

  let tokenReads = 0;
  const readCurrentSourceToken = (): EvaluationSourceToken => {
    const sequence = options.currentTokens ?? [];
    const revision = sequence[tokenReads] ?? sequence.at(-1) ?? capturedRevision;
    tokenReads += 1;
    return tokenAt(revision);
  };

  const criticalActions = {
    prepare: async () => {
      calls.prepare += 1;
      if (prepareThrows) throw new Error('settlefejl');
      if (preparation.status === 'blocked' && preparation.target) {
        // Wrap så vi kan tælle fokuseringen uden at ændre kernens kald.
        return { status: 'blocked', target: { focus: () => { calls.focus += 1; } } };
      }
      return preparation;
    },
  } as unknown as CriticalActionCoordinator;

  const environment: DocumentExecutionEnvironment<void, void, never> = Object.freeze({
    captureSource: () => {
      if (captureThrows) throw new Error('capturefejl');
      return {
        evaluation: evaluationAt(tokenAt(capturedRevision)),
        gateSettings: undefined,
        renderSettings: undefined,
      };
    },
    readCurrentSourceToken,
    criticalActions,
    resolveFormat: () => 'pdf' as const,
    createSession: async () => {
      calls.createSession += 1;
      return { format: 'pdf', render: async () => new Blob() } as never;
    },
    resolveVisBrevhoved: () => false,
    reportFailure: (failure: DocumentFailure) => { calls.reportFailure.push(failure); },
    // Harnessen måler på `reportFailure`, ikke på beskedteksten; politikken her er derfor
    // ligegyldig for testen, men feltet er obligatorisk, så et nyt miljø ikke kan glemme at tage
    // stilling til §A5.
    showRuntimeFailureLocally: false,
  });

  const definition: DocumentDefinition<void, { marker: string }, void, never> = defineDocumentOutput({
    id: 'satser',
    brevhoved: { kind: 'none' },
    labels: { documentName: 'testdokument' },
    project: () => {
      calls.project += 1;
      return projectResult === 'ready'
        ? { status: 'ready', input: { marker: 'godkendt' } }
        : blockedProjection('test:blocked', 'Blokeret af gaten');
    },
    loadRenderer: async () => {
      calls.loadRenderer += 1;
      return async () => {
        calls.render += 1;
        if (renderThrows) throw new Error('generatorfejl');
        return { blob: new Blob(), filename: 'test.pdf' };
      };
    },
  });

  return { calls, environment, definition };
};

const run = async (harness: ReturnType<typeof createHarness>) =>
  executeDocumentDownload(documentActionFromDefinition(harness.definition), undefined, harness.environment);

describe('dokument-livscyklus – matrix (definitionsuafhængige cases)', () => {
  beforeEach(() => triggerMock.mockClear());

  it('case: åben draft der settler GYLDIGT → hele kæden kører og leverer filen', async () => {
    const harness = createHarness();
    const outcome = await run(harness);

    expect(outcome).toEqual({ status: 'downloaded' });
    expect(harness.calls.prepare).toBe(1);
    expect(harness.calls.project).toBe(1);
    expect(harness.calls.loadRenderer).toBe(1);
    expect(harness.calls.render).toBe(1);
    expect(triggerMock).toHaveBeenCalledTimes(1);
  });

  it('case: åben draft der settler FEJLENDE → afvist, feltet fokuseres, INTET lazy-load eller fil-I/O', async () => {
    const harness = createHarness({
      preparation: { status: 'blocked', target: { focus: () => {} } },
    });
    const outcome = await run(harness);

    expect(outcome).toMatchObject({ status: 'rejected', rejection: { kind: 'settle-failed', phase: 'settle' } });
    expect(harness.calls.focus).toBe(1);
    // Fail-closed: gaten blev aldrig spurgt, fordi vi ikke kan vide at editoren blev finaliseret.
    expect(harness.calls.project).toBe(0);
    expect(harness.calls.loadRenderer).toBe(0);
    expect(harness.calls.createSession).toBe(0);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('rapporterer en kastet settle-fejl én gang med settle-fasen', async () => {
    const harness = createHarness({ prepareThrows: true });

    await expect(run(harness)).resolves.toMatchObject({
      status: 'failed', failure: { kind: 'runtime', phase: 'settle' },
    });
    expect(harness.calls.reportFailure).toHaveLength(1);
    expect(harness.calls.reportFailure[0]?.phase).toBe('settle');
    expect(harness.calls.loadRenderer).toBe(0);
  });

  it('rapporterer en kastet capture-fejl én gang med capture-fasen', async () => {
    const harness = createHarness({ captureThrows: true });

    await expect(run(harness)).resolves.toMatchObject({
      status: 'failed', failure: { kind: 'runtime', phase: 'capture' },
    });
    expect(harness.calls.reportFailure).toHaveLength(1);
    expect(harness.calls.reportFailure[0]?.phase).toBe('capture');
    expect(harness.calls.loadRenderer).toBe(0);
  });

  it('case: revisionen flytter MELLEM settle og kildeoptagelse → afvist i capture-fasen', async () => {
    // Barrieren committede på revision 1, men snapshottet er revision 2.
    const harness = createHarness({
      preparation: { status: 'committed', token: tokenAt(1) },
      capturedRevision: 2,
    });
    const outcome = await run(harness);

    expect(outcome).toMatchObject({ status: 'rejected', rejection: { kind: 'stale-source', phase: 'capture' } });
    expect(harness.calls.project).toBe(0);
    expect(harness.calls.loadRenderer).toBe(0);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('case: revisionen flytter under LAZY-LOAD → afvist før generatoren når at rendere', async () => {
    // Entry-checket ser stadig revision 1; checket efter renderer-load ser revision 2.
    const harness = createHarness({ currentTokens: [1, 2] });
    const outcome = await run(harness);

    expect(outcome).toMatchObject({ status: 'rejected', rejection: { kind: 'stale-source', phase: 'renderer-load' } });
    expect(harness.calls.loadRenderer).toBe(1);
    // Writer-sessionen åbnes ikke, og der renderes ikke.
    expect(harness.calls.createSession).toBe(0);
    expect(harness.calls.render).toBe(0);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('case: revisionen flytter under RENDERING → artifactet kasseres UDEN fil-I/O', async () => {
    // Entry, renderer-load og writer-load ser revision 1; checket efter render ser revision 2.
    const harness = createHarness({ currentTokens: [1, 1, 1, 2] });
    const outcome = await run(harness);

    expect(outcome).toMatchObject({ status: 'rejected', rejection: { kind: 'stale-source', phase: 'render' } });
    // Dokumentet BLEV renderet – og blev derefter kasseret. Det er hele pointen med
    // post-render-checket: uden det ville et forældet dokument være blevet leveret.
    expect(harness.calls.render).toBe(1);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('case: gaten blokerer → INTET lazy-load, ingen session, ingen fil-I/O', async () => {
    const harness = createHarness({ projectResult: 'blocked' });
    const outcome = await run(harness);

    expect(outcome).toMatchObject({
      status: 'rejected',
      rejection: { kind: 'gate-blocked', phase: 'gate', reasons: [{ code: 'test:blocked' }] },
    });
    expect(harness.calls.loadRenderer).toBe(0);
    expect(harness.calls.createSession).toBe(0);
    expect(harness.calls.render).toBe(0);
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('case: en blokering bærer ALTID mindst én synlig grund', async () => {
    const harness = createHarness({ projectResult: 'blocked' });
    const outcome = await run(harness);

    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected' || outcome.rejection.kind !== 'gate-blocked') return;
    expect(outcome.rejection.reasons.length).toBeGreaterThan(0);
    expect(outcome.rejection.reasons[0].message.trim()).not.toBe('');
  });

  it('case: en generatorfejl rapporteres som SYSTEMFEJL og leverer ingen fil', async () => {
    const harness = createHarness({ renderThrows: true });
    const outcome = await run(harness);

    expect(outcome).toMatchObject({ status: 'failed', failure: { kind: 'runtime' } });
    // §A5: kun `runtime` når systemfejl-sinken – afvisninger gør ikke.
    expect(harness.calls.reportFailure).toHaveLength(1);
    expect(harness.calls.reportFailure[0]?.kind).toBe('runtime');
    expect(triggerMock).not.toHaveBeenCalled();
  });

  it('case: afvisninger rapporteres IKKE som systemfejl (§A5)', async () => {
    for (const harness of [
      createHarness({ projectResult: 'blocked' }),
      createHarness({ preparation: { status: 'blocked', target: null } }),
      createHarness({ capturedRevision: 2, preparation: { status: 'committed', token: tokenAt(1) } }),
    ]) {
      await run(harness);
      expect(harness.calls.reportFailure).toEqual([]);
    }
  });

  it('case: direkte programmatisk aktivering går gennem PRÆCIS samme kæde som et klik', async () => {
    // `executeDocumentDownload` er det ENESTE eksporterede entrypoint; der findes ingen vej udenom
    // barrieren. Et programmatisk kald kan altså ikke springe settle eller gaten over.
    const harness = createHarness({ preparation: { status: 'blocked', target: null } });
    const outcome = await run(harness);

    expect(harness.calls.prepare).toBe(1);
    expect(outcome).toMatchObject({ status: 'rejected', rejection: { kind: 'settle-failed' } });
  });

  it('case: `noop` fra barrieren er et INVARIANTBRUD, ikke en tavs afvisning', async () => {
    // Download settler altid pr. §1.4-matricen. Nås grenen, er det en programfejl – og den skal
    // rapporteres som sådan frem for at ligne en normal brugerafvisning.
    const harness = createHarness({ preparation: { status: 'noop' } });
    const outcome = await run(harness);

    expect(outcome).toMatchObject({ status: 'failed', failure: { kind: 'runtime', phase: 'settle' } });
    expect(triggerMock).not.toHaveBeenCalled();
  });
});
