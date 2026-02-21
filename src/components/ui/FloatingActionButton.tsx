import React from 'react';
import { Fab, Tooltip, type SxProps, type Theme } from '@mui/material';

type FloatingActionButtonProps = {
  onClick: () => void;
  icon: React.ReactNode;
  color?: 'primary' | 'error';
  disabled?: boolean;
  tooltip?: string;
  shake?: boolean;
  sx?: SxProps<Theme>;
};

/**
 * Flydende rund action-knap med tooltip og shake-effekt
 *
 * @param onClick - Callback når knappen klikkes
 * @param icon - MUI ikon der vises i knappen
 * @param color - Knappens farve (default: "primary")
 * @param disabled - Om knappen er deaktiveret
 * @param tooltip - Tooltip-tekst ved hover
 * @param shake - Om knappen skal ryste ved klik når disabled
 * @param sx - Ekstra MUI styling
 */
const FloatingActionButton = React.memo(({
  onClick,
  icon,
  color = 'primary',
  disabled = false,
  tooltip,
  shake = false,
  sx,
}: FloatingActionButtonProps) => {
  const [isShaking, setIsShaking] = React.useState(false);
  const shakeTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = React.useCallback(() => {
    if (disabled && shake) {
      setIsShaking(true);
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
      shakeTimeoutRef.current = window.setTimeout(() => {
        setIsShaking(false);
        shakeTimeoutRef.current = null;
      }, 500);
    } else if (!disabled) {
      onClick();
    }
  }, [disabled, shake, onClick]);

  const button = (
    <Fab
      color={color}
      onClick={handleClick}
      disabled={disabled && !shake}
      sx={{
        width: 56,
        height: 56,
        boxShadow: disabled ? 'none' : 6,
        transition: 'all 0.2s ease',
        backgroundColor: disabled ? 'rgba(0, 0, 0, 0.12)' : undefined,
        '&:hover': disabled ? {} : {
          boxShadow: 12,
          transform: 'scale(1.05)',
        },
        animation: isShaking ? 'shake 0.5s ease' : 'none',
        '@keyframes shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '50%': { transform: 'translateX(5px)' },
          '75%': { transform: 'translateX(-5px)' },
        },
        ...sx,
      }}
    >
      {icon}
    </Fab>
  );

  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow placement="top">
        {button}
      </Tooltip>
    );
  }

  return button;
});

FloatingActionButton.displayName = 'FloatingActionButton';

export default FloatingActionButton;
