import React, { useState } from 'react';
import { Box, Button, Divider, Tooltip } from '@mui/material';
import {
  Menu as MenuIcon,
  BrowserUpdated,
  Save,
  DeleteForever,
} from '@mui/icons-material';
import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import type { MenuPageKey } from '../../config/pageNavigation';
import { navigationItems, utilityItems } from './sideMenuItems';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../../utils/safeSessionStorage';
import {
  CONTENT_SCALE_CSS_VARIABLE,
  getSideMenuIconLayout,
  getSideMenuWidth,
  resolveSideMenuScale,
  SIDE_MENU_LAYOUT_POLICY,
} from '../../utils/uiScale';

type FileOperationItem = {
  id: string;
  label: string;
  icon: React.ReactElement;
  action: () => void;
  /**
   * Ref til knappen, når handlingens bekræftelsesdialog skal føre fokus tilbage hertil. Nødvendig,
   * fordi `handleMenuButtonMouseDown` kalder `preventDefault()`: knappen bliver derfor aldrig
   * `activeElement`, og dialogen har intet fokus at huske (`keyboard-navigation.md`
   * §Popup-fokus-restore).
   */
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
};

// Menu-dimensioner
const MENU_STATE_STORAGE_KEY = UI_STORAGE_KEYS.sideMenuExpanded;

const readStoredMenuState = (): string | null => {
  return readOptionalSessionStorageValue(MENU_STATE_STORAGE_KEY);
};

const persistMenuState = (isExpanded: boolean): void => {
  writeOptionalSessionStorageValue(MENU_STATE_STORAGE_KEY, isExpanded ? 'true' : 'false');
};

/**
 * Alle sidemenuens ikoner deler samme akse og ikonflade.
 *
 * Målene er menuens EGNE (zoomede) px: hele menuen – ramme såvel som indhold – skaleres med
 * samme faktor, så ingen af værdierne her skal kende skalaen.
 */
const ICON_LAYOUT = getSideMenuIconLayout();

