import React from 'react';
import MinProcesrenteApp from './MinProcesrenteApp';
import { bootstrapClientApp } from '../shared/bootstrapClientApp';

void bootstrapClientApp({
  renderApp: () => <MinProcesrenteApp />,
  capturePwaInstallPrompt: false,
});
