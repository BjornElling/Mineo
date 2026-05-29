import React from 'react';
import MinProcesrenteApp from './MinProcesrenteApp';
import { bootstrapClientApp } from '../shared/bootstrapClientApp';
import { setPdfFooterBrand } from '../../pdf/shared/pdfHelpers';

setPdfFooterBrand('minprocesrente.dk');

void bootstrapClientApp({
  renderApp: () => <MinProcesrenteApp />,
  capturePwaInstallPrompt: false,
  enforceUnsupportedDeviceGate: false,
});
