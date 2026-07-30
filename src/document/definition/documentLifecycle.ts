/**
 * Dokument-download-livscyklussens ENE implementering.
 *
 * Preflight og afvikling ligger i SAMME modul, så afviklingen ikke kan kaldes med håndbygget,
 * ugated input:
 *   1. `PreparedDocument` er nominal (privat brand) OG modulprivat. Den eksporteres ikke.
 *   2. Afvikleren eksporteres ikke. Kun `executeDocumentDownload` — preflight+afvikling i ét — er
 *      offentlig, så der findes ingen indgang til afviklingen ved siden af gaten.
 *   3. Friskheden verificeres mod miljøets AUTORITATIVE `readCurrentSourceToken`, ikke mod en
 *      en friskheds-closure leveret sammen med inputtet.
 *
 * Rækkefølgen i preflighten er trust-kritisk:
 *
 *   1. Commit-barriere: `criticalActions.prepare('download')` settler en eventuel åben editor.
 *   2. Frisk, stabil kildeoptagelse EFTER settle (aldrig render-tidens evaluation).
 *   3. Token-lighed mellem barrierens token og det optagne snapshots token.
 *   4. Definitionens `project` med den friskt genopslåede request: dependencies, projektion, invariants.
 *
 * Og i afviklingen re-tjekkes friskheden ved HVER asynkron grænse — inklusive efter rendering,
 * umiddelbart før fil-I/O. Uden det sidste check kan input ændres under selve renderingen, så et
 * forældet dokument leveres. `critical-action-contract.md` §5 kræver recheck umiddelbart før den irreversible
 * handling, og browser-downloaden ER den irreversible handling.
 */
import { sourceTokensEqual, type EvaluationSourceToken } from '../../inputCore/evaluationSource';
import { asError } from '../../utils/typeGuards';
import { triggerDocumentDownload } from '../downloadArtifact';
import type { DocumentAction, ResolvedDocumentAction } from './documentAction';
import type { DocumentExecutionEnvironment } from './documentExecutionEnvironment';
import {
  documentDownloaded,
  documentFailed,
  documentRejected,
  type DocumentDiagnostics,
  type DocumentLifecyclePhase,
  type DocumentOutcome,
} from './documentOutcome';
import { createDocumentSourceContext } from './documentSourceContext';

/**
 * Brandet er en RIGTIG modul-lokal `symbol`, ikke en `declare const`.
 *
 * Den oprindelige form var `declare const preparedBrand: unique symbol` — en ren typeerklæring, som
 * ikke emitterer noget. Den fik typesiden til at se korrekt nominal ud, men enhver kørsel af
 * `prepareDocument` kastede `ReferenceError: preparedBrand is not defined`, fordi objektliteralen
 * refererede et symbol, der ikke fandtes ved runtime. Fejlen kunne ikke ses af typecheckeren og blev
 * først synlig, da det første callsite faktisk aktiverede en download.
 */
const preparedBrand = Symbol('PreparedDocument');

/**
 * Et godkendt dokument. Nominal via `preparedBrand` og modulprivat: typen eksporteres ikke, og
 * brandet kan ikke produceres uden for dette modul. Et ugated input kan derfor ikke nå afvikleren.
 */
type PreparedDocument<TRenderSettings, TBrevhovedKey extends string> = Readonly<{
  [preparedBrand]: true;
  document: ResolvedDocumentAction<TBrevhovedKey>;
  /**
   * KUN render-halvdelen af det optagne snapshot. Gate-halvdelen er brugt op, når dokumentet er
   * godkendt, og et godkendt dokument har ingen legitim grund til at kunne læse den igen.
   */
  renderSettings: TRenderSettings;
  sourceToken: EvaluationSourceToken;
}>;

/**
 * Verificerer, at kilden stadig er den, gaten godkendte. Kaldes ved hver async-grænse.
 * Samlet i én funktion, så en ny `await`-fase ikke kræver håndkopieret fejllogik — det var netop
 * sådan post-render-checket blev glemt.
 */
