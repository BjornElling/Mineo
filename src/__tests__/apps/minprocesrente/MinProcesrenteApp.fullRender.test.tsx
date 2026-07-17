// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import MinProcesrenteApp from '../../../apps/minprocesrente/MinProcesrenteApp';
import { initializePersistenceRuntime } from '../../../persistence/persistenceRuntime';

describe('MinProcesrenteApp full render', () => {
  it('renderer den faktiske standalone-beregner uden Mineos AppSettingsProvider', () => {
    render(<MinProcesrenteApp persistenceRuntime={initializePersistenceRuntime()} />);

    expect(screen.getByRole('heading', { name: 'minProcesrente.dk' })).toBeInTheDocument();
  });
});
