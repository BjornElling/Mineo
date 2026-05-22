// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import { clearResolvedFieldErrorsCache } from '../../../hooks/useFormPersistenceSelectors';
import { formPersistenceStore } from '../../../stores/formPersistenceStore';
import { undoRedoStore } from '../../../stores/undoRedoStore';

vi.mock('../../../components/tables/useRentekravRows', () => ({
  __esModule: true,
  default: () => ({
    draftRows: [],
    onFieldChange: vi.fn(),
    onRowBlur: vi.fn(),
    reorderRows: vi.fn(),
    committedById: new Map(),
  }),
}));

vi.mock('../../../components/pages/renteberegning/RenteberegningTab', () => ({
  __esModule: true,
  default: (props: {
    kommentarer?: string;
    onKommentarerCommit: (event: { target: { value: string } }) => void;
  }) => (
    <section aria-label="Procesrente beregner">
      <output data-testid="kommentarer">{props.kommentarer ?? ''}</output>
      <button
        type="button"
        onClick={() => {
          props.onKommentarerCommit({ target: { value: '  Standalone kommentar  ' } });
        }}
      >
        Commit kommentar
      </button>
    </section>
  ),
}));

import MinProcesrenteApp from '../../../apps/minprocesrente/MinProcesrenteApp';

describe('MinProcesrenteApp', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    sessionStorage.clear();
    clearResolvedFieldErrorsCache();
    formPersistenceStore.getState().clearAll({
      hydrated: true,
      schemaFingerprint: PERSISTED_DATA_VERSION,
      lastCommittedAt: Date.now(),
    });
    formPersistenceStore.getState().clearAllFieldErrors();
    formPersistenceStore.getState().__setMetaUnsafe({ hydrated: false, lastCommittedAt: undefined });
    undoRedoStore.getState().clear();
  });

  it('monterer standalone provider-kæden og committer renteberegning via den faktiske persistence-hook', async () => {
    const user = userEvent.setup();

    render(<MinProcesrenteApp />);

    expect(screen.getByText('Procesrente')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Procesrente beregner' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Commit kommentar' }));

    await waitFor(() => {
      expect(screen.getByTestId('kommentarer')).toHaveTextContent('Standalone kommentar');
    });
    expect(formPersistenceStore.getState().sections.renteberegning).toMatchObject({
      kommentarer: 'Standalone kommentar',
    });
  });
});