const requireCurrentSource = <TGateSettings, TRenderSettings, TBrevhovedKey extends string>(
  environment: DocumentExecutionEnvironment<TGateSettings, TRenderSettings, TBrevhovedKey>,
  sourceToken: EvaluationSourceToken,
  phase: DocumentLifecyclePhase
): DocumentOutcome | null =>
  sourceTokensEqual(sourceToken, environment.readCurrentSourceToken())
    ? null
    : documentRejected({ kind: 'stale-source', phase });

/**
 * Det ENE dokument-download-entrypoint. Alle 21 outputs — hovedapp og standalone, knapklik,
 * tastatur og programmatisk aktivering — går gennem denne funktion.
 *
 * `request` er aktiveringsidentiteten. Den bæres UÆNDRET gennem barrieren og genopslås friskt i
 * `project` efter settle, så et klik på række 3 altid vurderes mod række 3's aktuelle tilstand — ikke
 * mod den tilstand, rækken havde da knappen blev tegnet.
 */
export const executeDocumentDownload = async <TRequest, TGateSettings, TRenderSettings, TBrevhovedKey extends string>(
  action: DocumentAction<TRequest, TGateSettings, TBrevhovedKey>,
  request: TRequest,
  environment: DocumentExecutionEnvironment<TGateSettings, TRenderSettings, TBrevhovedKey>
): Promise<DocumentOutcome> => {
  const phase = { current: 'settle' as DocumentLifecyclePhase };
  const diagnosticsFor = (outputId: DocumentDiagnostics['outputId'], phase: DocumentLifecyclePhase): DocumentDiagnostics => ({
    outputId,
    phase,
  });
  const finish = (outcome: DocumentOutcome, outputId = action.id): DocumentOutcome => {
    if (outcome.status === 'failed' && outcome.failure.kind === 'runtime') {
      environment.reportFailure(outcome.failure, diagnosticsFor(outputId, outcome.failure.phase));
    }
    return outcome;
  };

  try {
    const prepared = await prepareDocument(action, request, environment, phase);
    if (prepared.outcome !== null) return finish(prepared.outcome);

    return finish(await runPreparedDocument(prepared.prepared, environment, phase), prepared.prepared.document.id);
  } catch (error) {
    return finish(documentFailed({ kind: 'runtime', phase: phase.current, cause: asError(error) }));
  }
};

/** Trin 1-4. Returnerer enten en afvisning eller det ene godkendte, brandede dokument. */
const prepareDocument = async <TRequest, TGateSettings, TRenderSettings, TBrevhovedKey extends string>(
  action: DocumentAction<TRequest, TGateSettings, TBrevhovedKey>,
  request: TRequest,
  environment: DocumentExecutionEnvironment<TGateSettings, TRenderSettings, TBrevhovedKey>,
  phase: { current: DocumentLifecyclePhase }
): Promise<
  | Readonly<{ outcome: DocumentOutcome; prepared: null }>
  | Readonly<{ outcome: null; prepared: PreparedDocument<TRenderSettings, TBrevhovedKey> }>
> => {
  const reject = (outcome: DocumentOutcome) => ({ outcome, prepared: null }) as const;

  // 1. Commit-barriere. Et fejlende settle er fail-closed: vi kan da ikke garantere, at editoren blev
  //    finaliseret, og feltet bærer selv den røde markering.
  phase.current = 'settle';
  const preparation = await environment.criticalActions.prepare('download');
  if (preparation.status === 'blocked') {
    preparation.target?.focus();
    return reject(documentRejected({ kind: 'settle-failed', phase: 'settle' }));
  }
  if (preparation.status === 'noop') {
    // `download` settler pr. §1.4-matricen og kan derfor ikke være `noop`. Grenen findes for at
    // holde unionen udtømmende; nås den, er det et invariantbrud og ikke en normal afvisning.
    return reject(documentFailed({
      kind: 'runtime',
      phase: 'settle',
      cause: new Error(`Download-barrieren returnerede 'noop' for ${action.id}; download settler altid (§1.4).`),
    }));
  }

  // 2. Frisk, stabilt kildesnapshot EFTER settle.
  phase.current = 'capture';
  const source = environment.captureSource();
  const sourceToken = source.evaluation.issues.sourceToken;

  // 3. Token-lighed: barrierens token og snapshottets token skal være samme revision, ellers kan et
  //    skift i vinduet mellem settle og optagelse slippe igennem.
  if (!sourceTokensEqual(preparation.token, sourceToken)) {
    return reject(documentRejected({ kind: 'stale-source', phase: 'capture' }));
  }

  // 4. Definitionens dependencies, projektion og invariants — samme funktion og samme request som
  //    den reaktive knap-gate, men på det friske snapshot.
  //    Konteksten får KUN gate-halvdelen af snapshottet; format og brevhoved ligger i
  //    `source.renderSettings` og anvendes først i afviklingen nedenfor.
  phase.current = 'gate';
  const projected = action.resolve(createDocumentSourceContext(source.evaluation, source.gateSettings), request);
  if (projected.status === 'blocked') {
    return reject(documentRejected({ kind: 'gate-blocked', phase: 'gate', reasons: projected.reasons }));
  }

  return {
    outcome: null,
    prepared: Object.freeze({
      [preparedBrand]: true as const,
      document: projected.document,
      renderSettings: source.renderSettings,
      sourceToken,
    }),
  };
};

