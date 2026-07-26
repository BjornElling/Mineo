/**
 * Dokument-download-livscyklussens ENE implementering (Fase 5;
 * `document-output-contract.md` §A2/§A2.1, `critical-action-contract.md` §5).
 *
 * Preflight og afvikling ligger i SAMME modul med vilje. De var oprindeligt to moduler med en
 * eksporteret `PreparedDocument` imellem, og påstanden var, at afviklingen "strukturelt ikke kan nås
 * med et ugated input, fordi `PreparedDocument` kun kan konstrueres af preflighten". Den påstand var
 * falsk: typen var et almindeligt eksporteret struktur-`Readonly<{…}>`, så enhver kalder med et
 * lovligt optaget token kunne håndbygge et og kalde afvikleren med et input, der aldrig havde været
 * gennem gaten — uden `as`, uden `unknown`, uden cast. Det compilerede rent.
 *
 * Derfor:
 *   1. `PreparedDocument` er nominal (privat brand) OG modulprivat. Den eksporteres ikke.
 *   2. Afvikleren eksporteres ikke. Kun `executeDocumentDownload` — preflight+afvikling i ét — er
 *      offentlig, så der findes ingen indgang til afviklingen ved siden af gaten.
 *   3. Friskheden verificeres mod miljøets AUTORITATIVE `readCurrentSourceToken`, ikke mod en
 *      `isSourceCurrent`-closure leveret sammen med inputtet.
 *
 * Rækkefølgen i preflighten er trust-kritisk og var før Fase 5 kopieret ind i hver callsite — med det
 * resultat, at fem outputs manglede mindst ét trin:
 *
 *   1. Commit-barriere: `criticalActions.prepare('download')` settler en eventuel åben editor.
 *   2. Frisk, stabil kildeoptagelse EFTER settle (aldrig render-tidens evaluation).
 *   3. Token-lighed mellem barrierens token og det optagne snapshots token.
 *   4. Definitionens `project` med den friskt genopslåede request: dependencies, projektion, invariants.
 *
 * Og i afviklingen re-tjekkes friskheden ved HVER asynkron grænse — inklusive efter rendering,
 * umiddelbart før fil-I/O. Det sidste check manglede både her og i den gamle
 * `runSelectedDocumentFormat`, så et dokument, hvis input ændredes under selve renderingen, blev
 * leveret forældet. `critical-action-contract.md` §5 kræver recheck umiddelbart før den irreversible
 * handling, og browser-downloaden ER den irreversible handling.
 */
import { sourceTokensEqual, type EvaluationSourceToken } from '../../inputCore/evaluationSource';
import { asError } from '../../utils/typeGuards';
import { triggerDocumentDownload } from '../downloadArtifact';
import type { DocumentDefinition } from './documentDefinition';
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
type PreparedDocument<TInput, TSettings> = Readonly<{
  [preparedBrand]: true;
  input: TInput;
  settings: TSettings;
  sourceToken: EvaluationSourceToken;
}>;

/**
 * Verificerer, at kilden stadig er den, gaten godkendte. Kaldes ved hver async-grænse.
 * Samlet i én funktion, så en ny `await`-fase ikke kræver håndkopieret fejllogik — det var netop
 * sådan post-render-checket blev glemt.
 */
