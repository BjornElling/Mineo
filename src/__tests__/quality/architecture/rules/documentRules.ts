/**
 * Dokument- og standalone-grænser.
 *
 * Dokumentlivscyklussen: render-from-argument, generator-isolation og standalone-appens snit mod
 * hovedappens tværgående flows.
 *
 * Del af det koncern-opdelte arkitekturmanifest: storage-, input-, domæne-, UI- og dokumentregler bor
 * hver for sig, så en regel og dens nabo hører til samme emne. `architectureRules.ts` samler de fem
 * moduler til ét registry.
 */
import ts from 'typescript';
import { collectCalls } from '../astQueries';
import type { SourceEntry } from '../sourceGraph';
import { defineRule, forbidCalls, forbidImports } from '../ruleKit';

// --- Dokument-downloads må ikke læse committed state undervejs -----------------

/**
 * Reglen måler livscyklussens faktiske entrypoints, ikke et bestemt funktionsnavn.
 *
 * Reglens INTENTION er "render-from-argument": en fil, der udløser en dokument-download, må ikke læse
 * autoritativ tilstand undervejs, men skal danne dokumentet ud fra det ÉNE snapshot, gaten godkendte.
 * Da de gamle `download*Dokument`-entrypoints forsvandt, kunne reglens forudsætning ikke opfyldes af
 * nogen fil, og dødt-værn-detektoren rapporterede den som inert. Den blev derfor RETARGETET frem for
 * slettet — intentionen var uændret gyldig, målet havde blot skiftet navn. Det er den generelle
 * fremgangsmåde: et inert værn med et levende mål skal pege det rigtige sted hen, ikke fjernes.
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

// --- Ingen lydløs download: en aktivering skal ledsages af en udfaldsvisning ---

/**
 * En flade, der AKTIVERER en download, skal også kunne VISE dens udfald.
 *
 * `DocumentDownloadHandle` leverede korrekt en dansk besked for de udfald, brugeren selv kan handle på —
 * et stale-afbrud, fordi sagen ændrede sig undervejs, eller en død DEV-server — men intet håndhævede, at
 * callsiten renderede den. Otte flader gjorde det ikke: brugeren klikkede på en aktiv knap, fik ingen fil
 * og ingen forklaring. Reguleringshooket udledte endda beskeden, som BEGGE dens callsites ignorerede.
 *
 * Reglen måler netop DE udfald: et stale-afbrud og en død DEV-server. En GATE-blokering hører ikke til
 * dem — den bærer ingen besked, fordi knappen var synligt inaktiv og tooltippet ejer årsagen
 * (brugerbeslutning 2026-07-31). De forventelige udfald routes bevidst ikke til den centrale
 * systemfejlflade (§A5), så uden en visning her ville de være lydløse.
 *
 * Reglen er en LOKAL strukturel kontrol pr. fil: aktiverer filen en download (`.download(...)` på et
 * handle), skal den samme fil også nævne en udfaldsvisning. Filer, der kun VIDEREGIVER et handle som
 * prop (fx `Erhvervsevnetab.tsx`, der komponerer fire handles til sine faner), aktiverer ikke selv og
 * rammes derfor ikke — fanen, der klikker, er den, der skal vise.
 */
/**
 * Navnene, der udgør en udfaldsvisning. Kontrollen sker på AST'et (identifiers, JSX-tags og
 * property-adgange) og IKKE på filens tekst: en kommentar, der blot NÆVNER `errorMessage`, må ikke kunne
 * bære reglen. Netop det hul havde den første udgave af denne regel — en mutation, der fjernede visningen
 * men efterlod dens forklarende kommentar, forblev grøn.
 */
const DOCUMENT_OUTCOME_VIEWS: readonly string[] = [
  'DocumentOutcomeMessage',
  'errorMessage',
];

