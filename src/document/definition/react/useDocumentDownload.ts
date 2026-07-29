/**
 * React-grænsen til et dokumentkatalog (Fase 5).
 *
 * Hook'en er den ENESTE vej fra en side til et dokumentoutput, og den leverer begge sider af
 * kontraktens §A2 fra samme katalogpost:
 *
 *   - `canDownload`/`blockedReasons` — den reaktive knap-gate, udledt af render-tidens
 *     `InputEvaluation`, så knappen er både visuelt og funktionelt disabled ved blokering.
 *   - `download(request)` — click-preflighten, som settler editoren og evaluerer et FRISKT snapshot.
 *
 * Fordi begge kalder samme definition med samme `request`, kan de ikke drifte fra hinanden (§10
 * acceptkriterie 27). Før Fase 5 var dette to selvstændige udtryk pr. side — og for
 * regulering/KRL/KL-lønaftaler endda to forskellige formler i to komponenter.
 *
 * **Miljøet injiceres.** Hook'en hardkodede oprindeligt hovedappens kildeoptagelse og krævede
 * `AppSettingsProvider`, hvilket gjorde den ubrugelig for standalone MinProcesrente (fast PDF, intet
 * brevhoved, isoleret fejl-sink, ingen AppSettings). Nu kommer runtimepolitikken fra appens
 * composition root, så samme hook-implementering betjener begge apps.
 */
import React from 'react';
import type { DocumentGateSnapshot, DocumentOutput } from '../documentCatalog';
import type { DocumentGateReasons, DocumentOutcome } from '../documentOutcome';
import { createDocumentSourceContext, type DocumentSourceContext } from '../documentSourceContext';
import type { InputEvaluation } from '../../../inputCore/inputReader';

/**
 * Render-tidens kildekontekst. ÉN pr. revision/settingsrevision, delt af alle outputs på siden, så
 * fire EO-knapper eller fire EET-faner betaler for deres fælles domæneprojektion én gang i stedet for
 * fire. Konteksten er immutable og bundet til ét `EvaluationSourceToken`; dependency-listen er derfor
 * tilstrækkelig som identitet.
 */
export const useDocumentSourceContext = <TGateSettings>(
  evaluation: InputEvaluation,
  gateSettings: TGateSettings
): DocumentSourceContext<TGateSettings> =>
  React.useMemo(() => createDocumentSourceContext(evaluation, gateSettings), [evaluation, gateSettings]);

export type DocumentDownloadHandle<TRequest> = Readonly<{
  /**
   * Den reaktive gate for en VILKÅRLIG request — samme `project`, samme kontekst og samme
   * definition som `download(request)` bruger.
   *
   * Findes for rækkebaserede outputs, hvor ét handle ikke kan repræsentere N rækkers knaptilstand.
   * Uden den ville en tabel udlede rækkeknapperne af sin egen projektion, mens klikket gik gennem
   * definitionen — to udtryk for samme regel, som kan drifte. Det er præcis det, §A2's krav om
   * "samme definition OG samme request" forbyder.
   */
  gateFor: (request: TRequest) => DocumentGateSnapshot;
  canDownload: boolean;
  /** HELE årsagslisten ved blokering, så en konsument kan vise mere end den primære grund. */
  blockedReasons: DocumentGateReasons | null;
  /** Den primære grund til knappens tooltip. */
  disabledReason: string | undefined;
  /** Udfaldet af den seneste aktivering, eller `null` før første klik / efter rydning. */
  lastOutcome: DocumentOutcome | null;
  /**
   * Den brugerrettede besked for det seneste udfald, eller `null` når der intet er at vise
   * (succes, eller et blokeret felt der selv bærer sin røde markering). Siden viser den; den
   * formulerer den ikke.
   */
  errorMessage: string | null;
  clearOutcome: () => void;
  download: (request: TRequest) => Promise<DocumentOutcome>;
}>;

/**
 * Den besked, en sides fejlboks skal vise — eller `null`.
 *
 * Adskiller sig fra `handle.errorMessage` ved at udelade GATE-blokeringer. Flere sider viser
 * gate-årsagen ved siden af knappen (som tooltip eller nedtonet tekst) og svarer på en blokeret
 * aktivering med shake/fokus frem for en fejllinje; en boks ovenikøbet ville duplikere signalet.
 * Det er også adfærden fra før Fase 5, hvor en blokeret download eksplicit nulstillede beskeden.
 *
 * Sider UDEN en synlig gate-årsag ved knappen skal bruge `handle.errorMessage` direkte — ellers
 * ville blokeringen blive usynlig, hvilket bryder "ingen usynlig blokering"-invarianten.
 */
export const visibleDocumentFailureMessage = <TRequest>(
  handle: DocumentDownloadHandle<TRequest>
): string | null =>
  handle.lastOutcome?.status === 'rejected' && handle.lastOutcome.rejection.kind === 'gate-blocked'
    ? null
    : handle.errorMessage;

export const useDocumentDownload = <TRequest, TGateSettings, TRenderSettings>(
  output: DocumentOutput<TRequest, TGateSettings, TRenderSettings>,
  context: DocumentSourceContext<TGateSettings>,
  /**
   * Requesten, den reaktive gate skal vurderes for. For outputs uden aktiveringsidentitet er den
   * `undefined as void`; for rækkebaserede outputs er det den række, knappen tegnes for.
   */
  gateRequest: TRequest,
  /**
   * Render-tidens format-/brevhoved-settings. Bevidst en SELVSTÆNDIG parameter og ikke et felt på
   * `context`: udfaldsbeskeden navngiver formatet, mens gaten per norm ikke må se det (R6-F03).
   * Havde de delt objekt, ville adskillelsen kun være en konvention.
   */
  renderSettings: TRenderSettings
): DocumentDownloadHandle<TRequest> => {
  const [lastOutcome, setLastOutcome] = React.useState<DocumentOutcome | null>(null);

  const gate = React.useMemo(
    () => output.evaluateGate(context, gateRequest),
    [output, context, gateRequest]
  );

  const download = React.useCallback(async (request: TRequest): Promise<DocumentOutcome> => {
    setLastOutcome(null);
    const outcome = await output.download(request);
    setLastOutcome(outcome);
    return outcome;
  }, [output]);

  const clearOutcome = React.useCallback(() => setLastOutcome(null), []);

  const gateFor = React.useCallback(
    (request: TRequest) => output.evaluateGate(context, request),
    [output, context]
  );

  return {
    gateFor,
    canDownload: gate.canDownload,
    blockedReasons: gate.canDownload ? null : gate.reasons,
    disabledReason: gate.canDownload ? undefined : gate.reasons[0].message,
    lastOutcome,
    errorMessage: lastOutcome === null ? null : output.resolveOutcomeMessage(lastOutcome, renderSettings),
    clearOutcome,
    download,
  };
};
