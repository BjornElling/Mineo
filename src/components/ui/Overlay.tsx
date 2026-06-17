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
type OverlayType = 'success' | 'error' | 'warning' | 'info';

type OverlayProps = {
  message: string;
  type?: OverlayType;
  onClose?: () => void;
};

const Overlay = React.memo(({ message, type = 'success', onClose }: OverlayProps) => {
  const [visible, setVisible] = React.useState(true);
  const [fadeOut, setFadeOut] = React.useState(false);

  // Bestem varighed baseret på overlay-type
  const getDuration = () => {
    switch (type) {
      case 'error':
        return null; // Ingen auto-close
      case 'success':
        return 3000;
      case 'warning':
        return 5000;
      case 'info':
        return 4000;
      default:
        return 3000;
    }
  };

  const duration = getDuration();

  // `onClose` holdes i en ref, så auto-close-effekten kun afhænger af `duration`.
  // Ellers ville en ny inline-`onClose` fra forælderen ved hver re-render genstarte
  // nedtællingen, så et 3 s success-overlay kunne hænge fast (rapporteret problem).
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    // Hvis duration er null (error-type), luk ikke automatisk
    if (duration === null) {
      return;
    }

    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, duration - 500);

    const closeTimer = setTimeout(() => {
      setVisible(false);
      onCloseRef.current?.();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [duration]);

  if (!visible) {
    return null;
  }

  // Bestem farver baseret på type
  const colors = {
    success: {
      bg: 'var(--color-overlay-bg)',
      border: 'var(--color-status-success)',
      text: 'var(--color-status-success)',
    },
    error: {
      bg: 'var(--color-overlay-bg)',
      border: 'var(--color-status-error)',
      text: 'var(--color-status-error)',
    },
    warning: {
      bg: 'var(--color-overlay-bg)',
      border: 'var(--color-status-warning)',
      text: 'var(--color-status-warning)',
    },
    info: {
      bg: 'var(--color-overlay-bg)',
      border: 'var(--color-status-info)',
      text: 'var(--color-status-info)',
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
        cursor: type === 'error' ? 'pointer' : 'default',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={type === 'error' ? () => {
        setFadeOut(true);
        setTimeout(() => {
          setVisible(false);
          onCloseRef.current?.();
        }, 300);
      } : undefined}
      title={type === 'error' ? 'Klik for at lukke' : undefined}
    >
      <Typography
        variant="text"
        sx={{
          color: colorScheme.text,
          fontWeight: 600,
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
