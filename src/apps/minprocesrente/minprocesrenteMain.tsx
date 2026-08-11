// VIGTIGT: Denne bivirknings-import skal stå FØRST, før enhver anden import. Den sætter
// MinProcesrentes storage-namespace, før App-træet (og dets transitive imports) evalueres,
// så de to app-varianter aldrig deler sessionStorage-keys. Se modulets egen forklaring.
import './standaloneStorageNamespace';
import React from 'react';
import MinProcesrenteApp from './MinProcesrenteApp';
import { bootstrapClientApp } from '../shared/bootstrapClientApp';
import { setDocumentBrand } from '../../document/documentBrand';
import { bootstrapProductionInputRuntime } from '../../inputCore/react';
import StandaloneErrorBoundary from './StandaloneErrorBoundary';

setDocumentBrand('minprocesrente.dk');

void bootstrapClientApp({
  renderApp: () => {
    // Hydrér den ene input-runtime FØR render (§3.10). Standalone og hovedappen bruger samme inputkerne.
    const { binding } = bootstrapProductionInputRuntime();
    return (
      <StandaloneErrorBoundary>
        <MinProcesrenteApp inputRuntimeBinding={binding} />
      </StandaloneErrorBoundary>
    );
  },
  loadAppStyles: () => import('./minprocesrente.css'),
  capturePwaInstallPrompt: false,
  // Standalone-beregneren er den kontraktfastsatte mobil/tablet-undtagelse (§app-shell §3.1).
  enforceUnsupportedDeviceGate: false,
});
