import React from 'react';
import { ThemeProvider } from '@mui/material';
import StandaloneCalculatorLayout from '../../components/layout/StandaloneCalculatorLayout';
import { buildTheme } from '../../config/appTheme';
import MinProcesrenteCalculatorPage from '../../components/pages/minprocesrente/MinProcesrenteCalculatorPage';
import {
  ProductionInputRuntimeProvider,
} from '../../inputCore/react/productionInputRuntimeProvider';
import type { InputRuntimeBinding } from '../../inputCore/react';

const theme = buildTheme('light');

const MinProcesrenteApp = React.memo(({
  inputRuntimeBinding,
}: {
  inputRuntimeBinding: InputRuntimeBinding;
}) => {
  return (
    <ThemeProvider theme={theme}>
      <ProductionInputRuntimeProvider binding={inputRuntimeBinding}>
        <StandaloneCalculatorLayout>
          <MinProcesrenteCalculatorPage />
        </StandaloneCalculatorLayout>
      </ProductionInputRuntimeProvider>
    </ThemeProvider>
  );
});

MinProcesrenteApp.displayName = 'MinProcesrenteApp';

export default MinProcesrenteApp;
