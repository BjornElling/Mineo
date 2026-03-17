import React from 'react';
import { IconButton } from '@mui/material';
import { Download } from '@mui/icons-material';

type Props = Readonly<{
  onClick: () => void;
  shake: boolean;
}>;

const EetPdfDownloadButton: React.FC<Props> = ({ onClick, shake }) => {
  return (
    <IconButton
      aria-label="Download specifikation"
      onClick={onClick}
      size="small"
      sx={{
        borderRadius: '6px',
        transition: 'background-color 0.2s',
        animation: shake ? 'shake 0.5s' : 'none',
        '&:hover': { backgroundColor: '#e3f2fd' },
        '&:active': { backgroundColor: '#bbdefb' },
        '@keyframes shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
      }}
    >
      <Download sx={{ fontSize: '24px', color: 'primary.main' }} />
    </IconButton>
  );
};

EetPdfDownloadButton.displayName = 'EetPdfDownloadButton';

export default EetPdfDownloadButton;