/** Findes en udfaldsvisning som en rigtig AST-node (ikke i en kommentar)? */
const rendersDocumentOutcome = (entry: SourceEntry): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    // `<DocumentOutcomeMessage … />` som JSX-tag.
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
      && ts.isIdentifier(node.tagName)
      && DOCUMENT_OUTCOME_VIEWS.includes(node.tagName.text)) {
      found = true;
      return;
    }
    // `handle.errorMessage` som identifier eller property.
    if (ts.isIdentifier(node) && DOCUMENT_OUTCOME_VIEWS.includes(node.text)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return found;
};

/** Modulet der ejer den kanoniske udfaldsvisning. */
const DOCUMENT_OUTCOME_VIEW_OWNER = 'src/components/inputs/DocumentOutcomeMessage.tsx';

export const documentActivationShowsOutcome = defineRule({
  id: 'document/activation-shows-outcome',
  description:
    'En flade, der aktiverer en dokument-download, skal også vise dens udfald. Ellers kan '
    + 'et stale-afbrud eller en utilgængelig DEV-server give brugeren en aktiv knap, ingen fil og ingen '
    + 'forklaring. Brug `DocumentOutcomeMessage` med `handle.errorMessage` råt — hook\'en har allerede '
    + 'filtreret gate-blokeringer væk, som bevidst er tavse.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath === DOCUMENT_OUTCOME_VIEW_OWNER
      || collectCalls(entry).some((ref) => ref.calleeName === 'download'),
    rationale:
      'den kanoniske udfaldsvisning OG mindst én flade, der aktiverer en download, findes stadig — '
      + 'forsvinder visningen, er mønsteret flyttet og reglen skal skrives om',
    // Ankrene er de flader, der faktisk AKTIVERER en download plus visningens ejer. Satser-ankeret peger på
    // sektion-komponenten frem for `Satser.tsx`: med VM-laget er siden ren komposition, og
    // aktiveringen bor i sektionen. Et anker på en fil, der ikke længere aktiverer noget, ville gøre
    // liveness-kontrollen rød af den forkerte grund.
    requiredPaths: [
      DOCUMENT_OUTCOME_VIEW_OWNER,
      'src/components/pages/satser/SatserAarstalSection.tsx',
      'src/components/pages/erhvervsevnetab/EetEfterEalTab.tsx',
    ],
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/components/pages/'),
  allow: [],
  find: (entry) => {
    const calls = collectCalls(entry);
    // `x.download(...)` — aktiveringen af et dokumenthandle. Et bart `download(...)` tælles ikke: det
    // er typisk en lokal helper, og filen med selve handlet er den, reglen skal måle.
    const activations = calls.filter((ref) => ref.calleeName === 'download' && ref.calleeText.includes('.'));
    if (activations.length === 0) return [];
    if (rendersDocumentOutcome(entry)) return [];

    const first = activations[0];
    return [{
      position: first.position,
      message:
        `\`${first.calleeText}(...)\` aktiverer en dokument-download, men filen viser intet udfald. `
        + 'Tilføj `<DocumentOutcomeMessage message={…} />`, så et stale-afbrud eller en DEV-serverfejl '
        + 'ikke er lydløs for brugeren.',
    }];
  },
  violatingFixtures: [
    // Den konkrete fejl: aktivering uden nogen visning.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const C = () => <Button onClick={() => void download.download(undefined)} />;',
    },
    {
      relativePath: 'src/components/pages/Y.tsx',
      code: 'const C = () => <B onClick={() => { void reguleringDocument.download(); }} />;',
    },
    // VIGTIG fixture: en KOMMENTAR, der blot nævner visningen, må ikke bære reglen. Præcis dette hul
    // havde reglens første udgave (den læste `entry.text`), og en mutation, der fjernede visningen men
    // efterlod dens forklarende kommentar, forblev grøn.
    {
      relativePath: 'src/components/pages/Z.tsx',
      code: '// Beskeden læses direkte fra `errorMessage` i udfaldsrækken.\n'
        + 'const C = () => <Button onClick={() => void download.download(undefined)} />;',
    },
  ],
  cleanFixtures: [
    // Den ønskede — og nu eneste — vej: aktivering + kanonisk visning af `errorMessage` råt.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const C = () => <><Button onClick={() => void d.download(undefined)} />'
        + '<DocumentOutcomeMessage message={d.errorMessage} /></>;',
    },
    // En fil, der kun VIDEREGIVER handles som prop, aktiverer ikke selv.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const C = () => <Tab download={download} />;',
    },
    // Et bart `download(...)`-kald er ikke en handle-aktivering.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const C = () => { const download = () => {}; return <Button onClick={() => download()} />; };',
    },
  ],
});

