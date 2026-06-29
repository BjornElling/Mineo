// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import MinProcesrenteApp from '../../../apps/minprocesrente/MinProcesrenteApp';

describe('MinProcesrenteApp full render', () => {
  it('renderer den faktiske standalone-beregner uden Mineos AppSettingsProvider', () => {
    render(<MinProcesrenteApp />);

    expect(screen.getByRole('heading', { name: 'minProcesrente.dk' })).toBeInTheDocument();
  });
});
