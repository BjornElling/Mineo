import React from 'react';
import { Box } from '@mui/material';

/**
 * ContentBox - Central komponent til indholdscontainere
 *
 * Denne komponent definerer det standardiserede udseende for alle containere
 * i applikationen. Ændringer her slår igennem på alle steder, hvor komponenten bruges.
 *
 * Props:
 * - children: Indholdet i containeren
 * - width: Bredde i pixels (default: 1000px)
 * - sx: Ekstra styling (valgfrit)
 */
const ContentBox = ({ children, width = 1000, sx = {} }) => {
  return (
    <Box
      sx={{
        width: `${width}px`,
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '40px 32px',
        margin: '40px 0',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

export default ContentBox;
