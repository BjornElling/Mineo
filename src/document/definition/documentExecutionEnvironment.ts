/**
 * App-runtime bag dokument-livscyklussen.
 *
 * **Hvorfor dette findes.** Kernen var oprindeligt skrevet som fællesmængden af de 18
 * `download*Dokument`-funktioner, og den arvede derfor deres forudsætninger som om de var
 * universelle: at der altid findes en `AppSettings`-lignende settings-DTO, at formatet altid vælges
 * af en brugerindstilling, at brevhoved altid er en indstillings-nøgle, og at uventede fejl altid
 * routes til hovedappens `reportSystemIssue`. Ingen af de fire gælder for standalone
 * MinProcesrente, som er fast PDF, uden brevhoved, uden `AppSettingsProvider` og med en bevidst
 * isoleret fejl-sink (jf. isolations-værnet i `architectureRules.ts`).
 *
 * Konsekvensen var, at standalone kun kunne komme ind i kataloget ved at lyve: falske
 * brevhoved-flags, en irrelevant `DocumentBrevhovedType`, dummy-EO-toggles, eller en kopieret runner.
 *
 * Derfor er runtimepolitikken nu en INJICERET afhængighed frem for en forudsætning. Kernen kender
 * ikke `AppSettings`, ikke `reportSystemIssue` og ikke Word-formatet; den kender kun dette miljø.
 * Hver app komponerer sit eget i sin composition root.
 */
import type { EvaluationSourceToken } from '../../inputCore/evaluationSource';
import type { InputEvaluation } from '../../inputCore/inputReader';
import type { CriticalActionCoordinator } from '../../inputCore/runtime/criticalActionCoordinator';
import type { DocumentGenerationSession } from '../documentGenerationSession';
import type { DocumentDownloadFormat } from '../documentFormat';
import type { DocumentDiagnostics, DocumentFailure } from './documentOutcome';

/**
 * Ét stabilt kildesnapshot. Begge settings-halvdele er bevidst uspecificerede for kernen: kun
 * definitionerne i det pågældende domæne ved, hvilken form deres egen app leverer, og typerne bindes
 * derfor i miljøet (`DocumentExecutionEnvironment<TGateSettings, TRenderSettings>`) frem for i kernen.
 *
 * **Hvorfor TO halvdele.** Snapshottet bar før ét `settings`-objekt, som både gik ind i
 * definitionens `project` OG blev brugt til formatvalg og brevhoved efter gaten. Fordi hovedappens
 * objekt var hele `SourceSettings`, kunne enhver definition lovligt læse `documentDownloadFormat` i
 * sin gate – altså gøre samme sag `ready` som PDF og `blocked` som Word. Det ville ikke blive fanget
 * af §A2a's "samme definition til reaktiv gate og click-preflight", fordi BEGGE kanaler ville se den
 * samme skæve gate. Normen er entydig: **formatet vælger writer, ikke dækning.**
 *
 * Nu er de to roller adskilt i TYPEN. `gate` er alt, en `project` må se; `render` er format og
 * brevhoved til selve renderingen efter gaten. Hovedappens brevhoved-flag ligger desuden i gate-
 * projektionen, fordi det afgør, om stamdata er en afhængighed overhovedet. En formatafhængighed i
 * en gate er dermed en compilerfejl (TS2339) frem for en regel, et værn skal overvåge.
 *
 * **Begge halvdele optages i samme kald.** Det er en atomisk invariant: læses de to på hver sit
 * tidspunkt, kan et nyere settingsrevision-token parres med et ældre format-/regelobjekt, og intet
 * friskhedscheck kan fange det, fordi tokenet ser aktuelt ud.
 */
export type DocumentSourceSnapshot<TGateSettings, TRenderSettings> = Readonly<{
  evaluation: InputEvaluation;
  /** Den gate-relevante politik. Det ENESTE settings, definitionernes `project` kan se. */
  gateSettings: TGateSettings;
  /** Format og brevhoved til renderingen. Læses kun af miljøet efter gaten. */
  renderSettings: TRenderSettings;
}>;