/**
 * Afviklingen af et allerede godkendt dokument. Ikke eksporteret: den kan kun nås via
 * `executeDocumentDownload`, og dens `PreparedDocument`-parameter kan kun produceres af
 * `prepareDocument` ovenfor.
 *
 * Formatvalget sker bevidst EFTER gaten (planens arbejdstrin 8).
 */
const runPreparedDocument = async <TGateSettings, TRenderSettings, TBrevhovedKey extends string>(
  prepared: PreparedDocument<TRenderSettings, TBrevhovedKey>,
  environment: DocumentExecutionEnvironment<TGateSettings, TRenderSettings, TBrevhovedKey>,
  phase: { current: DocumentLifecyclePhase }
): Promise<DocumentOutcome> => {
  const { document, renderSettings, sourceToken } = prepared;
  const stale = (phase: DocumentLifecyclePhase) => requireCurrentSource(environment, sourceToken, phase);

  try {
    // Entry-check. Ligger UDEN FOR dev-server-grenen nedenfor med vilje: gaten kørte i en
    // forudgående async-funktion, så der ER gået mikrotasks siden godkendelsen. Lå checket kun inde i
    // `if (checkDevServerAvailability)`, ville et miljø uden dev-server-port — fx standalone — slet
    // ikke blive verificeret mellem gate og modul-load.
    phase.current = 'gate';
    const atEntry = stale('gate');
    if (atEntry) return atEntry;

    // DEV-server-preflight (kun hvis miljøet har en dev-server).
    if (environment.checkDevServerAvailability) {
      phase.current = 'dev-preflight';
      const devFailure = await environment.checkDevServerAvailability({ outputId: document.id, phase: phase.current });
      if (devFailure) return documentFailed(devFailure);
      const afterDevPreflight = stale('dev-preflight');
      if (afterDevPreflight) return afterDevPreflight;
    }

    // FØRSTE asynkrone grænse: generator-modulet.
    phase.current = 'renderer-load';
    const render = await document.loadRenderer();
    const afterRendererLoad = stale('renderer-load');
    if (afterRendererLoad) return afterRendererLoad;

    // ANDEN asynkrone grænse: writer-modulet for det valgte format.
    phase.current = 'writer-load';
    const session = await environment.createSession(environment.resolveFormat(renderSettings));
    const afterWriterLoad = stale('writer-load');
    if (afterWriterLoad) return afterWriterLoad;

    // TREDJE asynkrone grænse: selve renderingen. Generatoren awaiter kanal-renderingen, så input
    // kan ændre sig undervejs; uden checket nedenfor ville et forældet artifact blive leveret.
    phase.current = 'render';
    const artifact = await render(
      session,
      environment.resolveVisBrevhoved(renderSettings, document.brevhoved)
    );
    const afterRender = stale('render');
    if (afterRender) return afterRender;

    // Irreversibel handling. Sker først når alt ovenstående er verificeret frisk.
    phase.current = 'deliver';
    triggerDocumentDownload(artifact);
    return documentDownloaded;
  } catch (error) {
    return documentFailed({ kind: 'runtime', phase: phase.current, cause: asError(error) });
  }
};
