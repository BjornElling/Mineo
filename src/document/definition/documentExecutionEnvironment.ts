/**
 * App-runtime bag dokument-livscyklussen (Fase 5, pass 0).
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
 * Ét stabilt kildesnapshot. `settings` er bevidst `unknown` for kernen: kun definitionerne i det
 * pågældende domæne ved, hvilken form deres egen app leverer, og typen bindes derfor i miljøet
 * (`DocumentExecutionEnvironment<TSettings>`) frem for i kernen.
 */
export type DocumentSourceSnapshot<TSettings> = Readonly<{
  evaluation: InputEvaluation;
  settings: TSettings;
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
 * `readCurrentSourceToken` er trust-kritisk: den er den AUTORITATIVE friskhedskilde. Før pass 0
 * stolede afvikleren på en `isSourceCurrent`-closure, der blev leveret sammen med det godkendte
 * input — altså kunne den, der leverede inputtet, også levere sin egen definition af "frisk". Nu
 * læser afvikleren tokenet fra miljøet og sammenligner selv.
 */
export type DocumentExecutionEnvironment<TSettings, TBrevhovedKey extends string> = Readonly<{
  /** Optager ét friskt, stabilt kildesnapshot. Bevidst en funktion, så intet forældet snapshot kan holdes. */
  captureSource: () => DocumentSourceSnapshot<TSettings>;
  /** Den autoritative, aktuelle revision. Afvikleren sammenligner mod denne — ikke mod en closure. */
  readCurrentSourceToken: () => EvaluationSourceToken;
  /** Commit-barrieren, der settler en åben editor før preflight. */
  criticalActions: CriticalActionCoordinator;
  /** Hvilket format dette miljø leverer. Standalone returnerer altid 'pdf'. */
  resolveFormat: (settings: TSettings) => DocumentDownloadFormat;
  /** Åbner en generator-session for det valgte format (lazy-loader writeren). */
  createSession: (format: DocumentDownloadFormat) => Promise<DocumentGenerationSession>;
  /** Slår en brevhoved-policy op i appens settings. */
  resolveVisBrevhoved: (settings: TSettings, policy: DocumentBrevhovedPolicy<TBrevhovedKey>) => boolean;
  /**
   * Kun DEV: forbedret fejltekst når vite er død. Miljøer uden dev-server returnerer `null`.
   * Returnerer en `DocumentFailure`, hvis afviklingen skal stoppe før modul-load.
   */
  checkDevServerAvailability?: (diagnostics: DocumentDiagnostics) => Promise<DocumentFailure | null>;
  /**
   * Hvor UVENTEDE fejl rapporteres. Kun `kind: 'runtime'` når hertil — forventelige afvisninger og
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