/**
 * Hvordan brevhoved afgøres for ét output. En discriminated policy frem for et bart
 * `DocumentBrevhovedType`, fordi "dette output har intet brevhoved" er en LEGITIM tilstand
 * (standalone) og ikke skal udtrykkes ved at pege på en tilfældig fremmed indstillings-nøgle.
 */
export type DocumentBrevhovedPolicy<TBrevhovedKey extends string> =
  | Readonly<{ kind: 'settings-key'; key: TBrevhovedKey }>
  | Readonly<{ kind: 'none' }>;

/**
 * Appens runtime-politik.
 *
 * `readCurrentSourceToken` er trust-kritisk: den er den AUTORITATIVE friskhedskilde. Før den aktuelle implementering
 * stolede afvikleren på en friskheds-closure, der blev leveret sammen med det godkendte
 * input – altså kunne den, der leverede inputtet, også levere sin egen definition af "frisk". Nu
 * læser afvikleren tokenet fra miljøet og sammenligner selv.
 */
export type DocumentExecutionEnvironment<TGateSettings, TRenderSettings, TBrevhovedKey extends string> = Readonly<{
  /** Optager ét friskt, stabilt kildesnapshot. Bevidst en funktion, så intet forældet snapshot kan holdes. */
  captureSource: () => DocumentSourceSnapshot<TGateSettings, TRenderSettings>;
  /** Den autoritative, aktuelle revision. Afvikleren sammenligner mod denne – ikke mod en closure. */
  readCurrentSourceToken: () => EvaluationSourceToken;
  /** Commit-barrieren, der settler en åben editor før preflight. */
  criticalActions: CriticalActionCoordinator;
  /**
   * Hvilket format dette miljø leverer. Standalone returnerer altid 'pdf'.
   *
   * Tager `TRenderSettings` og ikke gate-halvdelen: formatet er per norm usynligt for gaten, og
   * signaturen er det sted, adskillelsen håndhæves.
   */
  resolveFormat: (settings: TRenderSettings) => DocumentDownloadFormat;
  /** Åbner en generator-session for det valgte format (lazy-loader writeren). */
  createSession: (format: DocumentDownloadFormat) => Promise<DocumentGenerationSession>;
  /** Slår en brevhoved-policy op i appens render-settings. */
  resolveVisBrevhoved: (settings: TRenderSettings, policy: DocumentBrevhovedPolicy<TBrevhovedKey>) => boolean;
  /**
   * Kun DEV: forbedret fejltekst når vite er død. Miljøer uden dev-server returnerer `null`.
   * Returnerer en `DocumentFailure`, hvis afviklingen skal stoppe før modul-load.
   */
  checkDevServerAvailability?: (diagnostics: DocumentDiagnostics) => Promise<DocumentFailure | null>;
  /**
   * Hvor UVENTEDE fejl rapporteres. Kun `kind: 'runtime'` når hertil – forventelige afvisninger og
   * dev-server-nedetid rapporteres bevidst IKKE som systemfejl (§A5).
   */
  reportFailure: (failure: DocumentFailure, diagnostics: DocumentDiagnostics) => void;
  /**
   * Om en UVENTET runtimefejl også skal have en lokal besked i siden.
   *
   * Dette er APP-POLITIK, ikke en egenskab ved fejlen, og hører derfor i miljøet frem for i
   * beskedlaget. §A5 kræver, at en systemteknisk fejl routes til den centrale fejlrapportering;
   * viser siden SAMTIDIG sin egen tekst, er den rapporteret to steder, og brugeren møder en
   * teknisk fejl inline i sideflowet. Hovedappen sætter derfor `false`.
   *
   * Standalone MinProcesrente sætter `true`: den har ingen central fejloverflade (den må ikke
   * importere `reportSystemIssue`), så uden en lokal besked ville en runtimefejl være helt tavs
   * for brugeren.
   */
  showRuntimeFailureLocally: boolean;
}>;
