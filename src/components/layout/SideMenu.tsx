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
  getCollapsedSideMenuIconLayout,
  getExpandedSideMenuWidth,
  SIDE_MENU_COLLAPSED_ICON_POLICY,
  SIDE_MENU_SCALE_POLICY,
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

type CollapsedIconLayout = ReturnType<typeof getCollapsedSideMenuIconLayout>;

/** Alle sidemenuens ikoner deler samme akse, ikonflade og skaleringsrod. */
const getSideMenuIconButtonSx = (
  isExpanded: boolean,
  collapsedIconLayout: CollapsedIconLayout,
  hasLabel: boolean,
  isSquareWhenExpanded = false,
) => ({
  textTransform: 'none',
  justifyContent: isExpanded && !isSquareWhenExpanded ? 'flex-start' : 'center',
  // MUI-knapper er som udgangspunkt inline-flex. Den kollapsede variant skal være en stabil
  // enkelt række, mens menuens bredde animerer.
  display: 'flex',
  width: isExpanded && !isSquareWhenExpanded ? '100%' : '44px',
  pl: isExpanded && !isSquareWhenExpanded ? `${collapsedIconLayout.expandedButtonPaddingLeftPx}px` : 0,
  pr: isExpanded && !isSquareWhenExpanded ? 1.5 : 0,
  ml: isExpanded && isSquareWhenExpanded
    ? `${collapsedIconLayout.expandedSquareButtonMarginLeftPx}px`
    : 0,
  minWidth: 0,
  height: '44px',
  borderRadius: '12px',
  '& .MuiButton-startIcon': {
    margin: isExpanded && hasLabel ? '0 12px 0 0' : '0',
    minWidth: `${SIDE_MENU_COLLAPSED_ICON_POLICY.iconSlotSizePx}px`,
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
 * - Collapsed (70px) / Expanded (250px)
 * - Active state på navigationssider
 * - Separator-linjer mellem grupper
 * - Luftig desktopprofil med højdeafhængig skalering uden scrollbar
 * - Moderne, blød styling med rundede hjørner
 * - Fast ikon-placering og knaphøjde
 */
interface SideMenuProps {
  activePage: string;
  onPageChange: (pageId: MenuPageKey) => void | Promise<void>;
  onGem: () => void;
  onHent: () => void;
  onSletAlt: () => void;
  /** Restore-mål for `Slet alt`-bekræftelsen — se `FileOperationItem.buttonRef`. */
  sletAltButtonRef: React.RefObject<HTMLButtonElement | null>;
  /** Samme lodrette labelskala reducerer indholdets venstregutter i `MainLayout`. */
  onContentScaleChange?: (scale: number) => void;
}

const SideMenu = React.memo(({
  activePage,
  onPageChange,
  onGem,
  onHent,
  onSletAlt,
  sletAltButtonRef,
  onContentScaleChange,
}: SideMenuProps) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    const storedValue = readStoredMenuState();
    return storedValue === null ? true : storedValue === 'true';
  });
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuContentRef = React.useRef<HTMLDivElement | null>(null);
  const menuContentScaleRef = React.useRef(1);
  const [menuContentScale, setMenuContentScale] = useState(1);
  const collapsedIconLayout = getCollapsedSideMenuIconLayout(menuContentScale);

  React.useLayoutEffect(() => {
    onContentScaleChange?.(menuContentScale);
  }, [menuContentScale, onContentScaleChange]);

  React.useLayoutEffect(() => {
    let animationFrame: number | null = null;

    const updateMenuContentScale = () => {
      const menu = menuRef.current;
      const content = menuContentRef.current;
      if (menu === null || content === null || menu.clientHeight <= 0) return;

      const contentHeight = content.getBoundingClientRect().height;
      if (contentHeight <= 0) return;

      // Genskab den luftige desktopmenu og skaler kun, når højden reelt ikke kan rumme den.
      // Dividering med den aktuelle zoom er nødvendig: rect'en er visuel størrelse, mens den
      // nødvendige højde skal sammenlignes med menuens uscalerede tilgængelige højde.
      const naturalContentHeight = contentHeight / menuContentScaleRef.current;
      const availableContentHeight = menu.clientHeight;
      const nextScale = Math.max(
        SIDE_MENU_SCALE_POLICY.minimumContentScale,
        Math.min(1, availableContentHeight / naturalContentHeight),
      );

      if (Math.abs(nextScale - menuContentScaleRef.current) < 0.001) return;

      menuContentScaleRef.current = nextScale;
      setMenuContentScale(nextScale);
    };

    const scheduleScaleUpdate = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updateMenuContentScale();
      });
    };

    scheduleScaleUpdate();
    window.addEventListener('resize', scheduleScaleUpdate);
    return () => {
      window.removeEventListener('resize', scheduleScaleUpdate);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

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

  return (
    <Box
      ref={menuRef}
      sx={{
        width: isExpanded ? getExpandedSideMenuWidth(menuContentScale) : SIDE_MENU_COLLAPSED_ICON_POLICY.sidebarWidthPx,
        // Den zoom-kompenserede indholdsrod må ikke få flex-layoutet til at udvide den faste,
        // kollapsede ikonramme. Kun ikonernes indre placering ændres med skalaen.
        minWidth: isExpanded ? getExpandedSideMenuWidth(menuContentScale) : SIDE_MENU_COLLAPSED_ICON_POLICY.sidebarWidthPx,
        maxWidth: isExpanded ? getExpandedSideMenuWidth(menuContentScale) : SIDE_MENU_COLLAPSED_ICON_POLICY.sidebarWidthPx,
        flexShrink: 0,
        height: '100vh',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-surface-border)',
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
          zoom: menuContentScale,
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
            ...getSideMenuIconButtonSx(isExpanded, collapsedIconLayout, false, true),
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
                  ...getSideMenuIconButtonSx(isExpanded, collapsedIconLayout, true),
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
                  ...getSideMenuIconButtonSx(isExpanded, collapsedIconLayout, true),
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
                  ...getSideMenuIconButtonSx(isExpanded, collapsedIconLayout, true),
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
