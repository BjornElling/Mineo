import React from 'react';
import { Fab, Tooltip, Zoom } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

/**
 * Flydende scroll-til-top knap der vises når brugeren har scrollet ned
 *
 * Knappen vises som et overlay nederst til højre og scroller smootht til toppen
 * når den klikkes. Den bruger en afdæmpet semitransparent farve for ikke at
 * dominere UI'et, men har en tydelig hover-effekt.
 */
const ScrollToTopButton: React.FC = React.memo(() => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const scrollContainer = document.querySelector('[data-mineo-scroll-container="true"]');
    if (!scrollContainer) return;

    const handleScroll = () => {
      // Vis knappen når brugeren har scrollet mere end 200px ned
      const shouldShow = scrollContainer.scrollTop > 200;
      setVisible(shouldShow);
    };

    // Initial check
    handleScroll();

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleClick = React.useCallback(() => {
    const scrollContainer = document.querySelector('[data-mineo-scroll-container="true"]');
    if (!scrollContainer) return;

    scrollContainer.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, []);

  return (
    <Zoom in={visible}>
      <Tooltip title="Scroll til toppen" arrow placement="left">
        <Fab
          onClick={handleClick}
          aria-label="Scroll til toppen"
          sx={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            width: 56,
            height: 56,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            color: 'white',
            boxShadow: 4,
            transition: 'all 0.25s ease',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
