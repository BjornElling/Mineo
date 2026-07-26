/**
 * `DocumentAction` for knappen "Tilgængelige reguleringssatser" (Fase 5, pass 5 — beslutning B4).
 *
 * Knappen findes to steder (EO's Oplysninger-fane på sagsniveau og hvert ansættelsesforhold på
 * Lønindkomst-fanen) og dispatcher til TRE forskellige outputs afhængigt af
 * `loenudviklingBeregningsgrundlag`. Den er derfor det ene sted i Fase 5, hvor selve OUTPUTVALGET
 * — ikke bare inputtet — afhænger af en committed indtastning.
 *
 * Outputvalget ligger i en nominal `DocumentAction`: livscyklussen settler, capturer og vælger præcis
 * én gang fra samme friske kilde. React har derfor ingen selvstændig preflight og kan ikke komme til
 * at afvikle et andet output end den reactive gate beskriver.
 *
 * **Den fælles gate-regel.** De to callsites havde hver sin `canDownload`-IIFE med ikke-identiske
 * formler. Nu kommer knaptilstanden fra den valgte definitions egen `project` — samme funktion, som
 * click-preflighten kalder — og de to steder kan ikke længere drifte.
 */
import type { DocumentOutcome } from '../../../document/definition/documentOutcome';
import { visibleDocumentFailureMessage } from '../../../document/definition/react/useDocumentDownload';
import {
  useMineoDocumentActionOutput,
  useMineoDocumentSourceContext,
} from '../../../document/runtime/react/useMineoDocumentOutput';
import {
  REGULERING_NO_OUTPUT_REASON,
  reguleringDocumentAction,
  type ReguleringDocumentRequest,
} from '../reguleringDocumentDefinitions';

/** Knappens tilstand og aktivering — ét samlet objekt pr. callsite. */
export type ReguleringDocumentAction = Readonly<{
  canDownload: boolean;
  disabledReason: string | undefined;
  errorMessage: string | null;
  download: () => Promise<DocumentOutcome>;
}>;

export const useReguleringDocumentAction = (
  request: ReguleringDocumentRequest
): ReguleringDocumentAction => {
  const context = useMineoDocumentSourceContext();
  const output = useMineoDocumentActionOutput(reguleringDocumentAction, request, context);

  return {
    canDownload: output.canDownload,
    disabledReason: output.disabledReason ?? REGULERING_NO_OUTPUT_REASON.message,
    errorMessage: visibleDocumentFailureMessage(output),
    download: () => output.download(request),
  };
};
