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
import type { DocumentOutput } from '../documentCatalog';
import type { DocumentGateReasons, DocumentOutcome } from '../documentOutcome';
import { createDocumentSourceContext, type DocumentSourceContext } from '../documentSourceContext';
import type { InputEvaluation } from '../../../inputCore/inputReader';

/**
 * Render-tidens kildekontekst. ÉN pr. revision/settingsrevision, delt af alle outputs på siden, så
 * fire EO-knapper eller fire EET-faner betaler for deres fælles domæneprojektion én gang i stedet for
 * fire. Konteksten er immutable og bundet til ét `EvaluationSourceToken`; dependency-listen er derfor
 * tilstrækkelig som identitet.
 */
export const useDocumentSourceContext = <TSettings>(
  evaluation: InputEvaluation,
  settings: TSettings
): DocumentSourceContext<TSettings> =>
  React.useMemo(() => createDocumentSourceContext(evaluation, settings), [evaluation, settings]);

export type DocumentDownloadHandle<TRequest> = Readonly<{
  canDownload: boolean;
  /** HELE årsagslisten ved blokering, så en konsument kan vise mere end den primære grund. */
  blockedReasons: DocumentGateReasons | null;
  /** Den primære grund til knappens tooltip. */
  disabledReason: string | undefined;
  /** Udfaldet af den seneste aktivering, eller `null` før første klik / efter rydning. */
  lastOutcome: DocumentOutcome | null;
  clearOutcome: () => void;
  download: (request: TRequest) => Promise<DocumentOutcome>;
}>;

export const useDocumentDownload = <TRequest, TSettings>(
  output: DocumentOutput<TRequest, TSettings>,
  context: DocumentSourceContext<TSettings>,
  /**
   * Requesten, den reaktive gate skal vurderes for. For outputs uden aktiveringsidentitet er den
   * `undefined as void`; for rækkebaserede outputs er det den række, knappen tegnes for.
   */
  gateRequest: TRequest
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

  return {
    canDownload: gate.canDownload,
    blockedReasons: gate.canDownload ? null : gate.reasons,
    disabledReason: gate.canDownload ? undefined : gate.reasons[0].message,
    lastOutcome,
    clearOutcome,
    download,
  };
};