// --- «Fejl i indtastning» må ikke hardkodes over en betingelse, der dækker begge klasser ---

/**
 * Konstruktørerne, der HARDKODER klassen `invalid-input` uden at se på data.
 *
 * **Fejlformen, reglen findes for (brugerfund 2026-08-15).** Årslønssidens dokumentgate svarede «Fejl i
 * indtastning» på en lønrække med komplet periode og INTET beløb. Årsagen var strukturel og ikke lokal:
 * gaten kollapsede hele `tableValidation.errors` til ét `blockDocumentDownloadForInvalidInput`-kald, selv
 * om `TableError.issue` allerede skelnede `invalid` fra `partial_period`/`missing_amount`. Samme form fandtes
 * på Renteberegning, hvor `anyRowHasError` — som pr. konstruktion kun kan være sand for en UFULDSTÆNDIG
 * række — også svarede «Fejl i indtastning».
 *
 * Fælles for begge: en aggregeret boolean over flere tilstande fik påklistret én klasse, funktionen umuligt
 * kunne efterprøve. `document-output-contract.md` §A5.1 forbød det allerede i ord — der var blot intet værn.
 *
 * **Hvorfor en allowlist og ikke et totalforbud.** Der findes legitime kaldssteder, hvor grenen er
 * BEVISELIGT ét-klasset: EET klassificerer pr. issue-id gennem `isEetFieldErrorIssueId`, og Forsørgertab
 * pusher én årsag pr. konkret betingelse. De to er auditerede undtagelser, og harnessets anti-rot-kontrol
 * kræver, at hver af dem stadig udløser reglen — så en undtagelse ikke kan overleve sit kaldssted.
 *
 * Den kanoniske vej er `blockDocumentDownloadFromCauses`/`blockedProjectionFromCauses`, hvor hver årsag
 * bærer sin egen klasse og `classifyBlockingCause` afgør udfaldet ét sted.
 */
const HARDCODED_INVALID_INPUT_CONSTRUCTORS = new Set<string>([
  'blockDocumentDownloadForInvalidInput',
  'invalidInputReason',
  // Slettet 2026-08-15 (ingen kaldssteder). Beholdt i forbuddet, så den ikke kan genopstå som en
  // uafprøvet vej til samme fejlklasse.
  'blockedProjectionForInvalidInput',
]);

/** Den kanoniske, årsagsudledende vej. Bruges som liveness-probe: findes den, findes mønsteret. */
const DERIVED_GATE_CONSTRUCTORS = new Set<string>([
  'blockDocumentDownloadFromCauses',
  'blockedProjectionFromCauses',
  'classifyBlockingCauses',
]);

