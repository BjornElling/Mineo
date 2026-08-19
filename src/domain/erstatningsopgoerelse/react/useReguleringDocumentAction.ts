/**
 * `DocumentAction` for knappen "Tilgængelige reguleringssatser".
 *
 * Knappen findes to steder (EO's Oplysninger-fane på sagsniveau og hvert ansættelsesforhold på
 * Lønindkomst-fanen) og dispatcher til TRE forskellige outputs afhængigt af
 * `loenudviklingBeregningsgrundlag`. Den er derfor det ene sted i dokumentdefinitionen, hvor selve OUTPUTVALGET
 * – ikke bare inputtet – afhænger af en committed indtastning.
 *
 * Outputvalget ligger i en nominal `DocumentAction`: livscyklussen settler, capturer og vælger præcis
 * én gang fra samme friske kilde. React har derfor ingen selvstændig preflight og kan ikke komme til
 * at afvikle et andet output end den reactive gate beskriver.
 *
 * **Den fælles gate-regel.** De to callsites havde hver sin `canDownload`-IIFE med ikke-identiske
 * formler. Nu kommer knaptilstanden fra den valgte definitions egen `project` – samme funktion, som
 * click-preflighten kalder – og de to steder kan ikke længere drifte.
 */
import type { DocumentOutcome } from '../../../document/definition/documentOutcome';
import { resolveDocumentGateTooltip } from '../../../document/layout/documentGateTypes';
import {
  useMineoDocumentActionOutput,
  useMineoDocumentSourceContext,
} from '../../../document/runtime/react/useMineoDocumentOutput';
import {
  REGULERING_NO_OUTPUT_REASON,
  reguleringDocumentAction,
  type ReguleringDocumentRequest,
} from '../reguleringDocumentDefinitions';

/** Knappens tilstand og aktivering – ét samlet objekt pr. callsite. */
export type ReguleringDocumentAction = Readonly<{
  canDownload: boolean;
  disabledReason: string | undefined;
  /**
   * Den brugerrettede besked for det seneste udfald. Begge callsites RENDERER den nu
   * gennem `DocumentOutcomeMessage`; tidligere blev den udledt her og ignoreret af dem begge, så et
   * stale-afbrud eller en død DEV-server var lydløs på både Lønindkomst-kortet og Oplysninger-fanen.
   *
   * Beskeden er `output.errorMessage` råt – hook'en har allerede filtreret gate-blokeringer væk, fordi
   * en deaktiveret knap ikke svarer med tekst. Det er derfor netop stale-afbruddet og DEV-serveren,
   * der er tilbage at vise.
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
    // Fallbacken oversættes gennem `resolveDocumentGateTooltip` som enhver anden årsag. Her stod før
    // `REGULERING_NO_OUTPUT_REASON.message`, altså den INTERNE forklaring – så brugeren kunne læse "Der er
    // ikke valgt et grundlag med tilgængelige reguleringssatser" på en knap, hvis årsag selv siger
    // `missing-input`. `message` er aldrig brugertekst (`page-component-contract.md` §11.1).
    disabledReason: output.disabledReason ?? resolveDocumentGateTooltip(REGULERING_NO_OUTPUT_REASON),
    errorMessage: output.errorMessage,
    download: () => output.download(request),
  };
};
