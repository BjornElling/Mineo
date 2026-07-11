import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Download } from '@mui/icons-material';

type Props = Readonly<{
  onClick?: () => void;
  disabled?: boolean;
  shake?: boolean;
  /** Tooltip-tekst; bruges også som aria-label medmindre `ariaLabel` er sat. */
  tooltip: string;
  /** Eksplicit aria-label, når den skal være mere specifik end tooltip'en (fx pr. tabelrække). */
  ariaLabel?: string;
  /** Videreført til den klikbare knap, så tests kan adressere netop denne download-knap. */
  dataTestId?: string;
}>;

/**
 * Præsentationskernen for programmets ÉNE download-ikon-affordance: en fokusérbar 32×32
 * IconButton med delt hover/active-styling, shake-feedback og format-bevidst tooltip/aria-label.
 *
 * Dette er den format-neutrale kerne. Sider i hovedappen bruger normalt
 * `DocumentDownloadButton`, der resolver formatet fra `useAppSettings`; kald denne kerne direkte,
 * når formatet injiceres udefra (fx den standalone MinProcesrente-app uden AppSettingsProvider,
 * eller en CSV-download hvor dokumentformatet er irrelevant).
 */
const DownloadIconButton = ({ onClick, disabled = false, shake = false, tooltip, ariaLabel, dataTestId }: Props) => (
  <Tooltip title={tooltip}>
    <span>
      <IconButton
        aria-label={ariaLabel ?? tooltip}
        data-testid={dataTestId}
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

DownloadIconButton.displayName = 'DownloadIconButton';

export default DownloadIconButton;
