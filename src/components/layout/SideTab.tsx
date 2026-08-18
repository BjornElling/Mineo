import React from 'react';
import { Box } from '@mui/material';
import { CONTENT_BOX_WIDTH_PX } from '../../utils/uiScale';
import { TAB_NAVIGATION_ATTRIBUTE } from './containerNavigation/navigationControlSemantics';

/**
 * Fanens højde. Efter `rotate(90deg)` om venstre-bund er det HØJDEN, der bliver fanens vandrette
 * udstrækning — derfor er den fastlåst her og ikke overladt til indholdet.
 */
const SIDE_TAB_HEIGHT_PX = 48;

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
    {...{ [TAB_NAVIGATION_ATTRIBUTE]: 'true' }}
    className={active ? 'tab-item side-tab active' : 'tab-item side-tab'}
    sx={{
      position: 'absolute',
      // Fanen roteres om venstre-bund og rager derfor sin egen HØJDE ud til højre for `left`.
      // Den lå før på indholdsboksens kant (1200 px) og stak dermed 48 px ud over programmets
      // bredeste element — de 48 px indgår ikke i skaleringens pladsregnskab, så ved den
      // smalleste dækkede vinduesbredde åd fanen hele højregutteren og endte 2,5 px fra
      // vindueskanten. Fanen slutter nu præcis ved boksens højrekant.
      left: `${CONTENT_BOX_WIDTH_PX - SIDE_TAB_HEIGHT_PX}px`,
      top,
      transform: 'rotate(90deg)',
      transformOrigin: 'left bottom',
      zIndex: 10,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 140,
      height: `${SIDE_TAB_HEIGHT_PX}px`,
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
