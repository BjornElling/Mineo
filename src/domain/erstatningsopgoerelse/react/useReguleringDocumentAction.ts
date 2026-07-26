/**
 * `DocumentAction` for knappen "Tilgængelige reguleringssatser" (Fase 5, pass 5 — beslutning B4).
 *
 * Knappen findes to steder (EO's Oplysninger-fane på sagsniveau og hvert ansættelsesforhold på
 * Lønindkomst-fanen) og dispatcher til TRE forskellige outputs afhængigt af
 * `loenudviklingBeregningsgrundlag`. Den er derfor det ene sted i Fase 5, hvor selve OUTPUTVALGET
 * — ikke bare inputtet — afhænger af en committed indtastning.
 *
 * **Hvorfor et lag over kataloget frem for en ændring af livscyklussen.** `executeDocumentDownload`
 * tager én definition. Det er korrekt: livscyklussen skal have ét output at gate og rendere. Men
 * begge callsites læste før `loenudviklingBeregningsgrundlag` ved KLIK, altså FØR commit-barrieren,
 * og et settle kan ændre netop den værdi. Denne resolver vælger derfor `{definition, request}` to
 * gange — én gang mod render-tidens kontekst for den reaktive gate, og én gang inde i `download()`
 * mod et FRISKT snapshot taget efter settle. Livscyklussen er stadig den ene vej til afvikling;
 * resolveren afgør kun hvilket katalogopslag der aktiveres.
 *
 * **Den fælles gate-regel.** De to callsites havde hver sin `canDownload`-IIFE med ikke-identiske
 * formler. Nu kommer knaptilstanden fra den valgte definitions egen `project` — samme funktion, som
 * click-preflighten kalder — og de to steder kan ikke længere drifte.
 */
import React from 'react';
import { createDocumentSourceContext } from '../../../document/definition/documentSourceContext';
import type { DocumentOutcome } from '../../../document/definition/documentOutcome';
import { documentRejected } from '../../../document/definition/documentOutcome';
import { visibleDocumentFailureMessage } from '../../../document/definition/react/useDocumentDownload';
import { useMineoDocumentEnvironment } from '../../../document/runtime/react/useMineoDocumentEnvironment';
import {
  useMineoDocumentOutput,
  useMineoDocumentSourceContext,
} from '../../../document/runtime/react/useMineoDocumentOutput';
import {
  klLoenaftalerDocumentDefinition,
  krlDocumentDefinition,
  reguleringDocumentDefinition,
  resolveReguleringDocumentOutputId,
  type ReguleringDocumentRequest,
} from '../reguleringDocumentDefinitions';

/** Knappens tilstand og aktivering — ét samlet objekt pr. callsite. */
export type ReguleringDocumentAction = Readonly<{
  canDownload: boolean;
  disabledReason: string | undefined;
  errorMessage: string | null;
  download: () => Promise<DocumentOutcome>;
}>;

/**
 * Ingen af de tre outputs gælder for den aktuelle revision. Bruges både reaktivt (knappen slås fra)
 * og i preflighten (klikket afvises), så en basis, der forsvandt under settle, ikke leverer et
 * dokument fra det gamle grundlag.
 */
const NO_OUTPUT_REASON = {
  code: 'regulering:no-output',
  message: 'Der er ikke valgt et grundlag med tilgængelige reguleringssatser',
} as const;

export const useReguleringDocumentAction = (
  request: ReguleringDocumentRequest
): ReguleringDocumentAction => {
  const context = useMineoDocumentSourceContext();
  const environment = useMineoDocumentEnvironment();

  // Alle tre katalogposter oprettes altid. De er rene funktioner over konteksten og koster intet at
  // holde; at oprette dem betinget ville bryde hook-reglerne.
  const reguleringOutput = useMineoDocumentOutput(reguleringDocumentDefinition, request, context);
  const krlOutput = useMineoDocumentOutput(krlDocumentDefinition, request, context);
  const klOutput = useMineoDocumentOutput(klLoenaftalerDocumentDefinition, request, context);

  const selectedForRender = React.useMemo(() => {
    switch (resolveReguleringDocumentOutputId(context, request)) {
      case 'regulering': return reguleringOutput;
      case 'krl': return krlOutput;
      case 'kl-loenaftaler': return klOutput;
      case null: return null;
    }
  }, [context, request, reguleringOutput, krlOutput, klOutput]);

  const download = React.useCallback(async (): Promise<DocumentOutcome> => {
    // Outputvalget SKAL ske efter barrieren, men `executeDocumentDownload` ejer barrieren. Derfor
    // settler vi her først og genlæser grundlaget, og delegerer så til den valgte definition —
    // som selv settler igen (idempotent: en allerede lukket editor giver `committed` uden ændring)
    // og tager sit eget friske snapshot til gaten.
    //
    // Vinduet mellem de to settles er dækket, ikke ignoreret: hver af de tre definitioner
    // kontrollerer SELV i `project`, at grundlaget stadig svarer til netop dens output, og
    // fail-closer med `*:wrong-basis`, hvis det flyttede. Et grundlagsskifte i vinduet kan derfor
    // ikke levere det forrige grundlags dokument — det afviser downloaden.
    const preparation = await environment.criticalActions.prepare('download');
    if (preparation.status !== 'committed') {
      if (preparation.status === 'blocked') preparation.target?.focus();
      return documentRejected({ kind: 'settle-failed', phase: 'settle' });
    }

    const source = environment.captureSource();
    const freshContext = createDocumentSourceContext(source.evaluation, source.settings);
    switch (resolveReguleringDocumentOutputId(freshContext, request)) {
      case 'regulering': return await reguleringOutput.download(request);
      case 'krl': return await krlOutput.download(request);
      case 'kl-loenaftaler': return await klOutput.download(request);
      case null:
        return documentRejected({ kind: 'gate-blocked', phase: 'gate', reasons: [NO_OUTPUT_REASON] });
    }
  }, [environment, request, reguleringOutput, krlOutput, klOutput]);

  return {
    canDownload: selectedForRender?.canDownload ?? false,
    disabledReason: selectedForRender === null ? NO_OUTPUT_REASON.message : selectedForRender.disabledReason,
    errorMessage: selectedForRender === null ? null : visibleDocumentFailureMessage(selectedForRender),
    download,
  };
};
