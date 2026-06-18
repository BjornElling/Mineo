// VIGTIGT: Denne bivirknings-import skal stå FØRST, før enhver anden import. Den sætter
// MinProcesrentes storage-namespace, før App-træet (og dets transitive imports) evalueres,
// så de to app-varianter aldrig deler sessionStorage-keys. Se modulets egen forklaring.
import './standaloneStorageNamespace';
import React from 'react';
import MinProcesrenteApp from './MinProcesrenteApp';
import { bootstrapClientApp } from '../shared/bootstrapClientApp';
import { setDocumentFooterBrand } from '../../document/layout/documentLayoutHelpers';

setDocumentFooterBrand('minprocesrente.dk');

void bootstrapClientApp({
  renderApp: () => <MinProcesrenteApp />,
  capturePwaInstallPrompt: false,
  enforceUnsupportedDeviceGate: false,
});
