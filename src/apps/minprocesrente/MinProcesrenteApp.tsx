import React from 'react';
import './minprocesrente.css';
import { ThemeProvider } from '@mui/material';
import StandaloneCalculatorLayout from '../../components/layout/StandaloneCalculatorLayout';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { buildTheme } from '../../config/appTheme';
import { StandaloneSettingsBridge } from './StandaloneSettingsBridge';
import StandaloneErrorBoundary from './StandaloneErrorBoundary';
import MinProcesrenteCalculatorPage from '../../components/pages/minprocesrente/MinProcesrenteCalculatorPage';

const theme = buildTheme('light');

// index.css sætter body og #root til overflow:hidden (nødvendigt for Mineo-desktop).
// Det importeres EFTER minprocesrente.css via bootstrapClientApp og overskriver CSS-filens
// @media (pointer:coarse)-regler, fordi cascade-rækkefølgen afgøres af load-tidspunktet.
// Inline styles (højere specificitet end stylesheets) løser dette deterministisk.
const useMobileScrollFix = () => {
  React.useEffect(() => {
    const isTouchDevice =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice) return;

    const body = document.body;
    const root = document.getElementById('root');
    const prevBodyOverflow = body.style.overflow;
    const prevBodyHeight = body.style.height;
    body.style.overflow = 'auto';
    body.style.height = 'auto';

    let prevRootOverflow = '';
    let prevRootHeight = '';
    let prevRootMinHeight = '';
    if (root) {
      prevRootOverflow = root.style.overflow;
      prevRootHeight = root.style.height;
      prevRootMinHeight = root.style.minHeight;
      root.style.overflow = 'auto';
      root.style.height = 'auto';
      root.style.minHeight = '100vh';
    }

    return () => {
      body.style.overflow = prevBodyOverflow;
      body.style.height = prevBodyHeight;
      if (root) {
        root.style.overflow = prevRootOverflow;
        root.style.height = prevRootHeight;
        root.style.minHeight = prevRootMinHeight;
      }
    };
  }, []);
};

const MinProcesrenteApp = React.memo(() => {
  useMobileScrollFix();
  return (
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
  );
});

MinProcesrenteApp.displayName = 'MinProcesrenteApp';

export default MinProcesrenteApp;
