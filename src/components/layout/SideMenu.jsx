import React, { useState } from 'react';
import { Box, Button, Divider } from '@mui/material';
import {
  Menu as MenuIcon,
  EventRepeat,
  AssistWalker,
  Payments,
  ListAlt,
  TrendingUp,
  Person,
  BrowserUpdated,
  Save,
  DeleteForever,
  Settings,
  Info
} from '@mui/icons-material';

// Menu-dimensioner
const EXPANDED_WIDTH = 250;
const COLLAPSED_WIDTH = 70;

// Hovednavigation (defineret udenfor komponenten for at undgå genskabelse)
const navigationItems = [
  { id: 'stamdata', label: 'Stamdata', icon: <Person /> },
  { id: 'erstatningsopgoerelse', label: 'Erstatningsopgørelse', icon: <Payments /> },
  { id: 'erhvervsevnetab', label: 'Erhvervsevnetab', icon: <AssistWalker /> },
  { id: 'aarsloen', label: 'Årslønsberegning', icon: <EventRepeat /> },
  { id: 'renteberegning', label: 'Renteberegning', icon: <TrendingUp /> },
  { id: 'satser', label: 'Satser', icon: <ListAlt /> }
];

// Utilities (med active state)
const utilityItems = [
  { id: 'indstillinger', label: 'Indstillinger', icon: <Settings /> },
  { id: 'om', label: 'Om', icon: <Info /> }
];

/**
 * Sammenfoldelig sidemenu med navigation
 *
 * Features:
 * - Collapsed (70px) / Expanded (250px)
 * - Active state på navigationssider
 * - Separator-linjer mellem grupper
 * - Moderne, blød styling med rundede hjørner
 * - Fast ikon-placering og knaphøjde
 */
const SideMenu = React.memo(({ activePage, onPageChange, onGem, onHent, onSletAlt }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Fil-operationer (inkluderer callbacks, så skal forblive inde i komponenten)
  const fileOperations = React.useMemo(() => [
    { id: 'gem', label: 'Gem', icon: <Save />, action: onGem },
    { id: 'hent', label: 'Hent', icon: <BrowserUpdated />, action: onHent },
    { id: 'slet-alt', label: 'Slet\u00A0alt', icon: <DeleteForever />, action: onSletAlt }
  ], [onGem, onHent, onSletAlt]);

  const toggleMenu = React.useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleNavigation = React.useCallback((pageId) => {
    if (onPageChange) {
      onPageChange(pageId);
    }
  }, [onPageChange]);

  const handleFileOperation = React.useCallback((operation) => {
    if (operation.action) {
      operation.action();
    }
  }, []);

  return (
    <Box
      sx={{
        width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        height: '100vh',
        backgroundColor: '#f8f9fa',
        borderRight: '1px solid #e9ecef',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
      }}
    >
      {/* Hamburger toggle button */}
      <Box sx={{ py: 1, px: 1.5 }}>
        <Button
          onClick={toggleMenu}
          startIcon={<MenuIcon />}
          tabIndex={-1}
          sx={{
            textTransform: 'none',
            justifyContent: 'flex-start',
            pl: 1.5,
            pr: 1.5,
            py: 1.2,
            mb: 0.5,
            minWidth: 0,
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            color: '#6c757d',
            fontWeight: 400,
            fontSize: '0.95rem',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.04)'
            },
            '& .MuiButton-startIcon': {
              margin: '0',
              minWidth: '24px',
              color: '#6c757d'
            },
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {/* Ingen tekst */}
        </Button>
      </Box>

      <Divider sx={{ borderColor: '#e9ecef' }} />

      {/* Hovednavigation */}
      <Box sx={{ py: 1, px: 1.5 }}>
        {navigationItems.map((item) => (
          <Button
            key={item.id}
            fullWidth
            onClick={() => handleNavigation(item.id)}
            startIcon={item.icon}
            tabIndex={-1}
            className={activePage === item.id ? 'menu-item active' : 'menu-item'}
            sx={{
              justifyContent: 'flex-start',
              pl: 1.5,
              pr: 2,
              py: 1.2,
              mb: 0.5,
              minWidth: 0,
              height: '44px',
              borderRadius: '12px',
              '& .MuiButton-startIcon': {
                margin: '0 12px 0 0',
                minWidth: '24px',
                color: activePage === item.id ? 'var(--color-primary)' : 'var(--color-text-secondary)'
              }
            }}
          >
            {isExpanded && item.label}
          </Button>
        ))}
      </Box>

      <Divider sx={{ borderColor: '#e9ecef', my: 1 }} />

      {/* Fil-operationer */}
      <Box sx={{ py: 1, px: 1.5 }}>
        {fileOperations.map((item) => (
          <Button
            key={item.id}
            fullWidth
            onClick={() => handleFileOperation(item)}
            startIcon={item.icon}
            tabIndex={-1}
            className="menu-item"
            sx={{
              justifyContent: 'flex-start',
              pl: 1.5,
              pr: 2,
              py: 1.2,
              mb: 0.5,
              minWidth: 0,
              height: '44px',
              borderRadius: '12px',
              '& .MuiButton-startIcon': {
                margin: '0 12px 0 0',
                minWidth: '24px',
                color: 'var(--color-text-secondary)'
              }
            }}
          >
            {isExpanded && item.label}
          </Button>
        ))}
      </Box>

      <Divider sx={{ borderColor: '#e9ecef', my: 1 }} />

      {/* Utilities */}
      <Box sx={{ py: 1, px: 1.5 }}>
        {utilityItems.map((item) => (
          <Button
            key={item.id}
            fullWidth
            onClick={() => handleNavigation(item.id)}
            startIcon={item.icon}
            tabIndex={-1}
            className={activePage === item.id ? 'menu-item active' : 'menu-item'}
            sx={{
              justifyContent: 'flex-start',
              pl: 1.5,
              pr: 2,
              py: 1.2,
              mb: 0.5,
              minWidth: 0,
              height: '44px',
              borderRadius: '12px',
              '& .MuiButton-startIcon': {
                margin: '0 12px 0 0',
                minWidth: '24px',
                color: activePage === item.id ? 'var(--color-primary)' : 'var(--color-text-secondary)'
              }
            }}
          >
            {isExpanded && item.label}
          </Button>
        ))}
      </Box>

      {/* Spacer til at skubbe alt til toppen */}
      <Box sx={{ flexGrow: 1 }} />
    </Box>
  );
});

export default SideMenu;