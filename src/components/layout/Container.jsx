import React from 'react';
import { Box } from '@mui/material';

/**
 * Container komponent til content-område
 * Wrapper indhold med consistent padding og styling
 *
 * Features:
 * - Tab-fangst: Holder Tab/Shift+Tab navigation inden for containeren
 * - Enter-navigation: Enter opfører sig som Tab (springer til næste felt)
 */
const Container = React.memo(({ children }) => {
  const containerRef = React.useRef(null);

  // Håndter tab-navigation og enter-navigation for at holde fokus inden for containeren
  const handleKeyDown = React.useCallback((e) => {
    // Håndter både Tab og Enter
    if ((e.key !== 'Tab' && e.key !== 'Enter') || !containerRef.current) return;

    // Find alle fokuserbare elementer inden for containeren
    const focusableElements = containerRef.current.querySelectorAll(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    // Hvis der kun er ét inputfelt, lad Tab og Enter fjerne fokus
    if (focusableElements.length === 1) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        document.activeElement.blur();
      }
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);

    // Enter opfører sig som Tab (går til næste felt)
    if (e.key === 'Enter') {
      e.preventDefault();

      if (currentIndex === -1 || currentIndex === focusableElements.length - 1) {
        // Hvis ikke fokuseret eller på sidste element, hop til første
        firstElement.focus();
      } else {
        // Ellers hop til næste element
        focusableElements[currentIndex + 1].focus();
      }
      return;
    }

    // Tab navigation
    if (e.shiftKey) {
      // Shift+Tab: Hvis på første element, hop til sidste
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: Hvis på sidste element, hop til første
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  return (
    <Box
      ref={containerRef}
      onKeyDown={handleKeyDown}
      sx={{
        flex: 1,
        padding: 3,
        backgroundColor: '#f8f9fa',
        overflowY: 'auto',
        height: '100vh'
      }}
    >
      <Box sx={{ width: '1000px', paddingLeft: '50px', paddingTop: '50px' }}>
        {children}
      </Box>
    </Box>
  );
});

export default Container;