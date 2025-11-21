import React from 'react';
import { Typography } from '@mui/material';

/**
 * SectionHeader - Fælles header-komponent til sektioner
 *
 * Bruges til at vise overskrifter for sektioner med konsistent styling.
 * Stylingen er defineret i globalStyles.js under .section-header klassen.
 */
const SectionHeader = ({ children }) => (
  <Typography className="section-header" component="div">
    {children}
  </Typography>
);

SectionHeader.displayName = 'SectionHeader';

export default SectionHeader;
