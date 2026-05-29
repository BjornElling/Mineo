import React from 'react';
import MinProcesrenteApp from './MinProcesrenteApp';
import { bootstrapClientApp } from '../shared/bootstrapClientApp';
import { setPdfFooterBrand } from '../../pdf/shared/pdfHelpers';
import { setStorageNamespace } from '../../config/storageManifest';

// Isolér MinProcesrentes sessionStorage fra Mineos, så de aldrig deler keys selv på samme origin.
// Skal sættes før al storage-adgang (dvs. før bootstrapClientApp og enhver persistence-hydrering).
setStorageNamespace('minprocesrente');
setPdfFooterBrand('minprocesrente.dk');

void bootstrapClientApp({
  renderApp: () => <MinProcesrenteApp />,
  capturePwaInstallPrompt: false,
  enforceUnsupportedDeviceGate: false,
});
