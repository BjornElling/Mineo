import * as React from 'react';
import { InputAdornment } from '@mui/material';

/**
 * Fælles enheds-adornment ("kr." / "%") for numeriske indtastningsfelter — både formular- og
 * tabelfelter. Enheden er rent visuel og ligger uden for selve `input.value`, så markør, kopiering
 * og feltbredde er upåvirkede.
 *
 * Enheden vises altid — også mens feltet redigeres — så feltets udtryk er roligt og forudsigeligt.
 * Når feltet er tomt, dæmpes farven til placeholder-niveau, så enheden ikke fremstår som indtastet
 * indhold. `pointerEvents: none` lader klik passere igennem til feltet, så hele feltet (inkl. enheden)
 * åbner editoren.
 *
 * `unitSuffix` indeholder det ledende mellemrum (fx " kr." / " %") — referér `INPUT_UNIT_SUFFIX`.
 */
export type InputUnitAdornmentProps = Readonly<{
  unitSuffix: string;
  /** Dæmp farven til placeholder-niveau — typisk når feltet er tomt. */
  muted: boolean;
}>;

const InputUnitAdornment = ({ unitSuffix, muted }: InputUnitAdornmentProps) => (
  <InputAdornment
    position="end"
    sx={{
      marginLeft: 0,
      pointerEvents: 'none',
      color: muted ? 'var(--mineo-color-input-unit-muted)' : 'inherit',
      font: 'inherit',
      '& span': { font: 'inherit' },
    }}
  >
    <span style={{ whiteSpace: 'pre' }}>{unitSuffix}</span>
  </InputAdornment>
);

InputUnitAdornment.displayName = 'InputUnitAdornment';

export default InputUnitAdornment;
