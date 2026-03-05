import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import EOberegningTab from '../../../../components/pages/erstatningsopgoerelse/EOberegningTab';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { buildControlMismatchInvariant } from '../../../../domain/erstatningsopgoerelse/eoSnapshotInvariants';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../../domain/stamdata/stamdataInitialValues';
import type { EoSnapshot } from '../../../../domain/erstatningsopgoerelse/eoSnapshot';

vi.mock('../../../../hooks/useFormFieldErrors', () => ({
  useFieldErrorsBySourceForSection: () => ({}),
}));

vi.mock('../../../../domain/debug/eoDebugRowAggregator', () => ({
  collectAllDebugRows: () => ({ errors: [], warnings: [], allRows: [], relevantRows: [] }),
}));

vi.mock('../../../../utils/scrollToSection', () => ({
  scrollToSection: vi.fn(),
}));

const renderTab = (props: React.ComponentProps<typeof EOberegningTab>) => {
  return render(
    <MemoryRouter>
      <AppSettingsProvider>
        <FormPersistenceProvider>
          <EOberegningTab {...props} />
        </FormPersistenceProvider>
      </AppSettingsProvider>
    </MemoryRouter>
  );
};

describe('EOberegningTab kontroltjek', () => {
  const baseStamdataValues = structuredClone(STAMDATA_INITIAL_VALUES);
  const baseEoValues = createErstatningsopgoerelseInitialValues();
  const baseSetEoValues = vi.fn();

  beforeEach(() => {
    baseSetEoValues.mockReset();
  });

  it('viser kontroluoverensstemmelse i download-kontroller og ikke i separat dialog', () => {
    const snapshot: EoSnapshot = {
      revision: 'rev-1',
      status: 'error',
      invariants: [
        buildControlMismatchInvariant([
          'Ansættelsesforhold: beregnet=100, tabel=90',
        ]),
      ],
      data: null,
      input: {
        stamdata: baseStamdataValues,
        erstatningsopgoerelse: baseEoValues,
      },
    };

    renderTab({
      activeTab: 'beregning',
      setActiveTab: vi.fn(),
      isActive: true,
      eoSnapshot: snapshot,
      stamdataValues: baseStamdataValues,
      eoValues: baseEoValues,
      setEOValues: baseSetEoValues,
    });

    expect(screen.getByText('Download-kontroller')).toBeInTheDocument();
    expect(screen.getByText('Erstatningsopgørelse-PDF')).toBeInTheDocument();
    expect(screen.getByText('TAF fordelt på år')).toBeInTheDocument();
    expect(screen.getAllByText('Der er konstateret kontroluoverensstemmelser i EO-beregningen.')).toHaveLength(2);
    expect(screen.queryByText('Uoverensstemmelse i kontrolberegning')).not.toBeInTheDocument();
  });
});
