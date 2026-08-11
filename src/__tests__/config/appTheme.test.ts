import { buildTheme } from '../../config/appTheme';

describe('buildTheme', () => {
  it('bygger dark theme med forventet palette mode og primary-farve', () => {
    const theme = buildTheme('dark');

    expect(theme.palette.mode).toBe('dark');
    expect(theme.palette.primary.main).toBe('#90caf9');
  });

  it('giver dark-aware fallback for MUI typography-farve', () => {
    const theme = buildTheme('dark');
    const typography = theme.typography as typeof theme.typography & {
      allVariants?: { color?: string };
    };

    expect(typography.allVariants?.color).toContain('rgba(255, 255, 255, 0.87)');
  });

  it('giver alle tooltips indholdsbaseret bredde og naturlig venstrestillet ordombrydning', () => {
    const theme = buildTheme('light');
    const tooltip = theme.components?.MuiTooltip?.styleOverrides?.tooltip as Record<string, unknown>;

    expect(tooltip).toMatchObject({
      width: 'max-content',
      maxWidth: '360px',
      textAlign: 'left',
      whiteSpace: 'normal',
      overflowWrap: 'break-word',
      wordBreak: 'normal',
    });
  });
});