export const documentGateClassHardcodedInvalidInput = forbidCalls({
  id: 'document/gate-class-hardcoded-invalid-input',
  description:
    'Klassen «Fejl i indtastning» må ikke hardkodes for en gate-gren. Den skal udledes af årsagerne '
    + '(`blockDocumentDownloadFromCauses` / `blockedProjectionFromCauses`), så en betingelse, der også '
    + 'dækker en MANGLENDE indtastning, ikke kan svare «Fejl i indtastning» på et tomt felt.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      collectCalls(entry).some((ref) =>
        DERIVED_GATE_CONSTRUCTORS.has(ref.calleeName)
        || HARDCODED_INVALID_INPUT_CONSTRUCTORS.has(ref.calleeName)),
    rationale:
      'mindst én gate bygger stadig et blokerings-resultat — reglens forudsætning findes altså; '
      + 'forsvinder gate-konstruktørerne, er klassifikationen flyttet og reglen skal skrives om',
    // Sammensat mål: BEGGE de auditerede undtagelser skal stadig findes og stadig bygge en gate. En
    // slettet undtagelse skal opdages her frem for at efterlade en allowlist-post uden dækning.
    requiredPaths: [
      'src/domain/erhvervsevnetab/erhvervsevnetabDownloadGate.ts',
      'src/domain/forsoergertab/forsoergertabSnapshot.ts',
      'src/domain/aarsloen/aarsloenDownloadGate.ts',
    ],
  },
  allow: [
    // AUDITERET: klassen udledes pr. issue-id gennem `isEetFieldErrorIssueId`, så grenen er ét-klasset.
    'src/domain/erhvervsevnetab/erhvervsevnetabDownloadGate.ts',
    // AUDITERET: én årsag pr. konkret betingelse (`hasDownloadBlockingFieldError` er kun røde felter).
    'src/domain/forsoergertab/forsoergertabSnapshot.ts',
  ],
  forbidden: (ref) => HARDCODED_INVALID_INPUT_CONSTRUCTORS.has(ref.calleeName),
  message: (ref) =>
    `\`${ref.calleeText}(...)\` hardkoder klassen «Fejl i indtastning». Dækker betingelsen også en `
    + 'MANGLENDE indtastning, svarer knappen forkert på et tomt felt. Byg i stedet en '
    + '`DocumentBlockingCause`-liste, hvor hver årsag bærer sin egen klasse, og lad '
    + '`blockDocumentDownloadFromCauses` afgøre udfaldet.',
  violatingFixtures: [
    // Den konkrete fejl, reglen findes for: hele tabelvalideringen som én hardkodet klasse.
    {
      relativePath: 'src/domain/aarsloen/x.ts',
      code: "const g = errors.length > 0 ? blockDocumentDownloadForInvalidInput({ code: 'a', message: 'b' }) : null;",
    },
    {
      relativePath: 'src/domain/x/y.ts',
      code: "const r = invalidInputReason('a', 'b');",
    },
    // Den slettede tvilling må ikke kunne genopstå.
    {
      relativePath: 'src/document/definition/x.ts',
      code: "export const p = () => blockedProjectionForInvalidInput('a', 'b');",
    },
  ],
  cleanFixtures: [
    // Den ønskede vej: klassen bæres af årsagerne.
    {
      relativePath: 'src/domain/aarsloen/x.ts',
      code: "const g = blockDocumentDownloadFromCauses('a', errors.map(toCause), 'fallback');",
    },
    {
      relativePath: 'src/domain/x/y.ts',
      code: "const c = { scope: 'aggregate', kind: 'invalid-input', message: 'm' };",
    },
    // En mangel-blokering er uberørt — reglen handler kun om den hardkodede FEJL-klasse.
    {
      relativePath: 'src/domain/x/y.ts',
      code: "const g = blockDocumentDownload({ code: 'a', message: 'b' });",
    },
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

// --- Generatorer må ikke bruge headerløse tabeller som layoutgenvej ----------

export const documentHeaderlessPseudoTableRule = defineRule({
  id: 'document/no-headerless-pseudo-table',
  description:
    'Headerløse tabeller i generatorer er pseudo-tabeller; label/værdi- og formellinjer skal bruge composerens tekstblokke.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/document/generators'],
    rationale: 'dokumentgeneratorerne er det levende scope, hvor en pseudo-tabel kan indføres',
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/document/generators/'),
  find: (entry) => {
    const findings: ReturnType<typeof collectCalls>[number]['position'][] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node)
        && ((ts.isIdentifier(node.name) && node.name.text === 'hasHeaderRow')
          || (ts.isStringLiteralLike(node.name) && node.name.text === 'hasHeaderRow'))
        && node.initializer.kind === ts.SyntaxKind.FalseKeyword
      ) {
        const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.name.getStart(entry.ast));
        findings.push({ line: line + 1, column: character + 1 });
      }
      ts.forEachChild(node, visit);
    };
    visit(entry.ast);
    return findings.map((position) => ({
      position,
      message: 'Headerløs pseudo-tabel — brug writeLeftRightText eller en anden semantisk composer-blok.',
    }));
  },
  violatingFixtures: [{
    relativePath: 'src/document/generators/x.ts',
    code: 'document.addTable({ columns, rows, hasHeaderRow: false });',
  }],
  cleanFixtures: [{
    relativePath: 'src/document/generators/x.ts',
    code: 'document.addTable({ columns, rows, hasHeaderRow: true });',
  }],
});

