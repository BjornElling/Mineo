/**
 * Standalone MinProcesrentes vej fra siden til et dokumentoutput (Fase 5, pass 6).
 *
 * Spejler hovedappens `useMineoDocumentOutput`, men mod standalones eget miljø. De to hooks er
 * bevidst adskilte og ikke generaliseret til én: hovedappens version læser `AppSettings` gennem
 * `useAppSettings`, som standalone hverken monterer eller må importere (AST-reglen
 * `layer/minprocesrente-standalone-import-boundary`). Fællesmængden er allerede delt — det er
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

/** Render-tidens delte kildekontekst. `settings` er `undefined`: standalone har ingen indstillinger. */
export const useStandaloneDocumentSourceContext = (): DocumentSourceContext<void> => {
  const evaluation = useInputEvaluation();
  return useDocumentSourceContext<void>(evaluation, undefined);
};

export const useStandaloneDocumentOutput = <TInput, TRequest>(
  definition: DocumentDefinition<TRequest, TInput, void, never>,
  // Se noten i `useMineoDocumentOutput`: uden `NoInfer` ville et `undefined`-argument inferere
  // `TRequest = undefined` frem for definitionens `void`.
  gateRequest: NoInfer<TRequest>,
  context: DocumentSourceContext<void>
): DocumentDownloadHandle<TRequest> => {
  const runtime = useDocumentInputAccess();
  const environment = React.useMemo(
    () => createStandaloneDocumentEnvironment(runtime),
    [runtime]
  );
  const output: DocumentOutput<TRequest, void> = React.useMemo(
    () => closeDocumentDefinition(definition, environment),
    [definition, environment]
  );
  return useDocumentDownload(output, context, gateRequest);
};
