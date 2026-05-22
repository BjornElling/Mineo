import React from 'react';
import { ThemeProvider } from '@mui/material';
import StandaloneCalculatorLayout from '../../components/layout/StandaloneCalculatorLayout';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { buildTheme } from '../../config/appTheme';
import { StandaloneSettingsBridge } from './StandaloneSettingsBridge';
import StandaloneErrorBoundary from './StandaloneErrorBoundary';
import MinProcesrenteCalculatorPage from '../../components/pages/minprocesrente/MinProcesrenteCalculatorPage';

const theme = buildTheme('light');

const MinProcesrenteApp = React.memo(() => (
  <StandaloneSettingsBridge>
    <ThemeProvider theme={theme}>
      <FormPersistenceProvider>
        <StandaloneCalculatorLayout>
          <StandaloneErrorBoundary>
            <MinProcesrenteCalculatorPage />
          </StandaloneErrorBoundary>
        </StandaloneCalculatorLayout>
      </FormPersistenceProvider>
    </ThemeProvider>
  </StandaloneSettingsBridge>
));

MinProcesrenteApp.displayName = 'MinProcesrenteApp';

export default MinProcesrenteApp;
