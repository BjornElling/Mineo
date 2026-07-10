// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { type SetValuesUpdater } from '../../../../hooks/usePersistedForm';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../../../contexts/FormPersistenceContext';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
  useBlockingFieldIdsBySuffixForSection: () => ({}),
}));

const renderTab = (eoValues: ReturnType<typeof createErstatningsopgoerelseInitialValues>) =>
  render(
    <MemoryRouter>
      <AppSettingsProvider>
        <FormPersistenceProvider runtime={initializePersistenceRuntime()}>
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

describe('EOberegningTab oversigt: skjult-markering', () => {
  const ASYNC_TEST_TIMEOUT_MS = 15_000;

  it('viser "Nej (skjult)" for svie/smerte og TAF når emnet er skjult', async () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Skjul';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Skjul';

    renderTab(eoValues);

    await waitFor(() => {
      expect(screen.getAllByText('Nej (skjult)').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText('Nej')).not.toBeInTheDocument();
  }, ASYNC_TEST_TIMEOUT_MS);

  it('viser kun "Nej" (uden skjult-markering) når emnet er fravalgt med Nej', async () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';

    renderTab(eoValues);

    await waitFor(() => {
      expect(screen.getAllByText('Nej').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByText('Nej (skjult)')).not.toBeInTheDocument();
  }, ASYNC_TEST_TIMEOUT_MS);
});
