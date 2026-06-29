import React from 'react';
import './minprocesrente.css';
import { ThemeProvider } from '@mui/material';
import StandaloneCalculatorLayout from '../../components/layout/StandaloneCalculatorLayout';
import { FormPersistenceProvider } from '../../contexts/FormPersistenceContext';
import { buildTheme } from '../../config/appTheme';
import StandaloneErrorBoundary from './StandaloneErrorBoundary';
import MinProcesrenteCalculatorPage from '../../components/pages/minprocesrente/MinProcesrenteCalculatorPage';

const theme = buildTheme('light');
const MOBILE_PAGE_BACKGROUND = '#f8f9fa';

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
    const html = document.documentElement;
    const root = document.getElementById('root');
    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevHtmlBackgroundColor = html.style.backgroundColor;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyHeight = body.style.height;
    const prevBodyBackgroundColor = body.style.backgroundColor;
    const prevThemeColorContent = themeColorMeta?.content;

    // Androids navigationsområde og iOS' safe-area bruger ikke altid React-fladens
    // baggrund. Sæt derfor den samme farve på dokumentets yderste lag som på siden.
    html.style.backgroundColor = MOBILE_PAGE_BACKGROUND;
    body.style.overflow = 'auto';
    body.style.height = 'auto';
    body.style.backgroundColor = MOBILE_PAGE_BACKGROUND;
    if (themeColorMeta) {
      themeColorMeta.content = MOBILE_PAGE_BACKGROUND;
    }

    let prevRootOverflow = '';
    let prevRootHeight = '';
    let prevRootMinHeight = '';
    let prevRootBackgroundColor = '';
    if (root) {
      prevRootOverflow = root.style.overflow;
      prevRootHeight = root.style.height;
      prevRootMinHeight = root.style.minHeight;
      prevRootBackgroundColor = root.style.backgroundColor;
      root.style.overflow = 'auto';
      root.style.height = 'auto';
      root.style.minHeight = '100vh';
      root.style.backgroundColor = MOBILE_PAGE_BACKGROUND;
    }

    return () => {
      html.style.backgroundColor = prevHtmlBackgroundColor;
      body.style.overflow = prevBodyOverflow;
      body.style.height = prevBodyHeight;
      body.style.backgroundColor = prevBodyBackgroundColor;
      if (themeColorMeta && prevThemeColorContent !== undefined) {
        themeColorMeta.content = prevThemeColorContent;
      }
      if (root) {
        root.style.overflow = prevRootOverflow;
        root.style.height = prevRootHeight;
        root.style.minHeight = prevRootMinHeight;
        root.style.backgroundColor = prevRootBackgroundColor;
      }
    };
  }, []);
};

const MinProcesrenteApp = React.memo(() => {
  useMobileScrollFix();
  return (
    <ThemeProvider theme={theme}>
      <FormPersistenceProvider>
        <StandaloneCalculatorLayout>
          <StandaloneErrorBoundary>
            <MinProcesrenteCalculatorPage />
          </StandaloneErrorBoundary>
        </StandaloneCalculatorLayout>
      </FormPersistenceProvider>
    </ThemeProvider>
  );
});

MinProcesrenteApp.displayName = 'MinProcesrenteApp';

export default MinProcesrenteApp;
