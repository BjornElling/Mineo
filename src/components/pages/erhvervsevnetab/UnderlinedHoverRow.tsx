import React from 'react';
import { Box, Typography } from '@mui/material';

type Props = Readonly<{ text: string }>;

const UnderlinedHoverRow = ({ text }: Props) => (
  <Box className="row--label-right-hover">
    <Typography className="row--subheading-underlined">{text}</Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

UnderlinedHoverRow.displayName = 'UnderlinedHoverRow';

export default UnderlinedHoverRow;