const getSideMenuIconButtonSx = (
  isExpanded: boolean,
  hasLabel: boolean,
  isSquareWhenExpanded = false,
) => ({
  textTransform: 'none',
  justifyContent: isExpanded && !isSquareWhenExpanded ? 'flex-start' : 'center',
  // MUI-knapper er som udgangspunkt inline-flex. Den kollapsede variant skal være en stabil
  // enkelt række, mens menuens bredde animerer.
  display: 'flex',
  width: isExpanded && !isSquareWhenExpanded ? '100%' : `${SIDE_MENU_LAYOUT_POLICY.buttonSizePx}px`,
  pl: isExpanded && !isSquareWhenExpanded ? `${ICON_LAYOUT.expandedButtonPaddingLeftPx}px` : 0,
  pr: isExpanded && !isSquareWhenExpanded ? 1.5 : 0,
  ml: isExpanded && isSquareWhenExpanded
    ? `${ICON_LAYOUT.expandedSquareButtonMarginLeftPx}px`
    : 0,
  minWidth: 0,
  height: `${SIDE_MENU_LAYOUT_POLICY.buttonSizePx}px`,
  borderRadius: '12px',
  '& .MuiButton-startIcon': {
    margin: isExpanded && hasLabel ? '0 12px 0 0' : '0',
    minWidth: `${SIDE_MENU_LAYOUT_POLICY.iconSlotSizePx}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'currentColor',
  },
});

/**
 * Sammenfoldelig sidemenu med navigation
 *
 * Features:
 * - Sammenfoldet (70 px) / udfoldet (250 px) – begge gange menuens skala
 * - Active state på navigationssider
 * - Separator-linjer mellem grupper
 * - Luftig desktopprofil uden scrollbar; skalaen er den mindste af arbejdsfladens skala og
 *   menuens egen højdetilpasning, så menuen aldrig står med større tekst end indholdet
 * - Moderne, blød styling med rundede hjørner
 * - Fast ikonakse i begge menutilstande
 */
interface SideMenuProps {
  activePage: string;
  onPageChange: (pageId: MenuPageKey) => void | Promise<void>;
  onGem: () => void;
  onHent: () => void;
  onSletAlt: () => void;
  /** Restore-mål for `Slet alt`-bekræftelsen – se `FileOperationItem.buttonRef`. */
  sletAltButtonRef: React.RefObject<HTMLButtonElement | null>;
  /**
   * Arbejdsfladens skala. Menuen bliver aldrig større end den: en menu med fuld tekststørrelse
   * ved siden af en nedskaleret arbejdsflade er den mest iøjnefaldende typografiske uensartethed,
   * fladen kan have. Menuen kan derimod godt blive MINDRE, når vinduets højde kræver det.
   */
  contentScale: number;
}

const SideMenu = React.memo(({
  activePage,
  onPageChange,
  onGem,
  onHent,
  onSletAlt,
  sletAltButtonRef,
  contentScale,
}: SideMenuProps) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    const storedValue = readStoredMenuState();
    return storedValue === null ? true : storedValue === 'true';
  });
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuContentRef = React.useRef<HTMLDivElement | null>(null);
  // Den skala, indholdet FAKTISK er tegnet med. Målingen nedenfor skal kunne regne den visuelle
  // rect om til menuens naturlige højde, og den kan kun gøres med den anvendte skala.
  const appliedScaleRef = React.useRef(1);
  const [heightFitScale, setHeightFitScale] = useState(1);
  const menuScale = resolveSideMenuScale(contentScale, heightFitScale);

  React.useLayoutEffect(() => {
    appliedScaleRef.current = menuScale;
  }, [menuScale]);

  React.useLayoutEffect(() => {
    let animationFrame: number | null = null;

    const updateHeightFitScale = () => {
      const menu = menuRef.current;
      const content = menuContentRef.current;
      if (menu === null || content === null || menu.clientHeight <= 0) return;

      const contentHeight = content.getBoundingClientRect().height;
      if (contentHeight <= 0) return;

      // Genskab den luftige desktopmenu og skaler kun på højden, når den reelt ikke kan rumme
      // indholdet. Dividering med den anvendte zoom er nødvendig: rect'en er visuel størrelse,
      // mens den nødvendige højde skal sammenlignes med menuens uskalerede tilgængelige højde.
      const naturalContentHeight = contentHeight / appliedScaleRef.current;
      const nextHeightFit = Math.max(
        SIDE_MENU_LAYOUT_POLICY.minimumHeightFitScale,
        Math.min(1, menu.clientHeight / naturalContentHeight),
      );

      setHeightFitScale((previous) => (
        Math.abs(nextHeightFit - previous) < 0.001 ? previous : nextHeightFit
      ));
    };

    const scheduleScaleUpdate = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updateHeightFitScale();
      });
    };

    scheduleScaleUpdate();
    window.addEventListener('resize', scheduleScaleUpdate);
    return () => {
      window.removeEventListener('resize', scheduleScaleUpdate);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
    // Ind-/udfoldning ændrer indholdets naturlige højde (labels forsvinder), og arbejdsfladens
    // skala ændrer den tegnede højde. Begge skal udløse en ny måling – ellers bliver menuen
    // stående på et højdeloft, der hørte til en anden tilstand.
  }, [isExpanded, contentScale]);

  // Fil-operationer (inkluderer callbacks, så skal forblive inde i komponenten)
  const fileOperations = React.useMemo((): FileOperationItem[] => [
    { id: 'gem', label: 'Gem', icon: <Save />, action: onGem },
    { id: 'hent', label: 'Hent', icon: <BrowserUpdated />, action: onHent },
    { id: 'slet-alt', label: 'Slet\u00A0alt', icon: <DeleteForever />, action: onSletAlt, buttonRef: sletAltButtonRef }
  ], [onGem, onHent, onSletAlt, sletAltButtonRef]);

  const toggleMenu = React.useCallback(() => {
    setIsExpanded(prev => {
      const nextValue = !prev;
      persistMenuState(nextValue);
      return nextValue;
    });
  }, []);

  const handleNavigation = React.useCallback((pageId: MenuPageKey) => {
    onPageChange(pageId);
  }, [onPageChange]);

  const handleFileOperation = React.useCallback((operation: FileOperationItem) => {
    operation.action();
  }, []);

  const handleMenuButtonMouseDown = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    // Bevar det aktuelle felt-/celle-fokus når menu-handlinger udløses ved pointer-klik.
    // MainLayout udfører det autoritative commit-/navigations-flow eksplicit ved klik.
    event.preventDefault();
  }, []);

  /**
   * Menuens tooltips skal have MENUENS skala, ikke arbejdsfladens.
   *
   * Temaets `MuiTooltip`-regel zoomer enhver tooltip med `--mineo-content-scale`, fordi langt de
   * fleste hører til arbejdsfladen. Menuens tre tooltips hører til menuen, som kan stå på en anden
   * (mindre) skala i et lavt vindue. Variablen sættes derfor om på selve popper-elementet, så
   * arven inde i portalen giver den rigtige værdi.
   */
  const menuTooltipSlotProps = React.useMemo(() => ({
    popper: { sx: { [CONTENT_SCALE_CSS_VARIABLE]: String(menuScale) } },
  }), [menuScale]);

  return (
    <Box
      ref={menuRef}
      sx={{
        // Rammen skaleres i takt med sit indhold, så menuens indbyrdes forhold – labelstørrelse,
        // ikonakse og luft – er konstante ved enhver skala. Bredden er derfor grundmålet gange
        // menuskalaen, ikke en selvstændig interpolation.
        width: getSideMenuWidth(menuScale, isExpanded),
        minWidth: getSideMenuWidth(menuScale, isExpanded),
        maxWidth: getSideMenuWidth(menuScale, isExpanded),
        flexShrink: 0,
        height: '100vh',
        backgroundColor: 'var(--color-surface)',
        // Skillelinjen skaleres med menuen. En fast 1 px-linje inde i en `border-box`-bredde ville
        // gøre ikonkolonnens midte skala-afhængig, så et udfoldet og et kollapset ikon lå en
        // brøkdel af en pixel fra hinanden ved delvis skala. Med en skaleret linje er `(70-1)/2`
        // menuens midterakse ved enhver skala.
        borderRight: `${SIDE_MENU_LAYOUT_POLICY.borderWidthPx * menuScale}px solid var(--color-surface-border)`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
      }}
    >
      <Box
        ref={menuContentRef}
        data-mineo-menu-content-scale-root="true"
        sx={{
          flexShrink: 0,
          minWidth: '100%',
          width: '100%',
          overflow: 'visible',
          zoom: menuScale,
        }}
      >
      {/* Hamburger toggle button */}
      <Box
        sx={{
          height: '64px',
          boxSizing: 'border-box',
          px: isExpanded ? 1.5 : 0,
          flexShrink: 0,
          display: 'flex',
          justifyContent: isExpanded ? 'flex-start' : 'center',
          alignItems: 'center',
        }}
      >
        <Button
          onClick={toggleMenu}
          startIcon={<MenuIcon />}
          // Knappen har kun et ikon som indhold og ville ellers stå navnløs i accessibility-træet.
          // Navnet beskriver HANDLINGEN og følger derfor menuens aktuelle tilstand.
          aria-label={isExpanded ? 'Fold menuen sammen' : 'Fold menuen ud'}
          aria-expanded={isExpanded}
          className="menu-item"
          sx={{
            ...getSideMenuIconButtonSx(isExpanded, false, true),
            py: 0,
            mb: 0,
          }}
        >
          {/* Ingen tekst */}
        </Button>
      </Box>

        <Divider
          sx={{
            borderColor: 'var(--color-surface-border)',
            mx: isExpanded ? 4 : 3,
          }}
        />

        {/* Hovednavigation */}
        <Box sx={{ py: 1, px: isExpanded ? 1.5 : 0, display: 'flex', flexDirection: 'column', alignItems: isExpanded ? 'stretch' : 'center' }}>
          {navigationItems.map((item) => (
            <Tooltip
              key={item.id}
              title={item.label}
              arrow
              placement="right"
              disableHoverListener={isExpanded}
              disableFocusListener={isExpanded}
              disableTouchListener={isExpanded}
              slotProps={menuTooltipSlotProps}
            >
              <Button
                fullWidth
                onClick={() => handleNavigation(item.id)}
                onMouseDown={handleMenuButtonMouseDown}
                startIcon={item.icon}
                // Tekstbarnet forsvinder, når menuen er kollapset (`{isExpanded && item.label}`), og
                // knappen ville da stå navnløs med kun sit ikon. Tooltippen navngiver den ikke: MUI
                // sætter aria-labelledby på popper'en, som kun findes mens tooltippen er åben.
                // Et fast aria-label giver samme navn i begge menutilstande.
                aria-label={item.label}
                aria-current={activePage === item.id ? 'page' : undefined}
                className={activePage === item.id ? 'menu-item active' : 'menu-item'}
                sx={{
                  ...getSideMenuIconButtonSx(isExpanded, true),
                  // Ved mindste labelskala mangler den længste label ellers få synlige px i
                  // Firefox. Fire px mindre højre-padding bevarer ikonaksen og giver teksten
                  // den nødvendige plads uden at udvide sidemenuen.
                  py: 1.2,
                  mb: 0.5,
                  whiteSpace: item.id === 'varigemen' ? 'nowrap' : undefined,
                }}
              >
                {isExpanded && item.label}
              </Button>
            </Tooltip>
          ))}
        </Box>

        <Divider
          sx={{
            borderColor: 'var(--color-surface-border)',
            my: 1,
            mx: isExpanded ? 4 : 3,
          }}
        />

        {/* Fil-operationer */}
        <Box sx={{ py: 1, px: isExpanded ? 1.5 : 0, display: 'flex', flexDirection: 'column', alignItems: isExpanded ? 'stretch' : 'center' }}>
          {fileOperations.map((item) => (
            <Tooltip
              key={item.id}
              title={item.label}
              arrow
              placement="right"
              disableHoverListener={isExpanded}
              disableFocusListener={isExpanded}
              disableTouchListener={isExpanded}
              slotProps={menuTooltipSlotProps}
            >
              <Button
                fullWidth
                ref={item.buttonRef}
                onClick={() => handleFileOperation(item)}
                onMouseDown={handleMenuButtonMouseDown}
                startIcon={item.icon}
                // Tekstbarnet forsvinder, når menuen er kollapset (`{isExpanded && item.label}`), og
                // knappen ville da stå navnløs med kun sit ikon. Tooltippen navngiver den ikke: MUI
                // sætter aria-labelledby på popper'en, som kun findes mens tooltippen er åben.
                // Et fast aria-label giver samme navn i begge menutilstande.
                aria-label={item.label}
                className="menu-item"
                sx={{
                  ...getSideMenuIconButtonSx(isExpanded, true),
                  py: 1.2,
                  mb: 0.5,
                }}
              >
                {isExpanded && item.label}
              </Button>
            </Tooltip>
          ))}
        </Box>

        <Divider
          sx={{
            borderColor: 'var(--color-surface-border)',
            my: 1,
            mx: isExpanded ? 4 : 3,
          }}
        />

        {/* Utilities */}
        <Box sx={{ py: 1, px: isExpanded ? 1.5 : 0, display: 'flex', flexDirection: 'column', alignItems: isExpanded ? 'stretch' : 'center' }}>
          {utilityItems.map((item) => (
            <Tooltip
              key={item.id}
              title={item.label}
              arrow
              placement="right"
              disableHoverListener={isExpanded}
              disableFocusListener={isExpanded}
              disableTouchListener={isExpanded}
              slotProps={menuTooltipSlotProps}
            >
              <Button
                fullWidth
                onClick={() => handleNavigation(item.id)}
                onMouseDown={handleMenuButtonMouseDown}
                startIcon={item.icon}
                // Tekstbarnet forsvinder, når menuen er kollapset (`{isExpanded && item.label}`), og
                // knappen ville da stå navnløs med kun sit ikon. Tooltippen navngiver den ikke: MUI
                // sætter aria-labelledby på popper'en, som kun findes mens tooltippen er åben.
                // Et fast aria-label giver samme navn i begge menutilstande.
                aria-label={item.label}
                aria-current={activePage === item.id ? 'page' : undefined}
                className={activePage === item.id ? 'menu-item active' : 'menu-item'}
                sx={{
                  ...getSideMenuIconButtonSx(isExpanded, true),
                  py: 1.2,
                  mb: 0.5,
                }}
              >
                {isExpanded && item.label}
              </Button>
            </Tooltip>
          ))}
        </Box>
      </Box>
    </Box>
  );
});

SideMenu.displayName = 'SideMenu';

export default SideMenu;
