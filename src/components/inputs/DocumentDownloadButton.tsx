import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Download } from '@mui/icons-material';
import { useAppSettings } from '../../contexts/useAppSettings';
import { getDocumentFormatLabel } from '../../document/documentFormat';

type Props = Readonly<{
  onClick?: () => void;
  shake?: boolean;
  disabled?: boolean;
}>;

const DocumentDownloadButton = ({ onClick, shake = false, disabled = false }: Props) => {
  const { settings } = useAppSettings();
  const tooltip = `Download som ${getDocumentFormatLabel(settings.documentDownloadFormat)}`;

  return (
    <Tooltip title={tooltip}>
      <span>
        <IconButton
          aria-label={tooltip}
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
      </span>
    </Tooltip>
  );
};

DocumentDownloadButton.displayName = 'DocumentDownloadButton';

export default DocumentDownloadButton;
