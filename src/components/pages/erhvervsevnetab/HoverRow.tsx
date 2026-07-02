import React from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

type Props = Readonly<{
  text: string;
  /** Vis teksten som understreget underoverskrift i stedet for almindelig tekst. */
  underlined?: boolean;
  /** Valgfri styling på selve tekstlinjen (fx indrykning i gennemsyns-/kontrolvisninger). */
  textSx?: SxProps<Theme>;
}>;

/**
 * Enkelt-linje i en `row--label-right-hover`-boks med tom højreside.
 * `underlined` skifter mellem almindelig tekst og understreget underoverskrift.
 */
const HoverRow = ({ text, underlined = false, textSx }: Props) => (
  <Box className="row--label-right-hover">
    <Typography className={underlined ? 'row--subheading-underlined' : 'row--text'} sx={textSx}>
      {text}
    </Typography>
    <Box className="row--label-right-hover__content" />
  </Box>
);

HoverRow.displayName = 'HoverRow';

export default HoverRow;
