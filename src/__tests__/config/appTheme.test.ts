import { buildTheme } from '../../config/appTheme';

describe('buildTheme', () => {
  it('bygger dark theme med forventet palette mode og primary-farve', () => {
    const theme = buildTheme('dark');

    expect(theme.palette.mode).toBe('dark');
    expect(theme.palette.primary.main).toBe('#90caf9');
  });

  it('giver dark-aware fallback for MUI typography-farve', () => {
    const theme = buildTheme('dark');

    expect(theme.typography.allVariants?.color).toContain('rgba(255, 255, 255, 0.87)');
  });
});
