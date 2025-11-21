import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Overlay-komponent til at vise midlertidige beskeder.
 * Vises øverst til højre og forsvinder automatisk efter 3 sekunder.
 *
 * @param {Object} props
 * @param {string} props.message - Besked der skal vises
 * @param {string} props.type - Type: 'success', 'error', 'warning', 'info'
 * @param {function} props.onClose - Callback når overlay lukkes
 */
const Overlay = React.memo(({ message, type = 'success', onClose }) => {
  const [visible, setVisible] = React.useState(true);
  const [fadeOut, setFadeOut] = React.useState(false);

  React.useEffect(() => {
    // Start fade-out efter 2.5 sekunder
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2500);

    // Fjern overlay efter 3 sekunder
    const closeTimer = setTimeout(() => {
      setVisible(false);
      if (onClose) {
        onClose();
      }
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [onClose]);

  if (!visible) {
    return null;
  }

  // Bestem farver baseret på type
  const colors = {
    success: {
      bg: 'rgba(255, 255, 255, 0.95)',
      border: '#10B981',
      text: '#10B981',
    },
    error: {
      bg: 'rgba(255, 255, 255, 0.95)',
      border: '#EF4444',
      text: '#EF4444',
    },
    warning: {
      bg: 'rgba(255, 255, 255, 0.95)',
      border: '#F59E0B',
      text: '#F59E0B',
    },
    info: {
      bg: 'rgba(255, 255, 255, 0.95)',
      border: '#3B82F6',
      text: '#3B82F6',
    },
  };

  const colorScheme = colors[type] || colors.success;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        backgroundColor: colorScheme.bg,
        border: `2px solid ${colorScheme.border}`,
        borderRadius: '10px',
        padding: '12px 20px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: '150px',
        maxWidth: '400px',
        opacity: fadeOut ? 0 : 1,
        transform: fadeOut ? 'translateY(-10px)' : 'translateY(0)',
        transition: 'all 0.3s ease-out',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      <Typography
        sx={{
          color: colorScheme.text,
          fontWeight: 600,
          fontSize: '15px',
          textAlign: 'center',
          margin: 0,
          whiteSpace: 'pre-line', // Tillad line breaks i beskeder
        }}
      >
        {message}
      </Typography>
    </Box>
  );
});

Overlay.displayName = 'Overlay';

export default Overlay;
