/**
 * Én typed dokumentdefinition pr. katalogiseret output (greenfield-planens Fase 5;
 * `document-output-contract.md` §A1.2/§A2/§A7.1).
 *
 * Definitionen er den ENE ejer af et outputs inputdependencies, gate og output-invariants.
 * Før Fase 5 var den viden spredt over tre lag pr. output — React-handleren (commit-barriere,
 * kildeoptagelse, token-lighed, gate), `documentService.ts`' per-output funktion (lazy-load,
 * friskheds-recheck, formatvalg, generatorkald, fejlrouting) og et domæne-gate-modul — og hvert
 * output havde sin egen kopi af den spredning. Det gjorde det umuligt at håndhæve "alle outputs
 * gør dette", og fem af de atten outputs manglede i praksis mindst ét trin.
 *
 * Efter Fase 5 er livscyklussen ÉT objekt: definitionen leverer `project` (dependencies + gate)
 * og `render` (generatorkald), og kernen i `prepareDocument.ts`/`runPreparedDocument.ts` ejer
 * rækkefølgen. Reaktiv knap-gate og click-preflight kalder derfor samme `project` og kan ikke
 * drifte fra hinanden (planens exitkriterie / §10 acceptkriterie 27).
 */
import type { DocumentArtifact } from '../downloadArtifact';
import type { DocumentGenerationSession } from '../documentGenerationSession';
import type { DocumentBrevhovedType, DocumentSettings } from '../layout/documentBrevhoved';
import type { DocumentDownloadGateReason } from '../layout/documentGateTypes';
import type { DocumentSourceContext } from './documentSourceContext';

/** Kanonisk id pr. output. Holdes identisk med `CONSUMER_DOCUMENT_OUTPUTS`-id'erne. */
export type DocumentOutputId =
  | 'satser'
  | 'rente'
  | 'rente-oversigt'
  | 'regulering'
  | 'krl'
  | 'kl-loenaftaler'
  | 'erstatningsopgoerelse'
  | 'taf-fordelt-paa-aar'
  | 'taf-opreguleret-paa-aar'
  | 'taf-krav-graf'
  | 'varigemen'
  | 'aarsloen'
  | 'sh-dage'
  | 'kapitalisering'
  | 'efter-eal'
  | 'differencekrav'
  | 'loebende-ydelser'
  | 'forsoergertab'
  | 'standalone-rente'
  | 'standalone-rente-alle'
  | 'standalone-rente-oversigt';

/**
 * Resultatet af definitionens dependency-/gate-evaluering.
 *
 * `ready` betyder: alle dependencies er læsbare, den autoritative projektion kan dannes, og
 * output-invariants holder. `blocked` bærer den auditerbare årsag, som både knappens tooltip og
 * click-preflightens afvisning bruger — ÉN årsagskilde, ikke to (§A2 "auditerbare årsager").
 */
export type DocumentProjectionResult<TInput> =
  | Readonly<{ status: 'ready'; input: TInput }>
  | Readonly<{ status: 'blocked'; reasons: readonly DocumentDownloadGateReason[] }>;

/** Fælles brevhoved-/stamdata-kontekst, som kernen udleder af definitionens `brevhovedType`. */
export type DocumentRenderContext = Readonly<{
  visBrevhoved: boolean;
  settings: DocumentSettings;
}>;

/**
 * Definitionens generator-side. Modtager KUN den godkendte, tokenbundne `TInput` og
 * brevhoved-konteksten — aldrig en reader, rå sektioner eller UI-state (§A1.4).
 */
export type DocumentRenderer<TInput> = (
  session: DocumentGenerationSession,
  input: TInput,
  context: DocumentRenderContext
) => Promise<DocumentArtifact>;

export type DocumentDefinition<TInput> = Readonly<{
  id: DocumentOutputId;
  /**
   * Hvilken brevhoved-indstilling outputtet følger. Flere outputs deler bevidst samme type
   * (fx bruger KRL og KL-lønaftaler regulerings-indstillingen; der findes ingen separat toggle).
   */
  brevhovedType: DocumentBrevhovedType;
  /**
   * Den PDF-formulerede fejltekst for outputtet, fx "Kunne ikke generere satser-PDF".
   * Kernen oversætter "PDF" til det aktive formats label (`document-format-contract.md` §5),
   * så teksten SKAL bruge "PDF" udelukkende som formatreference.
   */
  errorLabel: string;
  /**
   * Dependencies + gate + output-invariants i ÉN ren funktion. Kaldes både af den reaktive
   * knap-gate (render-tidens evaluation) og af click-preflighten (frisk evaluation efter settle).
   * Må ikke læse rå sektioner, DOM eller UI-state. Delt domænearbejde hentes gennem
   * `context.shared`, så flere outputs på samme domæne kun betaler for det én gang.
   */
  project: (context: DocumentSourceContext) => DocumentProjectionResult<TInput>;
  /** Lazy-load af den tunge generator. Kernen kalder den FØRST efter gaten har sagt ready. */
  loadRenderer: () => Promise<DocumentRenderer<TInput>>;
}>;

/** Bekvemmeligheds-konstruktør, der bevarer `TInput`-inferensen gennem katalogets heterogene liste. */
export const defineDocumentOutput = <TInput>(
  definition: DocumentDefinition<TInput>
): DocumentDefinition<TInput> => Object.freeze(definition);

/**
 * `TInput` optræder både kovariant (`project` returnerer den) og kontravariant (`loadRenderer`
 * forbruger den), så `DocumentDefinition` er invariant i `TInput` og har ingen brugbar
 * supertype. Kataloget kan derfor ikke holde de rå definitioner i en homogen liste uden at
 * tabe koblingen mellem `project` og `render`.
 *
 * Løsningen er at eksistentielt lukke typen ved kilden: en `DocumentOutput` er en definition,
 * hvis `TInput` aldrig undslipper, fordi de to eneste operationer, nogen har brug for
 * (evaluér gate / afvikl download), begge er anvendt på definitionen selv. Den lukning laves
 * af `closeDocumentDefinition` i `documentCatalog.ts`, som er det ene sted `TInput` bindes.
 */
export type DocumentOutputMetadata = Readonly<{
  id: DocumentOutputId;
  brevhovedType: DocumentBrevhovedType;
  errorLabel: string;
}>;
