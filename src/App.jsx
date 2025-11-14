import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import MainLayout from './components/layout/MainLayout';
import Stamdata from './components/pages/Stamdata';
import Satser from './components/pages/Satser';

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
 * Hovedkomponent for MINEO applikationen
 */
function App() {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/stamdata" replace />} />
          <Route path="/stamdata" element={<StamdataPage />} />
          <Route path="/satser" element={<SatserPage />} />
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
    </ThemeProvider>
  );
}

export default App;