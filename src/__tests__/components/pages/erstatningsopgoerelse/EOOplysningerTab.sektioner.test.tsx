// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../components/pages/Erstatningsopgoerelse';
import { STORAGE_KEYS, createActiveTabStorageKey } from '../../../../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../../../../config/persistenceVersion';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

const persistedWrapper = (data: unknown) => ({
  version: PERSISTED_DATA_VERSION,
  timestamp: Date.now(),
  data,
});

/**
 * Regressions-net for A1's sektion-dekomponering af EO-oplysninger-fanen: når den store inline-JSX
 * splittes i sektion-komponenter (der forbruger view-modellen via kontekst), skal fanen fortsat
 * rendere alle de uafhængigt synlige sektioner. Testen fanger en tabt/krakkende sektion.
 */
describe('EOOplysningerTab sektioner', () => {
  const ASYNC_TEST_TIMEOUT_MS = 30_000;

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renderer alle uafhængigt synlige sektioner på oplysninger-fanen', async () => {
    sessionStorage.setItem(
      STORAGE_KEYS.erstatningsopgoerelse,
      JSON.stringify(persistedWrapper(createErstatningsopgoerelseInitialValues()))
    );
    sessionStorage.setItem(createActiveTabStorageKey('erstatningsopgoerelse'), 'eo_oplysninger');

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
      expect(screen.queryAllByText('Bilagsnumre').length).toBeGreaterThan(0);
    });

    const expectedSectionHeaders = [
      'Erstatningsopgørelse',
      'Forlig',
      'AES-afgørelser',
      'Svie- og smertegodtgørelse',
      'Tabt arbejdsfortjeneste',
      'Indtægt før skadedatoen',
      'Øvrige erstatningskrav',
      'Eventuelle særlige kommentarer',
      'Bilagsnumre',
    ];

    for (const header of expectedSectionHeaders) {
      expect(
        screen.queryAllByText(header).length,
        `Forventede sektion-overskrift "${header}" på oplysninger-fanen`
      ).toBeGreaterThan(0);
    }
  }, ASYNC_TEST_TIMEOUT_MS);
});