// --- Download-tooltippen kommer fra gaten, ikke fra en rå `message` ------------

/**
 * `DocumentDownloadGateReason.message` er den INTERNE forklaring — aldrig brugertekst.
 *
 * Brugerteksten afgøres af `reason.kind` og produceres af `resolveDocumentGateTooltip` /
 * `resolveBlockedGateTooltip`; en flade skal bruge `handle.disabledReason`, som allerede er oversat
 * (`page-component-contract.md` §11.1). Læser en flade i stedet `.message`, omgår den både
 * prioriteringen mellem flere årsager og hele klasse→tekst-oversættelsen.
 *
 * Præcis det skete i `RenteberegningTab`, hvor rækkeknapperne brugte `gate.reasons[0].message` og
 * derfor viste gate-interne strenge ("Rentelinjen findes ikke længere", "Stamdata indeholder fejl")
 * direkte til brugeren. Kontrakten forbød det i forvejen; der var blot intet værn.
 *
 * Reglen er bevidst SNÆVER: den rammer `.message` på et udtryk, der nævner `reasons`/`blockedReasons`,
 * altså netop gate-årsagslisten. `message` som feltnavn er udbredt i domænesnapshots og fejlbokse, og
 * et bredere forbud ville ramme dem.
 */
const GATE_REASONS_ACCESS = /(?:^|\.)(?:reasons|blockedReasons)\s*(?:\?\.)?\s*(?:\[[^\]]*\]|\.at\([^)]*\))?$/;

export const documentDownloadTooltipFromGate = defineRule({
  id: 'document/download-tooltip-from-gate',
  description:
    'En flade må ikke læse `reasons[...].message` til visning. `message` er gatens interne forklaring; '
    + 'brugerteksten kommer fra `handle.disabledReason` eller `resolveBlockedGateTooltip`.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/components/pages'],
    rationale:
      'sidefladerne er det levende scope, hvor en download-tooltip kan bygges; forsvinder de, er '
      + 'mønsteret flyttet og reglen skal skrives om',
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/components/'),
  find: (entry) => {
    const findings: Array<{ position: { line: number; column: number }; message: string }> = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAccessExpression(node)
        && node.name.text === 'message'
        && GATE_REASONS_ACCESS.test(node.expression.getText(entry.ast))
      ) {
        const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.name.getStart(entry.ast));
        findings.push({
          position: { line: line + 1, column: character + 1 },
          message:
            `\`${node.getText(entry.ast)}\` viser gatens INTERNE forklaring. Brug `
            + '`handle.disabledReason` (allerede oversat) eller `resolveBlockedGateTooltip(gate.reasons)`.',
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(entry.ast);
    return findings;
  },
  violatingFixtures: [
    // Den konkrete fejl, reglen findes for.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const t = (g) => g.canDownload ? undefined : g.reasons[0].message;',
    },
    {
      relativePath: 'src/components/pages/Y.tsx',
      code: 'const t = (h) => h.blockedReasons?.[0].message;',
    },
  ],
  cleanFixtures: [
    // Den ønskede vej: den oversatte tekst fra handlet.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const t = (h) => h.disabledReason;',
    },
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const t = (g) => resolveBlockedGateTooltip(g.reasons);',
    },
    // `message` på noget, der IKKE er gatens årsagsliste, er uberørt — fejlbokse og snapshot-issues
    // bruger samme feltnavn i vidt omfang.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const t = (row) => row.message;',
    },
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const t = (issues) => issues[0].message;',
    },
  ],
});
