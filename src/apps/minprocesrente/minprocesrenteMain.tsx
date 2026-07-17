// VIGTIGT: Denne bivirknings-import skal stå FØRST, før enhver anden import. Den sætter
// MinProcesrentes storage-namespace, før App-træet (og dets transitive imports) evalueres,
// så de to app-varianter aldrig deler sessionStorage-keys. Se modulets egen forklaring.
import './standaloneStorageNamespace';
import React from 'react';
import MinProcesrenteApp from './MinProcesrenteApp';
import { bootstrapClientApp } from '../shared/bootstrapClientApp';
import { setDocumentBrand } from '../../document/documentBrand';
import { initializePersistenceRuntime } from '../../persistence/persistenceRuntime';
import { bootstrapProductionInputRuntime } from '../../inputCore/react';

setDocumentBrand('minprocesrente.dk');

void bootstrapClientApp({
  renderApp: () => {
    const persistenceRuntime = initializePersistenceRuntime();
    // Standalone bruger samme greenfield-input-/revisionskerne (§3.10, acceptkriterium 31): hydrér før render.
    const { binding: inputRuntimeBinding } = bootstrapProductionInputRuntime();
    return <MinProcesrenteApp persistenceRuntime={persistenceRuntime} inputRuntimeBinding={inputRuntimeBinding} />;
  },
  capturePwaInstallPrompt: false,
  enforceUnsupportedDeviceGate: false,
});
