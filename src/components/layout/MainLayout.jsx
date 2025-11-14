import React from 'react';
import { Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import SideMenu from './SideMenu';
import Container from './Container';

/**
 * Hovedlayout for applikationen
 */
const MainLayout = React.memo(({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const activePage = location.pathname.substring(1) || 'stamdata';

  const handlePageChange = React.useCallback((pageId) => {
    navigate(`/${pageId}`);
  }, [navigate]);

  const handleGem = React.useCallback(() => {
    alert('Gem funktionalitet kommer snart!');
  }, []);

  const handleHent = React.useCallback(() => {
    alert('Hent funktionalitet kommer snart!');
  }, []);

  const handleSletAlt = React.useCallback(() => {
    alert('Slet alt funktionalitet kommer snart!');
  }, []);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SideMenu
        activePage={activePage}
        onPageChange={handlePageChange}
        onGem={handleGem}
        onHent={handleHent}
        onSletAlt={handleSletAlt}
      />
      <Container>{children}</Container>
    </Box>
  );
});

export default MainLayout;