import React from 'react';
import { Box } from '@mui/material';
import { CONTENT_BOX_WIDTH_PX, SIDE_TAB_OVERHANG_PX } from '../../utils/uiScale';
import { TAB_NAVIGATION_ATTRIBUTE } from './containerNavigation/navigationControlSemantics';

/**
 * Fanens højde. Efter `rotate(90deg)` om venstre-bund er det HØJDEN, der bliver fanens vandrette
 * udstrækning – den er derfor det samme tal som fanens udhæng til højre for indholdsboksen, og
 * den er fastlåst her og ikke overladt til indholdet. 48 px er MUI's egen fanehøjde
 * (`Tabs`/`Tab` minHeight), så en side-fane er præcis så tyk som en vandret fane er høj.
 */
const SIDE_TAB_HEIGHT_PX = SIDE_TAB_OVERHANG_PX;

/**
 * Fanens længde langs indholdsboksens kant. Samme tal som `PageTabs`' `minTabWidth`-default, så de
 * to fanefamilier har samme etiketbredde at arbejde i.
 */
const SIDE_TAB_LENGTH_PX = 140;

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
 * Roteret 90° side-fane placeret UDEN FOR ContentBox'ens højrekant (EO-kontrolfaner). Delt så den
 * roterede blok har ét abstraktionspunkt frem for at være kopieret pr. callsite (jf.
 * `page-component-contract.md` §10.2).
 *
 * **Placeringen.** `left` er indholdsboksens højrekant, og fanen rager sin egen højde ud til højre
 * for den. Udhænget er den ene bevidste undtagelse fra skaleringens pladsregnskab
 * (`SIDE_TAB_OVERHANG_PX`): fanerne må ikke kunne skrumpe hele arbejdsfladen. `SideTabRail` klipper
 * udhænget ved arbejdsfladens synlige højrekant, så det hverken giver vandret rul eller flytter
 * noget. En fane, der ikke kan være der, forsvinder altså tavst ud over kanten.
 *
 * **Formateringen ejes af CSS, ikke af `sx`.** Etiketten skal have PRÆCIS samme typografi som de
 * vandrette faners, og den fælles `.tab-item`-regel i `typography.css` er det ene sted, de to
 * familier henter den fra – farve (også i dark mode), størrelse, vægt, spatiering og
 * hover/aktiv-tilstand. Den blå streg er `.side-tab::after`: efter rotationen vender fanens bund ind
 * mod indholdsboksen, så stregen lander præcis på boksens højrekant – samme rolle OG samme
 * mekanisme som `MuiTabs-indicator` under en vandret fane. `sx` herunder må derfor kun bære
 * GEOMETRI. Sætter man typografi eller `border` her, vinder emotion over klassen, og fanerne drifter
 * fra de øvrige igen (senest: `color: inherit` gjorde dem usynlige i dark mode, og `border: none`
 * slettede den blå streg).
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
      left: `${CONTENT_BOX_WIDTH_PX}px`,
      top,
      transform: 'rotate(90deg)',
      transformOrigin: 'left bottom',
      zIndex: 10,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: SIDE_TAB_LENGTH_PX,
      height: `${SIDE_TAB_HEIGHT_PX}px`,
      // Samme indre luft som MUI's `Tab`, så etiketten står ens i de to fanefamilier.
      padding: '12px 16px',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </Box>
));

SideTab.displayName = 'SideTab';

export default SideTab;
