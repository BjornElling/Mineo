// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import MinProcesrenteApp from '../../../apps/minprocesrente/MinProcesrenteApp';
import { bootstrapProductionInputRuntime } from '../../../inputCore/react';

describe('MinProcesrenteApp full render', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renderer den faktiske standalone-beregner på den greenfield input-runtime uden Mineos AppSettingsProvider', () => {
    const { binding } = bootstrapProductionInputRuntime();
    render(<MinProcesrenteApp inputRuntimeBinding={binding} />);

    expect(screen.getByRole('heading', { name: 'minProcesrente.dk' })).toBeInTheDocument();
  });
});