const requireCurrentSource = <TSettings, TBrevhovedKey extends string>(
  environment: DocumentExecutionEnvironment<TSettings, TBrevhovedKey>,
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
export const executeDocumentDownload = async <TRequest, TInput, TSettings, TBrevhovedKey extends string>(
  definition: DocumentDefinition<TRequest, TInput, TSettings, TBrevhovedKey>,
  request: TRequest,
  environment: DocumentExecutionEnvironment<TSettings, TBrevhovedKey>
): Promise<DocumentOutcome> => {
  const diagnosticsFor = (phase: DocumentLifecyclePhase): DocumentDiagnostics => ({
    outputId: definition.id,
    phase,
  });

  const prepared = await prepareDocument(definition, request, environment);
  if (prepared.outcome !== null) return prepared.outcome;

  return await runPreparedDocument(definition, prepared.prepared, environment, diagnosticsFor);
};

/** Trin 1-4. Returnerer enten en afvisning eller det ene godkendte, brandede dokument. */
const prepareDocument = async <TRequest, TInput, TSettings, TBrevhovedKey extends string>(
  definition: DocumentDefinition<TRequest, TInput, TSettings, TBrevhovedKey>,
  request: TRequest,
  environment: DocumentExecutionEnvironment<TSettings, TBrevhovedKey>
): Promise<
  | Readonly<{ outcome: DocumentOutcome; prepared: null }>
  | Readonly<{ outcome: null; prepared: PreparedDocument<TInput, TSettings> }>
> => {
  const reject = (outcome: DocumentOutcome) => ({ outcome, prepared: null }) as const;

  // 1. Commit-barriere. Et fejlende settle er fail-closed: vi kan da ikke garantere, at editoren blev
  //    finaliseret, og feltet bærer selv den røde markering.
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
      cause: new Error(`Download-barrieren returnerede 'noop' for ${definition.id}; download settler altid (§1.4).`),
    }));
  }

  // 2. Frisk, stabilt kildesnapshot EFTER settle.
  const source = environment.captureSource();
  const sourceToken = source.evaluation.issues.sourceToken;

  // 3. Token-lighed: barrierens token og snapshottets token skal være samme revision, ellers kan et
  //    skift i vinduet mellem settle og optagelse slippe igennem.
  if (!sourceTokensEqual(preparation.token, sourceToken)) {
    return reject(documentRejected({ kind: 'stale-source', phase: 'capture' }));
  }

  // 4. Definitionens dependencies, projektion og invariants — samme funktion og samme request som
  //    den reaktive knap-gate, men på det friske snapshot.
  const projected = definition.project(createDocumentSourceContext(source.evaluation, source.settings), request);
  if (projected.status === 'blocked') {
    return reject(documentRejected({ kind: 'gate-blocked', phase: 'gate', reasons: projected.reasons }));
  }

  return {
    outcome: null,
    prepared: Object.freeze({
      [preparedBrand]: true as const,
      input: projected.input,
      settings: source.settings,
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
const runPreparedDocument = async <TRequest, TInput, TSettings, TBrevhovedKey extends string>(
  definition: DocumentDefinition<TRequest, TInput, TSettings, TBrevhovedKey>,
  prepared: PreparedDocument<TInput, TSettings>,
  environment: DocumentExecutionEnvironment<TSettings, TBrevhovedKey>,
  diagnosticsFor: (phase: DocumentLifecyclePhase) => DocumentDiagnostics
): Promise<DocumentOutcome> => {
  const { input, settings, sourceToken } = prepared;
  const stale = (phase: DocumentLifecyclePhase) => requireCurrentSource(environment, sourceToken, phase);

  const fail = (failure: Parameters<typeof documentFailed>[0]): DocumentOutcome => {
    if (failure.kind === 'runtime') {
      environment.reportFailure(failure, diagnosticsFor(failure.phase));
    }
    return documentFailed(failure);
  };

  try {
    // Entry-check. Ligger UDEN FOR dev-server-grenen nedenfor med vilje: gaten kørte i en
    // forudgående async-funktion, så der ER gået mikrotasks siden godkendelsen. Lå checket kun inde i
    // `if (checkDevServerAvailability)`, ville et miljø uden dev-server-port — fx standalone — slet
    // ikke blive verificeret mellem gate og modul-load.
    const atEntry = stale('gate');
    if (atEntry) return atEntry;

    // DEV-server-preflight (kun hvis miljøet har en dev-server).
    if (environment.checkDevServerAvailability) {
      const devFailure = await environment.checkDevServerAvailability(diagnosticsFor('dev-preflight'));
      if (devFailure) return fail(devFailure);
      const afterDevPreflight = stale('dev-preflight');
      if (afterDevPreflight) return afterDevPreflight;
    }

    // FØRSTE asynkrone grænse: generator-modulet.
    const render = await definition.loadRenderer();
    const afterRendererLoad = stale('renderer-load');
    if (afterRendererLoad) return afterRendererLoad;

    // ANDEN asynkrone grænse: writer-modulet for det valgte format.
    const session = await environment.createSession(environment.resolveFormat(settings));
    const afterWriterLoad = stale('writer-load');
    if (afterWriterLoad) return afterWriterLoad;

    // TREDJE asynkrone grænse: selve renderingen. Generatoren awaiter kanal-renderingen, så input
    // kan ændre sig undervejs; uden checket nedenfor ville et forældet artifact blive leveret.
    const artifact = await render(session, input, {
      visBrevhoved: environment.resolveVisBrevhoved(settings, definition.brevhoved),
    });
    const afterRender = stale('render');
    if (afterRender) return afterRender;

    // Irreversibel handling. Sker først når alt ovenstående er verificeret frisk.
    triggerDocumentDownload(artifact);
    return documentDownloaded;
  } catch (error) {
    return fail({ kind: 'runtime', phase: 'render', cause: asError(error) });
  }
};
