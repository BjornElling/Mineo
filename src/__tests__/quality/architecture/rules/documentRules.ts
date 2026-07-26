/**
 * Dokument- og standalone-grænser.
 *
 * Dokumentlivscyklussen: render-from-argument, generator-isolation og standalone-appens snit mod
 * hovedappens tværgående flows.
 *
 * Del af det opdelte arkitekturmanifest (Fase 6, genåbnet): manifestet var 2.133 linjer og blandede
 * storage-, input-, domæne-, UI- og dokumentregler i én fil, hvor en regel og dens nabo intet havde
 * med hinanden at gøre. `architectureRules.ts` samler nu de fem koncern-moduler til ét registry.
 */
import { collectCalls } from '../astQueries';
import { defineRule, forbidImports } from '../ruleKit';

// --- Dokument-downloads må ikke læse committed state undervejs -----------------

/**
 * Fase 6 omskrev denne regel fra `download*Dokument` til livscyklussens faktiske entrypoints.
 *
 * Reglens INTENTION — "render-from-argument": en fil, der udløser en dokument-download, må ikke læse
 * autoritativ tilstand undervejs, men skal danne dokumentet ud fra det ÉNE snapshot, gaten godkendte
 * — er uændret gyldig. Målet skiftede blot navn: Fase 5 slettede alle 18 `download*Dokument`, så
 * reglens forudsætning kunne ikke længere opfyldes af nogen fil, og dødt-værn-detektoren rapporterede
 * den som inert. Første version af denne kommentar er dermed også dokumentationen for, hvorfor
 * reglen ikke bare blev slettet: den havde et levende mål, den bare ikke pegede på længere.
 *
 * De nuværende trigger-punkter er katalogets React-flade (`useMineoDocument*`) og handlings-hooket
 * `useReguleringDocumentAction`. Den forbudte læsning er tilsvarende skiftet fra de afskaffede
 * `usePersistedSection`/`getPersistedData` til den ene escape hatch, der faktisk findes i greenfield:
 * `slimInputStore.getState()` — en ugated, ikke-tokenbundet læsning af den autoritative store.
 */
const DOCUMENT_TRIGGER_CALLEES = new Set<string>([
  'useMineoDocumentOutput',
  'useMineoDocumentActionOutput',
  'useMineoDocumentOutputWithContext',
  'useMineoDocumentCatalogEntry',
  'useReguleringDocumentAction',
  'executeDocumentDownload',
  'triggerDocumentDownload',
]);

/**
 * De afskaffede persisterede sektionsopslag. Beholdt i forbuddet, selv om de ikke findes i grafen
 * længere: skulle nogen genindføre et af dem, ville en download-triggende fil være det værste sted at
 * gøre det. Reglens LIVENESS hviler ikke på dem — den hviler på trigger-siden (`liveTarget` nedenfor).
 */
const PERSISTED_READ_CALLEES = new Set<string>(['usePersistedSection', 'getPersistedData']);

/** Ugated læsning af autoritativ tilstand uden om det tokenbundne snapshot. */
const isRawAuthoritativeRead = (calleeText: string): boolean =>
  /(?:^|\.)slimInputStore\.getState$/.test(calleeText)
  || PERSISTED_READ_CALLEES.has(calleeText);

export const pdfDownloadCommittedState = defineRule({
  id: 'document/download-committed-state',
  description:
    'En fil, der udløser en dokument-download, må ikke samtidig læse autoritativ inputtilstand ugated '
    + '(slimInputStore.getState()) — dokumentet skal dannes fra det snapshot, gaten godkendte '
    + '(build-once/render-from-argument-invarianten).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      collectCalls(entry).some((ref) => DOCUMENT_TRIGGER_CALLEES.has(ref.calleeName)),
    rationale:
      'mindst én fil udløser en dokument-download gennem livscyklussens entrypoints — reglens '
      + 'forudsætning findes altså stadig',
  },
  find: (entry) => {
    const calls = collectCalls(entry);
    const hasDownloadTrigger = calls.some((ref) => DOCUMENT_TRIGGER_CALLEES.has(ref.calleeName));
    if (!hasDownloadTrigger) return [];

    return calls
      .filter((ref) => isRawAuthoritativeRead(ref.calleeText))
      .map((ref) => ({
        position: ref.position,
        message:
          `Ugated læsning af autoritativ tilstand (${ref.calleeText}) i en fil, der udløser en `
          + 'dokument-download — dokumentet skal dannes fra det gatede snapshot, ikke fra live state.',
      }));
  },
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'useMineoDocumentOutput(entry); slimInputStore.getState();' },
    {
      relativePath: 'src/x.ts',
      code: 'const a = useReguleringDocumentAction(r); const s = slimInputStore.getState().input;',
    },
    { relativePath: 'src/x.ts', code: "useMineoDocumentActionOutput(e); getPersistedData('stamdata');" },
  ],
  cleanFixtures: [
    // Download uden ugated læsning — den normale, korrekte form.
    { relativePath: 'src/x.ts', code: 'const out = useMineoDocumentOutput(entry); const v = out.snapshot;' },
    // Ugated læsning uden nogen download-trigger er en anden regels ansvar.
    { relativePath: 'src/x.ts', code: 'const s = slimInputStore.getState();' },
    // Et andet stores getState er ikke den autoritative inputtilstand.
    { relativePath: 'src/x.ts', code: 'useMineoDocumentOutput(entry); uiStore.getState();' },
  ],
});

