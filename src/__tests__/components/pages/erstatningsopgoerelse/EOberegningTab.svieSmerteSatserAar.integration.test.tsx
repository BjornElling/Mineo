import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
}));

vi.mock('../../../../hooks/useEOLoenindkomstInputErrors', () => ({
  useEOLoenindkomstInputErrors: () => ({}),
}));

describe('EOberegningTab svie/smerte sats-aar integration', () => {
  it('viser sats-aar advarslen i fejl og advarsler', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.opgørelseLavetDen = '2025-12-15';
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
              setEOValues={vi.fn() as React.Dispatch<React.SetStateAction<typeof eoValues>>}
            />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Fejl og advarsler')).toBeInTheDocument();
    expect(screen.getByText('Svie/smerte satsen for 2026 kan anvendes.')).toBeInTheDocument();
  });
});
