// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../components/pages/Erstatningsopgoerelse';
import { STORAGE_KEYS, createActiveTabStorageKey } from '../../../../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../../../../config/persistenceVersion';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../../types/branded';

const persistedWrapper = (data: unknown) => ({
  version: PERSISTED_DATA_VERSION,
  timestamp: Date.now(),
  data,
});

describe('Erstatningsopgoerelse svie/smerte sats-aar integration', () => {
  const ASYNC_TEST_TIMEOUT_MS = 30_000;

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('viser sats-aar advarslen i Beregning-fanen på den rigtige side', async () => {
    sessionStorage.setItem(
      STORAGE_KEYS.erstatningsopgoerelse,
      JSON.stringify(
        persistedWrapper({
          ...createErstatningsopgoerelseInitialValues(),
          opgørelseLavetDen: toISODateString('2025-12-15'),
          svieSmerteSatserAar: 2025,
          revideretOpgoerelse: 'Nej',
        })
      )
    );
    sessionStorage.setItem(createActiveTabStorageKey('erstatningsopgoerelse'), 'beregning');

    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <Erstatningsopgoerelse />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Svie/smerte-satsen for 2026 kan anvendes.')).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Beregning', selected: true })).toBeInTheDocument();
  }, ASYNC_TEST_TIMEOUT_MS);
});
