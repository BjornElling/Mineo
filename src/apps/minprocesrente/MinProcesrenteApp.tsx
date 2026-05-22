import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import ErrorBoundary from '../../components/errors/ErrorBoundary';
import StandaloneCalculatorLayout from '../../components/layout/StandaloneCalculatorLayout';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { buildTheme } from '../../config/appTheme';
import { StandaloneSettingsBridge } from './StandaloneSettingsBridge';
import MinProcesrenteCalculatorPage from '../../components/pages/minprocesrente/MinProcesrenteCalculatorPage';

const theme = buildTheme('light');

const MinProcesrenteApp = React.memo(() => (
  <StandaloneSettingsBridge>
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <FormPersistenceProvider>
          <StandaloneCalculatorLayout>
            <ErrorBoundary>
              <MinProcesrenteCalculatorPage />
            </ErrorBoundary>
          </StandaloneCalculatorLayout>
        </FormPersistenceProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StandaloneSettingsBridge>
));

MinProcesrenteApp.displayName = 'MinProcesrenteApp';

export default MinProcesrenteApp;
