/**
 * React-grænsen til det kanoniske dokumentkatalog (Fase 5).
 *
 * Hook'en er den ENESTE vej fra en side til et dokumentoutput, og den leverer begge sider af
 * kontraktens §A2 fra samme katalogpost:
 *
 *   - `canDownload`/`disabledReason` — den reaktive knap-gate, udledt af render-tidens
 *     `InputEvaluation`, så knappen er både visuelt og funktionelt disabled ved blokering.
 *   - `download()` — click-preflighten, som settler editoren og evaluerer et FRISKT snapshot.
 *
 * Fordi begge kalder `output.evaluateGate`/`output.download` på den samme definition, kan de ikke
 * drifte fra hinanden (§10 acceptkriterie 27). Før Fase 5 var dette to selvstændige udtryk pr.
 * side — og for regulering/KRL/KL-lønaftaler endda to forskellige formler i to komponenter.
 */
import React from 'react';
import { useAppSettings } from '../../../contexts/useAppSettings';
import {
  useCriticalInputActions,
  useInputEvaluation,
} from '../../../inputCore/react/useInputEvaluation';
import { captureProductionEvaluationSource } from '../../../inputCore/react/productionInputRuntime';
import type { DocumentOutput } from '../documentCatalog';
import { createDocumentSourceContext, type DocumentSourceContext } from '../documentSourceContext';
import type { DocumentDownloadOutcome } from '../downloadDocument';

/**
 * Render-tidens kildekontekst. ÉN pr. revision/settingsrevision, delt af alle outputs på siden, så
 * fire EO-knapper eller fire EET-faner betaler for deres fælles domæneprojektion én gang i stedet
 * for fire. Konteksten er immutable og bundet til ét `EvaluationSourceToken`.
 */
export const useDocumentSourceContext = (): DocumentSourceContext => {
  const evaluation = useInputEvaluation();
  const { settings } = useAppSettings();
  return React.useMemo(() => createDocumentSourceContext(evaluation, settings), [evaluation, settings]);
};

export type DocumentDownloadHandle = Readonly<{
  canDownload: boolean;
  /** Kort årsag til knappens tooltip, når `canDownload` er false. */
  disabledReason: string | undefined;
  /**
   * Brugerrettet fejl fra den seneste aktivering, eller `null`. Sættes både ved en afvist
   * preflight (gate/stale) og ved en runtimefejl under en godkendt download; ryddes ved næste
   * aktivering, så en gammel besked ikke overlever en efterfølgende succes.
   */
  errorMessage: string | null;
  clearErrorMessage: () => void;
  download: () => Promise<DocumentDownloadOutcome>;
}>;

export const useDocumentDownload = (
  output: DocumentOutput,
  context: DocumentSourceContext
): DocumentDownloadHandle => {
  const criticalActions = useCriticalInputActions();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const gate = React.useMemo(() => output.evaluateGate(context), [output, context]);

  const download = React.useCallback(async (): Promise<DocumentDownloadOutcome> => {
    setErrorMessage(null);
    const outcome = await output.download({
      criticalActions,
      captureSource: captureProductionEvaluationSource,
    });
    if (outcome.status === 'failed') {
      setErrorMessage(outcome.error);
    } else if (outcome.status === 'rejected') {
      setErrorMessage(outcome.message);
    }
    return outcome;
  }, [output, criticalActions]);

  const clearErrorMessage = React.useCallback(() => setErrorMessage(null), []);

  return {
    canDownload: gate.canDownload,
    disabledReason: gate.canDownload ? undefined : gate.reasons[0]?.message,
    errorMessage,
    clearErrorMessage,
    download,
  };
};
