/**
 * Det kanoniske outputkatalog (Fase 5; `document-output-contract.md` §A2a).
 *
 * Kataloget er komplethedskilden for dokumentgaten: hvert katalogiseret output — også standalone
 * MinProcesrente — har præcis én typed definition, og et UI-entrypoint kan ikke starte
 * dokumentarbejde uden den. `documentCatalog.completeness.test.ts` beviser, at kataloget dækker
 * `CONSUMER_DOCUMENT_OUTPUTS` udtømmende, og matrix-testen kører de ni obligatoriske cases mod
 * hver enkelt post.
 *
 * `TInput` bindes ved kilden: `closeDocumentDefinition` er det ene sted, en definitions
 * inputtype eksistentielt lukkes, så kataloget kan være en homogen liste uden at koblingen
 * mellem `project` og `render` går tabt. Der findes ingen `as`-cast og ingen `unknown`-mellemled.
 */
import type { CriticalActionCoordinator } from '../../inputCore/runtime/criticalActionCoordinator';
import type { DocumentDefinition, DocumentOutputId, DocumentOutputMetadata } from './documentDefinition';
import type { DocumentSourceContext } from './documentSourceContext';
import { downloadDocument, type DocumentDownloadOutcome } from './downloadDocument';
import type { DocumentEvaluationSource } from './prepareDocument';
import { allowDocumentDownload, type DocumentDownloadGateResult } from '../layout/documentGateTypes';
import {
  erstatningsopgoerelseDocumentDefinition,
  tafFordeltPaaAarDocumentDefinition,
  tafKravGrafDocumentDefinition,
  tafOpreguleretPaaAarDocumentDefinition,
} from '../../domain/erstatningsopgoerelse/eoDocumentDefinitions';
import {
  differencekravDocumentDefinition,
  efterEalDocumentDefinition,
  kapitaliseringDocumentDefinition,
  loebendeYdelserDocumentDefinition,
} from '../../domain/erhvervsevnetab/eetDocumentDefinitions';
import { forsoergertabDocumentDefinition } from '../../domain/forsoergertab/forsoergertabDocumentDefinition';
import { varigeMenDocumentDefinition } from '../../domain/varigemen/varigeMenDocumentDefinition';

/**
 * En katalogpost. `TInput` er lukket inde: de to eneste operationer udefra er "evaluér gaten" og
 * "download", og begge anvender definitionen på sig selv. Derfor kan en katalogpost hverken
 * lække et ugated input ud eller modtage et fremmed input ind.
 */
export type DocumentOutput = DocumentOutputMetadata & Readonly<{
  /**
   * Den reaktive knap-gate. Kalder PRÆCIS samme `project` som click-preflighten, så de to ikke
   * kan drifte (§10 acceptkriterie 27). Returnerer kontraktens `DocumentDownloadGateResult`,
   * fordi knappen og dens tooltip forbruger den form.
   */
  evaluateGate: (context: DocumentSourceContext) => DocumentDownloadGateResult;
  download: (deps: Readonly<{
    criticalActions: CriticalActionCoordinator;
    captureSource: DocumentEvaluationSource;
  }>) => Promise<DocumentDownloadOutcome>;
}>;

export const closeDocumentDefinition = <TInput>(definition: DocumentDefinition<TInput>): DocumentOutput =>
  Object.freeze({
    id: definition.id,
    brevhovedType: definition.brevhovedType,
    errorLabel: definition.errorLabel,
    evaluateGate: (context) => {
      const projected = definition.project(context);
      return projected.status === 'ready'
        ? allowDocumentDownload()
        : { canDownload: false, reasons: projected.reasons };
    },
    download: (deps) => downloadDocument(definition, deps),
  });

/**
 * Katalogets poster. Udfyldes pass for pass i WI-008; completeness-testen fejler, indtil alle
 * 18 katalog-id'er + de 3 standalone-id'er er repræsenteret.
 */
const DOCUMENT_OUTPUT_LIST: readonly DocumentOutput[] = [
  closeDocumentDefinition(erstatningsopgoerelseDocumentDefinition),
  closeDocumentDefinition(tafFordeltPaaAarDocumentDefinition),
  closeDocumentDefinition(tafOpreguleretPaaAarDocumentDefinition),
  closeDocumentDefinition(tafKravGrafDocumentDefinition),
  closeDocumentDefinition(loebendeYdelserDocumentDefinition),
  closeDocumentDefinition(kapitaliseringDocumentDefinition),
  closeDocumentDefinition(efterEalDocumentDefinition),
  closeDocumentDefinition(differencekravDocumentDefinition),
  closeDocumentDefinition(forsoergertabDocumentDefinition),
  closeDocumentDefinition(varigeMenDocumentDefinition),
];

export const DOCUMENT_OUTPUTS: ReadonlyMap<DocumentOutputId, DocumentOutput> = new Map(
  DOCUMENT_OUTPUT_LIST.map((output) => [output.id, output])
);
