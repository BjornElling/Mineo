import React from 'react';
import { Box } from '@mui/material';

export type SideTabProps = {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
  /**
   * Vertikal placering langs ContentBox'ens højrekant (fx `'-25px'` for den
   * øverste side-fane, `'125px'` for den næste).
   */
  readonly top: string;
};

/**
 * Roteret 90° side-fane placeret ved ContentBox'ens højrekant (EO-kontrolfaner,
 * Stamdata-testfane). Delt så den roterede blok har ét abstraktionspunkt frem
 * for at være kopieret pr. callsite (jf. `page-component-contract.md` §10.2).
 */
const SideTab = React.memo(({ label, active, onClick, top }: SideTabProps) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={active ? 'tab-item side-tab active' : 'tab-item side-tab'}
    sx={{
      position: 'absolute',
      left: '1200px',
      top,
      transform: 'rotate(90deg)',
      transformOrigin: 'left bottom',
      zIndex: 10,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 140,
      minHeight: 48,
      padding: '12px 16px',
      appearance: 'none',
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      textAlign: 'center',
      font: 'inherit',
      fontSize: '0.875rem',
      fontFamily: 'Montserrat, sans-serif',
      lineHeight: 1.25,
      letterSpacing: '0.02857em',
      '&.active': {
        borderBottom: '2px solid var(--color-primary)',
      },
    }}
  >
    {label}
  </Box>
));

SideTab.displayName = 'SideTab';

export default SideTab;
