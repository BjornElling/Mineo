// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import UnsupportedDevicePage from '../../../components/system/UnsupportedDevicePage';

describe('UnsupportedDevicePage', () => {
  it('viser Mineo-mobilens brandtitel som minEO.dk med nedtonet prefix og suffix', () => {
    render(<UnsupportedDevicePage />);

    const heading = screen.getByRole('heading', { name: 'minEO.dk' });

    expect(heading).toHaveTextContent('minEO.dk');
    expect(within(heading).getByText('min')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.42)' });
    expect(within(heading).getByText('EO')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.87)' });
    expect(within(heading).getByText('.dk')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.42)' });
  });
});