// --- MinProcesrente-standalone: ingen import af Mineos tværgående flows --------

const STANDALONE_SCOPE_PREFIXES = ['src/apps/minprocesrente/', 'src/components/pages/minprocesrente/'];
const STANDALONE_SCOPE_FILES = new Set<string>();

const isStandaloneScope = (relativePath: string): boolean =>
  STANDALONE_SCOPE_FILES.has(relativePath) ||
  STANDALONE_SCOPE_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const FORBIDDEN_STANDALONE_MODULE_SUBSTRINGS = [
  'AuthGate',
  'BrowserRouter',
  'pwaLaunchQueue',
  'usePwaLaunchQueue',
  'serviceWorker',
  'systemIssueReporter',
  'AppSettings',
  'useAppSettings',
  'BugReport',
];
const FORBIDDEN_STANDALONE_BINDINGS = new Set<string>([
  'AuthGate',
  'BrowserRouter',
  'useAppSettings',
  'AppSettingsProvider',
  'systemIssueReporter',
  'reportSystemIssue',
  'BugReportButton',
  'logStorage',
]);

const isMineoAppRootImport = (moduleSpecifier: string): boolean =>
  /(?:^|\/)App$/.test(moduleSpecifier) && !moduleSpecifier.includes('minprocesrente');

export const minprocesrenteStandaloneImport = forbidImports({
  id: 'layer/minprocesrente-standalone-import-boundary',
  description:
    'Den isolerede MinProcesrente-standalone må ikke importere Mineos auth-/route-/PWA-/settings-/diagnose-flows (den deler kun renteberegning-sektionen).',
  liveTarget: {
    kind: 'scoped',
    roots: STANDALONE_SCOPE_PREFIXES,
    rationale: 'standalone-appen findes stadig som et selvstændigt scope, der skal holdes isoleret',
  },
  appliesTo: isStandaloneScope,
  forbidden: (ref) =>
    isMineoAppRootImport(ref.moduleSpecifier) ||
    FORBIDDEN_STANDALONE_MODULE_SUBSTRINGS.some((needle) => ref.moduleSpecifier.includes(needle)) ||
    ref.namedBindings.some((binding) => FORBIDDEN_STANDALONE_BINDINGS.has(binding)),
  message: (ref) => `MinProcesrente-standalone importerer forbudt Mineo-flow (${ref.moduleSpecifier}).`,
  violatingFixtures: [
    { relativePath: 'src/apps/minprocesrente/x.ts', code: "import { AuthGate } from '../../components/AuthGate';" },
    { relativePath: 'src/apps/minprocesrente/x.ts', code: "import App from '../../App';" },
    { relativePath: 'src/apps/minprocesrente/x.ts', code: "import { useAppSettings } from '../../contexts/AppSettingsContext';" },
    { relativePath: 'src/apps/minprocesrente/document/x.ts', code: "import { reportSystemIssue } from '../../../utils/systemIssueReporter';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/apps/minprocesrente/x.ts', code: "import { computeRente } from '../../domain/renteberegning/renteEngine';" },
    // Standalone-appens eget App-modul (indeholder ikke det bare `App`-segment) er tilladt.
    { relativePath: 'src/apps/minprocesrente/minprocesrenteMain.tsx', code: "import MinProcesrenteApp from './MinProcesrenteApp';" },
  ],
});
