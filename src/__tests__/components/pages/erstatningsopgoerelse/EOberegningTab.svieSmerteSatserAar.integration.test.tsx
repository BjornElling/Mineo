// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { type SetValuesUpdater } from '../../../../hooks/usePersistedForm';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../../types/branded';

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
  useBlockingFieldIdsBySuffixForSection: () => ({}),
}));

describe('EOberegningTab svie/smerte sats-aar integration', () => {
  const ASYNC_TEST_TIMEOUT_MS = 15_000;

  it('viser sats-aar advarslen i fejl og advarsler', async () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.opgørelseLavetDen = toISODateString('2025-12-15');
    eoValues.svieSmerteSatserAar = 2025;
    eoValues.revideretOpgoerelse = 'Nej';

    render(
      <MemoryRouter>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <EOberegningTab
              activeTab="beregning"
              setActiveTab={vi.fn()}
              isActive
              eoSnapshot={null}
              stamdataValues={STAMDATA_INITIAL_VALUES}
              eoValues={eoValues}
              setEOValues={vi.fn() as SetValuesUpdater<typeof eoValues>}
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Fejl og advarsler')).toBeInTheDocument();
      expect(screen.getByText('Svie/smerte-satsen for 2026 kan anvendes.')).toBeInTheDocument();
    });
  }, ASYNC_TEST_TIMEOUT_MS);
});
