/**
 * Standalone MinProcesrentes vej fra siden til et dokumentoutput.
 *
 * Spejler hovedappens `useMineoDocumentOutput`, men mod standalones eget miljø. De to hooks er
 * bevidst adskilte og ikke generaliseret til én: hovedappens version læser `AppSettings` gennem
 * `useAppSettings`, som standalone hverken monterer eller må importere (AST-reglen
 * `layer/minprocesrente-standalone-import-boundary`). Fællesmængden er allerede delt – det er
 * `useDocumentDownload` og `closeDocumentDefinition` i kernen.
 */
import React from 'react';
import { closeDocumentDefinition, type DocumentOutput } from '../../../document/definition/documentCatalog';
import type { DocumentDefinition } from '../../../document/definition/documentDefinition';
import type { DocumentSourceContext } from '../../../document/definition/documentSourceContext';
import {
  useDocumentDownload,
  useDocumentSourceContext,
  type DocumentDownloadHandle,
} from '../../../document/definition/react/useDocumentDownload';
import { useDocumentInputAccess, useInputEvaluation } from '../../../inputCore/react';
import { createStandaloneDocumentEnvironment } from './standaloneDocumentEnvironment';
import type { StandaloneDownloadTracker } from '../useStandaloneExitGuard';

/** Render-tidens delte kildekontekst. Gate-settings er `undefined`: standalone har ingen indstillinger. */
export const useStandaloneDocumentSourceContext = (): DocumentSourceContext<void> => {
  const evaluation = useInputEvaluation();
  return useDocumentSourceContext<void>(evaluation, undefined);
};

export const useStandaloneDocumentOutput = <TInput, TRequest>(
  definition: DocumentDefinition<TRequest, TInput, void, never>,
  // Se noten i `useMineoDocumentOutput`: uden `NoInfer` ville et `undefined`-argument inferere
  // `TRequest = undefined` frem for definitionens `void`.
  gateRequest: NoInfer<TRequest>,
  context: DocumentSourceContext<void>,
  /**
   * Sidens exit-guard, der skal vide, at arbejdet nu ER hentet (BB-048). Leveres af siden, fordi
   * guarden er én pr. flade – se `useStandaloneExitGuard`.
   */
  onDownloadOutcome: StandaloneDownloadTracker
): DocumentDownloadHandle<TRequest> => {
  const runtime = useDocumentInputAccess();
  const environment = React.useMemo(
    () => createStandaloneDocumentEnvironment(runtime),
    [runtime]
  );
  const output: DocumentOutput<TRequest, void, void> = React.useMemo(
    () => closeDocumentDefinition(definition, environment),
    [definition, environment]
  );
  // Render-settings er `undefined` af samme grund som gate-settings: standalone har fast PDF og intet
  // brevhoved, så der findes ingen værdi at levere.
  const handle = useDocumentDownload(output, context, gateRequest, undefined);

  // Indpakningen ligger HER frem for på siden, så ingen af standalones outputs kan glemme at melde sit
  // udfald til guarden – heller ikke et fremtidigt fjerde.
  const download = React.useCallback(async (request: TRequest) => {
    const outcome = await handle.download(request);
    onDownloadOutcome(outcome);
    return outcome;
  }, [handle, onDownloadOutcome]);

  return React.useMemo(() => Object.freeze({ ...handle, download }), [handle, download]);
};
