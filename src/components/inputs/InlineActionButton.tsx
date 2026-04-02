import * as React from 'react';
import { Button } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

type InlineActionButtonProps = Readonly<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tabIndex?: number;
  sx?: SxProps<Theme>;
}>;

const InlineActionButton = React.memo(({ children, onClick, disabled = false, tabIndex = 0, sx }: InlineActionButtonProps) => {
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onClick();
  }, [disabled, onClick]);

  return (
    <Button
      type="button"
      variant="outlined"
      size="small"
      data-mineo-focusable-button="true"
      aria-disabled={disabled ? 'true' : undefined}
      tabIndex={tabIndex}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      sx={{
        minWidth: '88px',
        height: '40px',
        borderRadius: '10px',
        px: 2,
        fontFamily: '"Montserrat", sans-serif',
        fontWeight: 600,
        color: '#2f6fb3',
        backgroundColor: '#f4f8fd',
        borderColor: '#b9d0ea',
        boxShadow: 'none',
        '&:hover': {
          backgroundColor: '#dbeaf9',
          borderColor: '#8fb4de',
          boxShadow: 'none',
        },
        '&[aria-disabled="true"]': {
          color: 'rgba(0, 0, 0, 0.38)',
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          borderColor: 'rgba(0, 0, 0, 0.12)',
          cursor: 'default',
          pointerEvents: 'none',
        },
        ...sx,
      }}
    >
      {children}
    </Button>
  );
});

InlineActionButton.displayName = 'InlineActionButton';

export default InlineActionButton;
