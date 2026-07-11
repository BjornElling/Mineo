import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../utils/mergeSx';

describe('mergeSx', () => {
  it('bevarer base først og override sidst for objekter og callbacks', () => {
    const base = { color: 'red' };
    const override = (theme: Theme) => ({ color: theme.palette.primary.main });

    expect(mergeSx(base, override)).toEqual([base, override]);
  });

  it('flattener både base- og override-arrays uden at tabe betingede entries', () => {
    const base: SxProps<Theme> = [{ color: 'red' }, false];
    const override: SxProps<Theme> = [{ color: 'blue' }, { width: 10 }];

    expect(mergeSx(base, override)).toEqual([
      { color: 'red' },
      false,
      { color: 'blue' },
      { width: 10 },
    ]);
  });

  it('returnerer basen uændret uden override', () => {
    const base = { color: 'red' };
    expect(mergeSx(base, undefined)).toBe(base);
  });
});
