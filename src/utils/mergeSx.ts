import type { SxProps, Theme } from '@mui/material/styles';

type SxArray = Extract<SxProps<Theme>, readonly unknown[]>;
type SxEntry = SxArray[number];

const toSxArray = (value: SxProps<Theme>): SxArray =>
  Array.isArray(value) ? value : [value as SxEntry];

/**
 * Bevarer hele MUI's `sx`-kontrakt ved sammenfletning. Object-spread er ikke
 * sikkert her, fordi en `sx`-prop også kan være en callback eller et array.
 */
export const mergeSx = (
  base: SxProps<Theme>,
  override: SxProps<Theme> | undefined
): SxProps<Theme> => {
  if (override === undefined) return base;
  return [...toSxArray(base), ...toSxArray(override)];
};
