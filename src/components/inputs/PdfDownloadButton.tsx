import React from 'react';
import { IconButton } from '@mui/material';
import { Download } from '@mui/icons-material';

type Props = Readonly<{
  onClick?: () => void;
  shake?: boolean;
  disabled?: boolean;
}>;

const PdfDownloadButton = ({ onClick, shake = false, disabled = false }: Props) => {
  return (
    <IconButton
      aria-label="Download specifikation"
      onClick={onClick}
      size="small"
      disabled={disabled}
      sx={{
        borderRadius: '6px',
        transition: 'background-color 0.2s',
        animation: shake ? 'shake 0.5s' : 'none',
        '&:hover': disabled ? {} : { backgroundColor: 'var(--color-icon-action-hover)' },
        '&:active': disabled ? {} : { backgroundColor: 'var(--color-icon-action-active)' },
        '@keyframes shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
      }}
    >
      <Download sx={{ fontSize: '24px', color: disabled ? 'text.disabled' : 'primary.main' }} />
    </IconButton>
  );
};

PdfDownloadButton.displayName = 'PdfDownloadButton';

export default PdfDownloadButton;
