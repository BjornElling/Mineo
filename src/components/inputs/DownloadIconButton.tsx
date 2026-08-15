import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Download } from '@mui/icons-material';

type Props = Readonly<{
  onClick?: () => void;
  disabled?: boolean;
  /** Tooltip-tekst; bruges også som aria-label medmindre `ariaLabel` er sat. */
  tooltip: string;
  /** Eksplicit aria-label, når den skal være mere specifik end tooltip'en (fx pr. tabelrække). */
  ariaLabel?: string;
  /** Videreført til den klikbare knap, så tests kan adressere netop denne download-knap. */
  dataTestId?: string;
}>;

/**
 * Præsentationskernen for programmets ÉNE download-ikon-affordance: en fokusérbar 32×32
 * IconButton med delt hover/active-styling og format-bevidst tooltip/aria-label.
 *
 * Dette er den format-neutrale kerne. Sider i hovedappen bruger normalt
 * `DocumentDownloadButton`, der resolver formatet fra `useAppSettings`; kald denne kerne direkte,
 * når formatet injiceres udefra (fx den standalone MinProcesrente-app uden AppSettingsProvider,
 * eller en CSV-download hvor dokumentformatet er irrelevant).
 *
 * **Ingen shake.** Knappen havde tidligere en `shake`-prop, der rystede den ved en blokeret
 * aktivering. Rystelsen er fjernet i hele programmet (brugerbeslutning 2026-08-15), så der er
 * ÉN afvisningsmåde: knappen er synligt inaktiv med årsagen i tooltippet. Fokusspringet til det
 * blokerende felt er bevaret — det er den del af den gamle feedback, der faktisk pegede brugeren
 * et sted hen. Genindfør ikke en shake-prop her.
 */
const DownloadIconButton = ({ onClick, disabled = false, tooltip, ariaLabel, dataTestId }: Props) => (
  <Tooltip title={tooltip}>
    <span>
      <IconButton
        type="button"
        aria-label={ariaLabel ?? tooltip}
        data-mineo-focusable-button="true"
        data-testid={dataTestId}
        onClick={onClick}
        size="small"
        disabled={disabled}
        sx={{
          borderRadius: '6px',
          transition: 'background-color 0.2s',
          '&:hover': disabled ? {} : { backgroundColor: 'var(--color-icon-action-hover)' },
          '&:active': disabled ? {} : { backgroundColor: 'var(--color-icon-action-active)' },
        }}
      >
        <Download sx={{ fontSize: '24px', color: disabled ? 'text.disabled' : 'primary.main' }} />
      </IconButton>
    </span>
  </Tooltip>
);

DownloadIconButton.displayName = 'DownloadIconButton';

export default DownloadIconButton;
