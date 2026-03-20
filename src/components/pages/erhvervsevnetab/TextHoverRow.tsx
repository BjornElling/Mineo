import React from 'react';
import { Box, Typography } from '@mui/material';

type Props = Readonly<{ text: string }>;

const TextHoverRow = ({ text }: Props) => (
  <Box className="row--label-right-hover">
    <Typography className="row--text">{text}</Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

TextHoverRow.displayName = 'TextHoverRow';

export default TextHoverRow;
