// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import MinProcesrenteApp from '../../../apps/minprocesrente/MinProcesrenteApp';
import { initializePersistenceRuntime } from '../../../persistence/persistenceRuntime';
import { bootstrapProductionInputRuntime } from '../../../inputCore/react/productionInputRuntime';

describe('MinProcesrenteApp full render', () => {
  it('renderer den faktiske standalone-beregner uden Mineos AppSettingsProvider', () => {
    render(<MinProcesrenteApp persistenceRuntime={initializePersistenceRuntime()} inputRuntimeBinding={bootstrapProductionInputRuntime().binding} />);

    expect(screen.getByRole('heading', { name: 'minProcesrente.dk' })).toBeInTheDocument();
  });
});
