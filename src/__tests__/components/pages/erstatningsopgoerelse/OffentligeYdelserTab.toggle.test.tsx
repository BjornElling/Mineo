import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import OffentligeYdelserTab from '../../../../components/pages/erstatningsopgoerelse/OffentligeYdelserTab';
import { createErstatningsopgoerelseInitialValues } from '../../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { initialOffentligYdelseRow } from '../../../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../../schemas/formSchemas';
import type { SetValuesUpdater } from '../../../../hooks/usePersistedForm';
import { toISODateString } from '../../../../types/branded';

const renderTab = (params: Readonly<{
  rows: OffentligeYdelserRow[];
  midlertidigtEetFraEetSiden?: ErstatningsopgoerelseValues['midlertidigtEetFraEetSiden'];
  setEOValues?: SetValuesUpdater<ErstatningsopgoerelseValues>;
}>) => {
  render(
    <MemoryRouter>
      <AppSettingsProvider>
        <OffentligeYdelserTab
          rows={params.rows}
          onRowsChange={vi.fn()}
          midlertidigtEetFraEetSiden={params.midlertidigtEetFraEetSiden ?? 'Nej'}
          setEOValues={params.setEOValues ?? vi.fn()}
        />
      </AppSettingsProvider>
    </MemoryRouter>
  );
};

const applySetValuesCall = (
  setEOValues: ReturnType<typeof vi.fn>,
  prev: ErstatningsopgoerelseValues
): ErstatningsopgoerelseValues => {
  const updater = setEOValues.mock.calls[0]?.[0] as unknown;
  if (typeof updater === 'function') {
    return (updater as (value: ErstatningsopgoerelseValues) => ErstatningsopgoerelseValues)(prev);
  }
  return updater as ErstatningsopgoerelseValues;
};

const midlertidigtEetRow: OffentligeYdelserRow = {
  ...initialOffentligYdelseRow,
  id: 'midlertidigt-eet-1',
  fraDato: toISODateString('2024-01-01'),
  tilDato: toISODateString('2024-01-31'),
  ydelse: { kind: 'number', value: 1000 },
  ydelsestype: 'midlertidigt_eet',
};

describe('OffentligeYdelserTab midlertidigt EET-toggle', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('aktiverer togglen uden popup og tænder bilagsvalget når der ikke findes manuelle midlertidigt EET-rækker', async () => {
    const user = userEvent.setup();
    const setEOValues = vi.fn();
    renderTab({
      rows: [{ ...initialOffentligYdelseRow, id: 'row-1' }],
      setEOValues,
    });

    await user.click(screen.getByRole('checkbox', { name: 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden' }));

    expect(screen.queryByText('Slet manuelle indtastninger af Midlertidigt EET')).not.toBeInTheDocument();
    expect(setEOValues).toHaveBeenCalledTimes(1);

    const prev = createErstatningsopgoerelseInitialValues();
    const next = applySetValuesCall(setEOValues, prev);
    expect(next.midlertidigtEetFraEetSiden).toBe('Ja');
    expect(next.eoBilagSelection.midlertidigEet).toBe(true);
  });

  it('annullering i popup bevarer toggle og manuelle rækker', async () => {
    const user = userEvent.setup();
    const setEOValues = vi.fn();
    renderTab({
      rows: [midlertidigtEetRow],
      setEOValues,
    });

    await user.click(screen.getByRole('checkbox', { name: 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden' }));
    expect(screen.getByText('Slet manuelle indtastninger af Midlertidigt EET')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Annuller' }));

    await waitFor(() => {
      expect(screen.queryByText('Slet manuelle indtastninger af Midlertidigt EET')).not.toBeInTheDocument();
    });
    expect(setEOValues).not.toHaveBeenCalled();
  });

  it('bekræftelse i popup sletter manuelle midlertidigt EET-rækker atomisk med toggle og bilagsvalg', async () => {
    const user = userEvent.setup();
    const setEOValues = vi.fn();
    renderTab({
      rows: [midlertidigtEetRow],
      setEOValues,
    });

    await user.click(screen.getByRole('checkbox', { name: 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden' }));
    await user.click(screen.getByRole('button', { name: 'Ja, slet og aktivér' }));

    expect(setEOValues).toHaveBeenCalledTimes(1);
    const prev = {
      ...createErstatningsopgoerelseInitialValues(),
      offentligeYdelserRows: [
        midlertidigtEetRow,
        {
          ...initialOffentligYdelseRow,
          id: 'dagpenge-1',
          ydelsestype: 'dagpenge' as const,
        },
      ],
      eoBilagSelection: {
        ...createErstatningsopgoerelseInitialValues().eoBilagSelection,
        midlertidigEet: false,
      },
    };
    const next = applySetValuesCall(setEOValues, prev);

    expect(next.midlertidigtEetFraEetSiden).toBe('Ja');
    expect(next.offentligeYdelserRows.map((row) => row.id)).toEqual(['dagpenge-1']);
    expect(next.eoBilagSelection.midlertidigEet).toBe(true);
  });

  it('deaktiverer togglen uden popup og slukker bilagsvalget', async () => {
    const user = userEvent.setup();
    const setEOValues = vi.fn();
    renderTab({
      rows: [{ ...initialOffentligYdelseRow, id: 'row-1' }],
      midlertidigtEetFraEetSiden: 'Ja',
      setEOValues,
    });

    await user.click(screen.getByRole('checkbox', { name: 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden' }));

    expect(screen.queryByText('Slet manuelle indtastninger af Midlertidigt EET')).not.toBeInTheDocument();
    expect(setEOValues).toHaveBeenCalledTimes(1);

    const prev = {
      ...createErstatningsopgoerelseInitialValues(),
      midlertidigtEetFraEetSiden: 'Ja' as const,
      eoBilagSelection: {
        ...createErstatningsopgoerelseInitialValues().eoBilagSelection,
        midlertidigEet: true,
      },
    };
    const next = applySetValuesCall(setEOValues, prev);

    expect(next.midlertidigtEetFraEetSiden).toBe('Nej');
    expect(next.eoBilagSelection.midlertidigEet).toBe(false);
  });
});
