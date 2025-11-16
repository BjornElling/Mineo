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
    if (e.key !== 'Tab' && e.key !== 'Enter') return;
    if (!containerRef.current) return;

    // Find KUN input, select og textarea elementer (IKKE knapper, tabs, osv.)
    const focusableElements = Array.from(
      containerRef.current.querySelectorAll(
        'input:not([disabled]):not([type="hidden"]):not([type="button"]), select:not([disabled]), textarea:not([disabled])'
      )
    ).filter((el) => {
      // Filtrer elementer der ikke er synlige
      const style = window.getComputedStyle(el);

      // Tjek om det er en rigtig knap (BUTTON-tag)
      const isButtonElement = el.tagName === 'BUTTON';

      // MUI Select bruger input med role="button", så vi skal tillade input-elementer med button role
      // men ekskludere faktiske button-elementer
      const isInputWithButtonRole = el.tagName === 'INPUT' && el.getAttribute('role') === 'button';

      return (
        !isButtonElement &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        el.offsetParent !== null // Dette tjekker om elementet eller nogen forælder er skjult
      );
    });

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const currentIndex = focusableElements.indexOf(document.activeElement);

    // Hjælpefunktion til at fokusere og selektere indhold i et element
    const focusAndSelect = (element) => {
      element.focus();

      // Selekter indhold hvis elementet har en værdi (ikke tom eller placeholder)
      // Brug setTimeout for at sikre at fokus er sat før vi selekterer
      setTimeout(() => {
        if (element.value && element.value.trim() !== '') {
          // Tjek om det er en MUI Select (har aria-haspopup="listbox")
          const isSelect = element.getAttribute('aria-haspopup') === 'listbox';

          if (!isSelect) {
            // For normale input-felter: selekter alt tekst
            element.select();
          }
          // For dropdowns: gør ingenting ekstra (de kan ikke selekteres)
        }
      }, 0);
    };

    // Enter opfører sig PRÆCIS som Tab (cirkulær navigation)
    if (e.key === 'Enter') {
      e.preventDefault();

      if (currentIndex === -1) {
        // Hvis intet er fokuseret, fokuser på første element
        focusAndSelect(firstElement);
      } else if (currentIndex === focusableElements.length - 1) {
        // Hvis på sidste element, hop til første element (cirkulær navigation - samme som Tab)
        focusAndSelect(firstElement);
      } else {
        // Ellers hop til næste element
        focusAndSelect(focusableElements[currentIndex + 1]);
      }
      return;
    }

    // Tab navigation - ALTID prevent default for at forhindre at forlade containeren
    e.preventDefault();

    if (e.shiftKey) {
      // Shift+Tab - cirkulær navigation
      if (currentIndex === -1) {
        // Hvis intet er fokuseret, fokuser på sidste element
        focusAndSelect(lastElement);
      } else if (currentIndex === 0) {
        // Hvis på første element, hop til sidste element (cirkulær)
        focusAndSelect(lastElement);
      } else {
        // Ellers hop til forrige element
        focusAndSelect(focusableElements[currentIndex - 1]);
      }
    } else {
      // Tab - cirkulær navigation
      if (currentIndex === -1) {
        // Hvis intet er fokuseret, fokuser på første element
        focusAndSelect(firstElement);
      } else if (currentIndex === focusableElements.length - 1) {
        // Hvis på sidste element, hop til første element (cirkulær)
        focusAndSelect(firstElement);
      } else {
        // Ellers hop til næste element
        focusAndSelect(focusableElements[currentIndex + 1]);
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