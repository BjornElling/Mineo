import * as React from 'react';
import { Button } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../utils/mergeSx';

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
      sx={mergeSx({
        minWidth: '88px',
        height: '40px',
        borderRadius: '10px',
        px: 2,
        fontFamily: '"Montserrat", sans-serif',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        background: 'var(--color-input-bg)',
        borderColor: 'var(--color-input-border)',
        boxShadow: 'none',
        '&:hover': {
          background: 'var(--color-input-bg)',
          borderColor: 'var(--color-input-border-hover)',
          color: 'var(--color-input-border-focus)',
          boxShadow: 'none',
        },
        '&[aria-disabled="true"]': {
          color: 'var(--color-icon-muted)',
          background: 'var(--color-input-bg)',
          borderColor: 'var(--color-input-border)',
          cursor: 'default',
          pointerEvents: 'none',
        },
      }, sx)}
    >
      {children}
    </Button>
  );
});

InlineActionButton.displayName = 'InlineActionButton';

export default InlineActionButton;
