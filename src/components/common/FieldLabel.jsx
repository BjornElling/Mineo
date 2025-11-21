import React from 'react';
import { Typography } from '@mui/material';

/**
 * FieldLabel - Fælles label-komponent til datafelter
 *
 * Bruges til at vise labels over input-felter med konsistent styling.
 * Stylingen er defineret i globalStyles.js under .field-label klassen.
 */
const FieldLabel = ({ children }) => (
  <Typography className="field-label">
    {children}
  </Typography>
);

FieldLabel.displayName = 'FieldLabel';

export default FieldLabel;
