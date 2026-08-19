/**
 * Dokumentgates er formatblinde – STRUKTURELT (§10-kriterium 27).
 *
 * **Fejlformen, det udelukker.** Bar `DocumentSourceContext.settings` hele `SourceSettings` med
 * `documentDownloadFormat` som felt, kunne enhver af de 18 definitioner læse det valgte outputformat i
 * sin `project` og gøre samme sag `ready` som PDF og `blocked` som Word – en usynlig, formatafhængig
 * blokering, som §A2a's krav om samme definition til reaktiv gate og click-preflight ikke fanger, fordi
 * BEGGE kanaler ville se den samme skæve gate.
 *
 * Et VÆRN oven på en sådan åben capability – projicér alle 18 definitioner for begge formater og kræv
 * identiske resultater – har en iboende svaghed: langt de fleste projektioner er `blocked`, og kun få
 * når deres `ready`-gren, så en formatafhængighed skjult i en af de øvrige ready-grene ville ikke blive
 * fanget.
 *
 * **Capabilityen er derfor fjernet frem for bevogtet.** `DocumentSourceContext` bærer kun GATE-settings
 * (`MineoDocumentGateSettings` = EO's rækkepolitik). Formatet og brevhoved-flagene bor i miljøets
 * `renderSettings` og anvendes først EFTER gaten. Konsekvensen for denne fil er, at den gamle
 * invarians-sammenligning ikke længere KAN skrives: der findes ingen formatakse at variere i en
 * projektion, og en test, der varierede noget andet, ville måle en anden invariant end den, filen
 * hedder efter.
 *
 * Filen hævder derfor nu det, der faktisk er sandt, og gør det på det stærkeste tilgængelige niveau:
 *
 *   1. **Typegrænsen** – en `project`, der læser `context.settings.documentDownloadFormat`, kompilerer
 *      IKKE. Bevist med en rigtig TypeScript-oversættelse af en virtuel fil mod det ÆGTE program, ikke
 *      med en tekstsøgning. Det er testens hovedpåstand, og den kan ikke være grøn af tomhed: en
 *      genindførsel af feltet gør proben kompilérbar og testen rød.
 *   2. **Gate-fladen er smal** – gate-settings har præcis de nøgler, EO-rækkepolitikken har, og
 *      HVERKEN format eller brevhoved. Vokser fladen, fejler denne assertion, før nogen skal huske at
 *      spørge hvorfor.
 *   3. **Formatets vej til writeren er intakt** – normen er "formatet vælger writer, ikke dækning", og
 *      halvdel to af den sætning skal fortsat kunne bevises: miljøet oversætter render-settings til
 *      begge formater.
 *
 * Standalone MinProcesrente er uden for: dens definitioner har `void` som gate-settings og kan
 * strukturelt ikke se noget som helst.
 */
import path from 'node:path';
import ts from 'typescript';
import { createMineoDocumentEnvironment } from '../../document/runtime/mineoDocumentEnvironment';
import {
  __createTestDocumentRenderSettings,
  __createTestEoRowPolicy,
} from '../../settings/sourceSettings';
import type { DocumentInputAccess } from '../../inputCore/react/inputRuntimeContext';
import { CriticalActionCoordinator } from '../../inputCore/runtime/criticalActionCoordinator';
import { ActiveEditorRegistry } from '../../inputCore/runtime/activeEditorRegistry';
import { __createSlimInputTestStore } from '../../inputCore/runtime/slimInputStore';
import { createEmptySettledInput } from '../../inputCore';
import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../inputCore/evaluationSource';
import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';

const REPO_ROOT = process.cwd();
const PROBE_DIR = path.join(REPO_ROOT, 'src', 'document', 'definition');

/**
 * Oversætter én virtuel fil ind i det ÆGTE projekt og returnerer dens diagnostics.
 *
 * Filen lægges i `src/document/definition/`, så dens relative imports er præcis dem, en rigtig
 * definition ville bruge – proben måler altså den levende type og ikke en genskrevet kopi af den.
 * Den skrives ALDRIG til disk: en `CompilerHost` overlejrer den ene sti i hukommelsen og delegerer
 * alt andet til `ts.sys`.
 */
const compileProbe = (source: string): readonly ts.Diagnostic[] => {
  const probePath = path.join(PROBE_DIR, '__formatGateProbe.virtual.ts');
  // `tsconfig.json` i roden er en solution-fil uden compilerOptions; applikationens rigtige
  // indstillinger står i `tsconfig.app.json`. Proben skal måle DEM – det er hele pointen med at
  // oversætte ind i det ægte projekt frem for mod compilerens standarder.
  const configPath = path.join(REPO_ROOT, 'tsconfig.app.json');
  const config = ts.parseJsonConfigFileContent(
    ts.readConfigFile(configPath, ts.sys.readFile).config,
    ts.sys,
    REPO_ROOT
  );
  const options: ts.CompilerOptions = { ...config.options, noEmit: true, skipLibCheck: true };

  const host = ts.createCompilerHost(options, true);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
    path.resolve(fileName) === probePath
      ? ts.createSourceFile(fileName, source, languageVersion, true)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreate);
  const originalFileExists = host.fileExists.bind(host);
  host.fileExists = (fileName) =>
    path.resolve(fileName) === probePath || originalFileExists(fileName);
  const originalReadFile = host.readFile.bind(host);
  host.readFile = (fileName) =>
    path.resolve(fileName) === probePath ? source : originalReadFile(fileName);

  const program = ts.createProgram([probePath], options, host);
  const probeFile = program.getSourceFile(probePath);
  expect(probeFile, 'proben blev ikke indlæst i programmet').toBeDefined();
  return program.getSemanticDiagnostics(probeFile);
};

