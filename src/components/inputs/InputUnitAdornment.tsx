import * as React from 'react';
import { InputAdornment } from '@mui/material';

/**
 * Fælles enheds-adornment ("kr." / "%") for numeriske indtastningsfelter — både formular- og
 * tabelfelter. Enheden er rent visuel og ligger uden for selve `input.value`, så markør, kopiering
 * og feltbredde er upåvirkede.
 *
 * Adornmentet er altid monteret (pladsen reserveres, så feltet ikke hopper), men dets tekst skjules
 * under indtastning via `hidden` (valgt UX: enhed i hvile, skjult under indtastning). Når feltet er
 * tomt, dæmpes farven til placeholder-niveau, så enheden ikke fremstår som indtastet indhold.
 *
 * `unitSuffix` indeholder det ledende mellemrum (fx " kr." / " %") — referér `INPUT_UNIT_SUFFIX`.
 */
export type InputUnitAdornmentProps = Readonly<{
  unitSuffix: string;
  /** Skjul enheds-teksten (men behold den reserverede plads) — typisk mens feltet redigeres. */
  hidden: boolean;
  /** Dæmp farven til placeholder-niveau — typisk når feltet er tomt. */
  muted: boolean;
}>;

const InputUnitAdornment = ({ unitSuffix, hidden, muted }: InputUnitAdornmentProps) => (
  <InputAdornment
    position="end"
    sx={{
      marginLeft: 0,
      pointerEvents: 'none',
      visibility: hidden ? 'hidden' : 'visible',
      color: muted ? 'var(--mineo-color-placeholder)' : 'inherit',
      font: 'inherit',
      '& span': { font: 'inherit' },
    }}
  >
    <span style={{ whiteSpace: 'pre' }}>{unitSuffix}</span>
  </InputAdornment>
);

InputUnitAdornment.displayName = 'InputUnitAdornment';

export default InputUnitAdornment;
