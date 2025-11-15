import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { FormPersistenceProvider } from './contexts/FormPersistenceContext.jsx';
import MainLayout from './components/layout/MainLayout';
import Stamdata from './components/pages/Stamdata';
import Satser from './components/pages/Satser';
import Renteberegning from './components/pages/Renteberegning';
import Om from './components/pages/Om';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: 'Ubuntu, sans-serif',
  },
});

/**
 * Stamdata page wrapper component
 */
const StamdataPage = React.memo(() => (
  <MainLayout>
    <Stamdata />
  </MainLayout>
));

/**
 * Satser page wrapper component
 */
const SatserPage = React.memo(() => (
  <MainLayout>
    <Satser />
  </MainLayout>
));

/**
 * Renteberegning page wrapper component
 */
const RenteberegningPage = React.memo(() => (
  <MainLayout>
    <Renteberegning />
  </MainLayout>
));

/**
 * Om page wrapper component
 */
const OmPage = React.memo(() => (
  <MainLayout>
    <Om />
  </MainLayout>
));

/**
 * Hovedkomponent for MINEO applikationen
 */
function App() {
  // Håndter browser back/forward cache (bfcache) for at undgå React hook fejl
  React.useEffect(() => {
    const handlePageShow = (event) => {
      // Hvis siden kommer fra bfcache, genindlæs den
      if (event.persisted) {
        window.location.reload();
      }
    };

    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <FormPersistenceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/stamdata" replace />} />
            <Route path="/stamdata" element={<StamdataPage />} />
            <Route path="/satser" element={<SatserPage />} />
            <Route path="/renteberegning" element={<RenteberegningPage />} />
            <Route path="/om" element={<OmPage />} />
            <Route
              path="*"
              element={
                <div style={{ padding: '40px' }}>
                  <h2>404 - Side ikke fundet</h2>
                  <p>URL: {window.location.pathname}</p>
                </div>
              }
            />
          </Routes>
        </BrowserRouter>
      </FormPersistenceProvider>
    </ThemeProvider>
  );
}

export default App;
