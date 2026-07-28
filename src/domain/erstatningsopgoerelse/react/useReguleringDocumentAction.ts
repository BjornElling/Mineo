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
  /**
   * Den brugerrettede besked for det seneste udfald (R6-F02/GM-F11). Begge callsites RENDERER den nu
   * gennem `DocumentOutcomeMessage`; tidligere blev den udledt her og ignoreret af dem begge, så et
   * stale-afbrud eller en død DEV-server var lydløs på både Lønindkomst-kortet og Oplysninger-fanen.
   *
   * Beskeden er `output.errorMessage` RÅT og ikke filtreret gennem `visibleDocumentFailureMessage`:
   * ingen af de to callsites viser gate-årsagen som synlig tekst ved knappen — den findes kun i
   * knappens tooltip — så et bortfiltreret gate-udfald ville netop give den usynlige blokering,
   * filtreringen ellers findes for at undgå at duplikere.
   */
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
    errorMessage: output.errorMessage,
    download: () => output.download(request),
  };
};
