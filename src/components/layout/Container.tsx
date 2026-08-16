import React from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import { mergeSx } from '../../utils/mergeSx';
import { ScrollContainerProvider } from '../../contexts/ScrollContainerContext';
import ScrollToTopButton from '../ui/ScrollToTopButton';
import { useFocusableInventory } from './containerNavigation/useFocusableInventory';
import { useContainerKeyboardNavigation } from './containerNavigation/useContainerKeyboardNavigation';

/**
 * Container: sidens indholdsområde — scroll-vært, `<main>`-landmark og
 * «single owner» af fokus-traversering for indholdet. PageTabs/SideTab er native
 * navigationskontroller og holdes bevidst uden for indholdssekvensen.
 *
 * Selve navigationen bor i `containerNavigation/`, ikke her:
 * - `focusRowGeometry.ts` — rene beslutninger om hvem der er nabo (rækker, tolerance, wrap).
 * - `useFocusableInventory.ts` — hvilke felter der findes, og cachen bag dem.
 * - `useContainerKeyboardNavigation.ts` — oversættelsen fra tastetryk til fokus-flytning.
 *
 * Opdelingen er lavet, fordi navigationen udgjorde ~440 af filens 584 linjer og kun kunne
 * rammes gennem en fuld render: geometrien — den del der reelt bærer logikken — var låst
 * bag jsdom-layout. Kontraktens §Implementeringsfrihed tillader eksplicit omlægningen, så
 * længe adfærden bevares.
 *
 * KEYBOARD NAVIGATION KONTRAKT (normativ):
 *
 * Tab / Shift+Tab
 *   - Flytter fokus til næste/forrige fokusbare element (cirkulær navigation)
 *   - Må ALDRIG selektere indhold i målelementet
 *   - Kun fokus – ingen selection
 *
 * Enter
 *   - Opfører sig som Tab (flytter fokus fremad)
 *   - Shift+Enter opfører sig som Shift+Tab (flytter fokus bagud)
 *   - Må ALDRIG selektere indhold
 *   - UNDTAGELSE: Popup-widgets (dropdown/datepicker) – Container intercepter IKKE Enter,
 *     så widget selv kan åbne/lukke ved Enter
 *   - UNDTAGELSE: Textareas – Enter giver newline som normalt
 *   - UNDTAGELSE: Radiobuttons – Enter vælger den fokuserede radiobutton
 *
 * ArrowLeft / ArrowRight
 *   - Flytter fokus i samme række, når editor/menu er lukket
 *   - UNDTAGELSE: Radiobuttons – flytter aktiv selection og fokus i radiogruppen med wrap
 *
 * Museklik
 *   - Container håndterer IKKE museklik
 *   - Selection ved museklik er komponentens eget ansvar (ikke Container)
 *
 * Popup-widgets (StyledDropdown, DatePicker, etc.)
 *   - Detekteres via ARIA semantik: role="combobox", aria-haspopup, aria-expanded
 *   - Container respekterer deres interne tastatur-håndtering
 *
 * Cross-cutting contract:
 *   - Container er "single owner" af fokus-traversering på en side
 *   - Interaktive subtrees (tabeller med Excel-navigation) skal kalde preventDefault()
 *     + stopPropagation() for de taster de ejer, ellers kan fokus hoppe dobbelt
 *
 * Se src/contracts/keyboard-navigation.md for fuld dokumentation.
 */
interface ContainerProps {
  children?: React.ReactNode;
  scrollSx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
}

const Container = React.memo(({ children, scrollSx, contentSx }: ContainerProps) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const inventory = useFocusableInventory(containerRef);
  const handleKeyDown = useContainerKeyboardNavigation(containerRef, inventory);

  return (
    <ScrollContainerProvider containerRef={containerRef}>
      <Box
        ref={containerRef}
        data-mineo-scroll-container="true"
        onKeyDown={handleKeyDown}
        sx={mergeSx(
          {
            flex: 1,
            padding: 3,
            backgroundColor: 'var(--color-surface)',
            overflowY: 'auto',
            overflowX: 'auto',
            height: '100vh',
          },
          scrollSx
        )}
      >
        {/* component="main" giver siden dens primære landmark (axe/optimale løsninger:
            "Dokumentet har ikke et primært landmark"). Container rendres præcis én gang pr.
            side i begge apps — Mineo (MainLayout: SideMenu + ét Container) og standalone
            MinProcesrente — så der er altid nøjagtig ét <main>. Det er kun et semantisk
            element-skifte (div→main); layout, scroll og fokus-håndtering er uændret. */}
        <Box
          component="main"
          sx={mergeSx({ width: '1000px', paddingLeft: '50px', paddingTop: '50px' }, contentSx)}
        >
          {children}
        </Box>
        <ScrollToTopButton />
      </Box>
    </ScrollContainerProvider>
  );
});

Container.displayName = 'Container';

export default Container;