const diagnosticTexts = (diagnostics: readonly ts.Diagnostic[]): string =>
  diagnostics.map((d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n');

describe('dokumentgates er formatblinde (§10-kriterium 27)', () => {
  /**
   * Testens hovedpåstand. Proben er skrevet, som en formatafhængig definition faktisk ville se ud:
   * den forgrener sin gate på det valgte format og bliver dermed `ready` for PDF og `blocked` for
   * Word.
   *
   * Bemærk hvad der IKKE måles: at den nuværende kode ikke gør det. Det er svagere og allerede dækket
   * af typechecken. Her måles, at det ikke KAN gøres.
   */
  it('en gate, der læser downloadformatet, kan ikke kompilere', () => {
    const diagnostics = compileProbe(`
import type { DocumentProjectionResult } from './documentDefinition';
import type { DocumentSourceContext } from './documentSourceContext';
import type { MineoDocumentGateSettings } from './mineoDocumentDefinition';
import { blockedProjection } from './documentOutcome';

export const formatDependentGate = (
  context: DocumentSourceContext<MineoDocumentGateSettings>
): DocumentProjectionResult<string> =>
  context.settings.documentDownloadFormat === 'pdf'
    ? { status: 'ready', input: 'kun-pdf' }
    : blockedProjection('format', 'kun PDF');
`);

    // TS2339 = "Property does not exist on type". Koden asserteres eksplicit, så en fremtidig
    // omlægning, der gør proben ugyldig af en ANDEN grund (fx et forkert modulnavn), ikke kan
    // forveksles med den grænse, testen påstår at måle.
    expect(
      diagnostics.map((d) => d.code),
      `proben kompilerede eller fejlede af en anden grund:\n${diagnosticTexts(diagnostics)}`
    ).toContain(2339);
    expect(diagnosticTexts(diagnostics)).toContain('documentDownloadFormat');
  });

  /**
   * Kontrolprøven: den samme probe UDEN formatlæsningen skal kompilere rent.
   *
   * Uden dette ben kunne proben ovenfor være rød af en hvilken som helst grund – et forkert
   * importsti, en omdøbt type, en ændret `DocumentProjectionResult` – og testen ville stadig
   * bestå. Kontrolprøven er det, der gør TS2339-assertionen til evidens frem for til tilfældighed.
   */
  it('kontrolprøve: samme definition UDEN formatlæsning kompilerer rent', () => {
    const diagnostics = compileProbe(`
import type { DocumentProjectionResult } from './documentDefinition';
import type { DocumentSourceContext } from './documentSourceContext';
import type { MineoDocumentGateSettings } from './mineoDocumentDefinition';
import { blockedProjection } from './documentOutcome';

export const formatBlindGate = (
  context: DocumentSourceContext<MineoDocumentGateSettings>
): DocumentProjectionResult<string> =>
  context.settings.allowReguleringMedUdloebMedMaaneder > 0
    ? { status: 'ready', input: 'ok' }
    : blockedProjection('regel', 'ingen udløbsmåneder');
`);

    expect(diagnostics.length, `kontrolproben fejlede:\n${diagnosticTexts(diagnostics)}`).toBe(0);
  });

  /**
   * Gate-fladen må ikke vokse i det stille. En ny nøgle på gate-settings er en udvidelse af det, alle
   * 18 definitioner kan læse i deres gate, og skal begrundes – ikke opdages.
   */
  it('gate-settings bærer KUN rækkepolitikken – hverken format eller brevhoved', () => {
    const gateSettings = __createTestEoRowPolicy();

    expect(Object.keys(gateSettings).sort()).toEqual([
      'allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden',
      'allowReguleringMedUdloebMedMaaneder',
    ]);
    // Eksplicit, fordi netop de to er fundets emne: de findes ikke som RUNTIME-nøgler heller, så en
    // gate kan ikke nå dem gennem et cast eller et dynamisk opslag.
    expect(Object.keys(gateSettings)).not.toContain('documentDownloadFormat');
    expect(Object.keys(gateSettings)).not.toContain('brevhovedIndstillinger');
  });

  /**
   * Normens anden halvdel: formatet SKAL fortsat vælge writeren. En strukturel fjernelse af formatet
   * fra gaten er kun rigtig, hvis vejen til renderingen er intakt – ellers ville "gaten er formatblind"
   * være opnået ved at gøre formatet virkningsløst.
   */
  it('formatet når fortsat writer-valget gennem render-settings', () => {
    const catalog = getProductionInputCatalog();
    const runtime: DocumentInputAccess = Object.freeze({
      captureEvaluationSource: () => createInputEvaluation({
        input: createEmptySettledInput(),
        catalog,
        sourceToken: createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
      }),
      readCurrentSourceToken: () =>
        createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1)),
      criticalActions: new CriticalActionCoordinator(__createSlimInputTestStore(), new ActiveEditorRegistry()),
    });
    const environment = createMineoDocumentEnvironment(runtime, () => {
      throw new Error('capture bruges ikke i denne test');
    });

    expect(environment.resolveFormat(__createTestDocumentRenderSettings({ documentDownloadFormat: 'pdf' })))
      .toBe('pdf');
    expect(environment.resolveFormat(__createTestDocumentRenderSettings({ documentDownloadFormat: 'word' })))
      .toBe('word');
  });
});
