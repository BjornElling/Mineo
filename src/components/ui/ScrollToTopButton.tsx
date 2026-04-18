import React from 'react';
import { Fab, Tooltip, Zoom } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useScrollContainer } from '../../contexts/useScrollContainer';
import {
  SCROLL_VISIBILITY_THRESHOLD_PX,
  SCROLL_BUTTON_POSITION_BOTTOM_PX,
  SCROLL_BUTTON_POSITION_RIGHT_PX,
  SCROLL_BUTTON_SIZE_PX,
} from '../../config/scrollToTopConfig';

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

    // Initial check
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
      <Tooltip title="Scroll til toppen" arrow placement="left">
        <Fab
          onClick={handleClick}
          aria-label="Scroll til toppen"
          sx={{
            position: 'fixed',
            bottom: SCROLL_BUTTON_POSITION_BOTTOM_PX,
            right: SCROLL_BUTTON_POSITION_RIGHT_PX,
            width: SCROLL_BUTTON_SIZE_PX,
            height: SCROLL_BUTTON_SIZE_PX,
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
          <KeyboardArrowUpIcon sx={{ fontSize: 32 }} />
        </Fab>
      </Tooltip>
    </Zoom>
  );
});

ScrollToTopButton.displayName = 'ScrollToTopButton';

export default ScrollToTopButton;
