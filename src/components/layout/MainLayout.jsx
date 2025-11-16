import React from 'react';
import { Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import SideMenu from './SideMenu';
import Container from './Container';
import Overlay from '../ui/Overlay';
import { saveToFile } from '../../utils/fileSave';
import { loadFromFile } from '../../utils/fileLoad';
import { clearAllData } from '../../utils/dataCollection';
import { deleteFileHandleFromIndexedDB } from '../../utils/fileHandleStorage';

/**
 * Hovedlayout for applikationen
 */
const MainLayout = React.memo(({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [overlay, setOverlay] = React.useState(null);

  const activePage = location.pathname.substring(1) || 'stamdata';

  const handlePageChange = React.useCallback((pageId) => {
    navigate(`/${pageId}`);
  }, [navigate]);

  // Gem-funktionalitet
  const handleGem = React.useCallback(async () => {
    try {
      const result = await saveToFile();

      // Håndter annullering
      if (result.cancelled) {
        return;
      }

      if (result.success) {
        setOverlay({
          message: 'Gemt',
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Gem fejlede:', error);
      setOverlay({
        message: error.message || 'Kunne ikke gemme fil',
        type: 'error',
      });
    }
  }, []);

  // Hent-funktionalitet
  const handleHent = React.useCallback(async () => {
    try {
      const result = await loadFromFile();

      // Håndter annullering
      if (result.cancelled) {
        return;
      }

      if (result.success) {
        // Gem overlay-info til sessionStorage INDEN reload
        // Den vises så EFTER reload når data er indlæst
        if (result.fieldCountWarning) {
          const warning = result.fieldCountWarning;
          sessionStorage.setItem('mineo_pendingOverlay', JSON.stringify({
            message: `Hentet\n\nADVARSEL: Forventet ${warning.expected} felter, fandt ${warning.actual}`,
            type: 'warning',
          }));
        } else {
          sessionStorage.setItem('mineo_pendingOverlay', JSON.stringify({
            message: 'Hentet',
            type: 'success',
          }));
        }

        // Reload side for at opdatere UI
        window.location.reload();
      }
    } catch (error) {
      console.error('Hent fejlede:', error);
      setOverlay({
        message: error.message || 'Kunne ikke hente fil',
        type: 'error',
      });
    }
  }, []);

  // Slet alt-funktionalitet
  const handleSletAlt = React.useCallback(async () => {
    const confirmed = window.confirm(
      'ADVARSEL: Dette vil slette alle indtastede oplysninger!\n\nEr du sikker på at du vil fortsætte?'
    );

    if (!confirmed) {
      return;
    }

    try {
      // Ryd alle mineo_* keys fra sessionStorage
      clearAllData();

      // Fjern også sidste gemte filsti
      sessionStorage.removeItem('mineo_lastSavedFilePath');

      // Slet file handle fra IndexedDB
      await deleteFileHandleFromIndexedDB();

      // Gem overlay-info til sessionStorage INDEN reload
      // Den vises så EFTER reload når data er slettet
      sessionStorage.setItem('mineo_pendingOverlay', JSON.stringify({
        message: 'Alt data slettet',
        type: 'info',
      }));

      // Reload side for at opdatere UI
      window.location.reload();

    } catch (error) {
      console.error('Slet alt fejlede:', error);
      setOverlay({
        message: 'Kunne ikke slette data',
        type: 'error',
      });
    }
  }, []);

  // Tjek for pending overlay efter reload
  React.useEffect(() => {
    const pendingOverlay = sessionStorage.getItem('mineo_pendingOverlay');
    if (pendingOverlay) {
      try {
        const overlayData = JSON.parse(pendingOverlay);
        setOverlay(overlayData);
        // Fjern pending overlay fra sessionStorage
        sessionStorage.removeItem('mineo_pendingOverlay');
      } catch (error) {
        console.error('Kunne ikke parse pending overlay:', error);
      }
    }
  }, []);

  // Ctrl+S keyboard shortcut for gem
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S (eller Cmd+S på Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); // Forhindre browser save-dialog
        handleGem();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleGem]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SideMenu
        activePage={activePage}
        onPageChange={handlePageChange}
        onGem={handleGem}
        onHent={handleHent}
        onSletAlt={handleSletAlt}
      />
      <Container>{children}</Container>

      {/* Vis overlay hvis aktiv */}
      {overlay && (
        <Overlay
          message={overlay.message}
          type={overlay.type}
          onClose={() => setOverlay(null)}
        />
      )}
    </Box>
  );
});

export default MainLayout;