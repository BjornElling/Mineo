// @vitest-environment jsdom
import type React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import InputUnitAdornment from '../../../components/inputs/InputUnitAdornment';
import { buildTheme } from '../../../config/appTheme';
import { DerivedPercentField } from '../../../inputCore/react/fields/PercentField';

const renderWithTheme = (node: React.ReactNode) => render(
  <ThemeProvider theme={buildTheme('light')}>{node}</ThemeProvider>
);

describe('felternes typografisignaturer', () => {
  it('lader en tom enhed arve feltets kontrolsignatur frem for placeholderens', () => {
    const { container } = renderWithTheme(<InputUnitAdornment unitSuffix=" %" muted />);
    const adornment = container.querySelector('.MuiInputAdornment-root');

    expect(adornment).toHaveStyle({ color: 'var(--mineo-color-input-unit-muted)' });
  });

  it('højrestiller låste afledte procentværdier med tabular-nums', () => {
    renderWithTheme(<DerivedPercentField value={0.45} name="storeBededagPct" />);
    const input = screen.getByRole('textbox');

    expect(input).toHaveStyle({
      textAlign: 'right',
      fontVariantNumeric: 'tabular-nums',
    });
  });
});
