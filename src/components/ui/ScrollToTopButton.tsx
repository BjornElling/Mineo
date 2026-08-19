import React from 'react';
import { Box, Fab, Zoom } from '@mui/material';
import { useScrollContainer } from '../../contexts/useScrollContainer';
import {
  SCROLL_VISIBILITY_THRESHOLD_PX,
  SCROLL_BUTTON_POSITION_BOTTOM_PX,
  SCROLL_BUTTON_POSITION_RIGHT_PX,
  SCROLL_BUTTON_SIZE_PX,
} from '../../config/scrollToTopConfig';
import { CONTENT_SCALE_CSS_VARIABLE } from '../../utils/uiScale';

/**
 * Flydende scroll-til-top knap der vises når brugeren har scrollet ned
 *
 * Knappen vises som et overlay nederst til højre og scroller smootht til toppen
 * når den klikkes. Den bruger en afdæmpet semitransparent farve for ikke at
 * dominere UI'et, men har en tydelig hover-effekt.
 *
 * ROBUSTHED:
 * - Bruger ScrollContainerContext med eksplicit ready-state
 * - Type-safe scroll-container reference (kun når ready=true)
 * - Undgår unødvendige state-updates ved at tracke sidste synlighed
 * - Unmounter knappen når den ikke er synlig (tilgængelighed + cleanup)
 * - Event listeners bindes til container-element, ikke ref-objekt (undgår ref-identity issues)
 */
const ScrollToTopButton = React.memo(() => {
  const containerContext = useScrollContainer();
  const [visible, setVisible] = React.useState(false);
  const lastVisibleRef = React.useRef(false);
  const container = containerContext.ready ? containerContext.container : null;

  // Track container-elementet direkte (ikke context-objektet)
  // Dette undgår re-binding af listeners ved context-object identity shifts
  const containerElementRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!containerContext.ready) {
      return;
    }

    if (!(container instanceof HTMLElement)) {
      return;
    }
    containerElementRef.current = container;

    const handleScroll = () => {
      const shouldShow = container.scrollTop > SCROLL_VISIBILITY_THRESHOLD_PX;

      // Undgå unødvendige state-updates
      if (shouldShow !== lastVisibleRef.current) {
        lastVisibleRef.current = shouldShow;
        setVisible(shouldShow);
      }
    };

    // Indledende tjek
    handleScroll();

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      containerElementRef.current = null;
    };
  }, [container, containerContext.ready]);

  const handleClick = React.useCallback(() => {
    const container = containerElementRef.current;
    if (!(container instanceof HTMLElement)) return;

    container.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  return (
    <Zoom in={visible} unmountOnExit>
      <Fab
        onClick={handleClick}
        sx={{
          position: 'fixed',
          bottom: SCROLL_BUTTON_POSITION_BOTTOM_PX,
          right: SCROLL_BUTTON_POSITION_RIGHT_PX,
          width: SCROLL_BUTTON_SIZE_PX,
          height: SCROLL_BUTTON_SIZE_PX,
          // Knappen ligger uden for arbejdsfladens zoom-rod, men svæver oven på den. Uden dette
          // bliver den stående i fuld størrelse og dominerer en nedskaleret side – den var
          // dobbelt så stor som sidens egne runde handlingsknapper ved mindste skala.
          zoom: `var(${CONTENT_SCALE_CSS_VARIABLE}, 1)`,
          // Smal viewport: ryk knappen tættere på hjørnet (matcher søster-siden minDomssamling).
          '@media (max-width: 640px)': { bottom: 16, right: 16 },
          // Bevidst: skjul knappen på touch-input. På touch-enheder er sidens indhold kort nok
          // til ét skærmbillede, så scroll-til-top er irrelevant. Dette er en input-modalitets-
          // affordance (pointer: coarse), ikke responsivt mobil-layout – mobil/tablet er i forvejen
          // hård-blokeret af device-gaten, så reglen rammer kun touch-capable desktops.
          '@media (pointer: coarse)': { display: 'none' },
          backgroundColor: 'var(--color-surface-raised)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          boxShadow: 4,
          transition: 'all 0.25s ease',
          '&:hover': {
            backgroundColor: 'var(--color-surface-raised-hover)',
            boxShadow: 8,
            transform: 'scale(1.08)',
          },
          '&:active': {
            transform: 'scale(0.95)',
          },
        }}
      >
        <Box
          component="svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
          sx={{
            width: 32,
            height: 32,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        >
          <path d="M6 15l6-6 6 6" />
        </Box>
        {/* Skærmlæser-navn uden synlig browser-tooltip: bevidst IKKE aria-label
            (som browseren render som hover-tooltip), men visuelt skjult tekst. */}
        <Box
          component="span"
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Scroll til toppen
        </Box>
      </Fab>
    </Zoom>
  );
});

ScrollToTopButton.displayName = 'ScrollToTopButton';

export default ScrollToTopButton;
