// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../components/pages/Erstatningsopgoerelse';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { FormPersistenceProvider } from '../../../../contexts/FormPersistenceContext';
import { useFormPersistence } from '../../../../contexts/useFormPersistence';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../../../../settings/appSettingsStorage';

const { computeEoSnapshotMock } = vi.hoisted(() => ({
  computeEoSnapshotMock: vi.fn((args: { revision: string }) => ({
    revision: args.revision,
    status: 'ok',
    data: null,
    invariants: [],
    input: { stamdata: null, erstatningsopgoerelse: null },
  })),
}));

vi.mock('../../../../components/pages/erstatningsopgoerelse/EOOplysningerTab', () => ({
  default: () => <div>EO Oplysninger indhold</div>,
}));

vi.mock('../../../../components/pages/erstatningsopgoerelse/LoenindkomstTab', () => ({
  default: () => <div>Lønindkomst indhold</div>,
}));

vi.mock('../../../../components/pages/erstatningsopgoerelse/OffentligeYdelserTab', () => ({
  default: () => <div>Offentlige ydelser indhold</div>,
}));

vi.mock('../../../../components/pages/erstatningsopgoerelse/EOberegningTab', () => ({
  default: () => <div>Beregning indhold</div>,
}));

vi.mock('../../../../components/pages/erstatningsopgoerelse/EOInspektion', () => ({
  default: () => <div>EO-gennemsyn indhold</div>,
}));

vi.mock('../../../../components/pages/erstatningsopgoerelse/EOKontrolTabel', () => ({
  default: () => <div>Kontroltabel indhold</div>,
}));

vi.mock('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot', () => ({
  computeEoSnapshot: computeEoSnapshotMock,
}));

describe('Erstatningsopgoerelse gennemsyns-/kontrol snapshot-refresh', () => {
  beforeEach(() => {
    sessionStorage.clear();
    computeEoSnapshotMock.mockClear();
    writeLocalStorage(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ showEOInspektionMenu: true })
    );
  });

  it('rebuilds on first snapshot-tab entry and whenever committed revision changes while snapshot faner er aktive', async () => {
    let ctx: ReturnType<typeof useFormPersistence> | null = null;

    const Probe = () => {
      const value = useFormPersistence();
      React.useEffect(() => {
        ctx = value;
      }, [value]);
      return null;
    };

    render(
      <MemoryRouter initialEntries={['/erstatningsopgoerelse']}>
        <AppSettingsProvider>
          <FormPersistenceProvider>
            <Probe />
            <Erstatningsopgoerelse />
          </FormPersistenceProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(ctx).not.toBeNull();
    });

    expect(computeEoSnapshotMock).toHaveBeenCalledTimes(0);

    act(() => {
      ctx!.persistData('stamdata', {
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Før tab-entry',
        skadestype: undefined,
        skadedato: undefined,
      });
    });
    expect(computeEoSnapshotMock).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Beregning' }));
    await waitFor(() => {
      expect(computeEoSnapshotMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      ctx!.persistData('stamdata', {
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Mens Beregning er aktiv',
        skadestype: undefined,
        skadedato: undefined,
      });
    });
    await waitFor(() => {
      expect(computeEoSnapshotMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByText('Kontroltabel'));
    expect(computeEoSnapshotMock).toHaveBeenCalledTimes(2);

    act(() => {
      ctx!.persistData('stamdata', {
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Mens Kontroltabel er aktiv',
        skadestype: undefined,
        skadedato: undefined,
      });
    });
    await waitFor(() => {
      expect(computeEoSnapshotMock).toHaveBeenCalledTimes(3);
    });
  });
});
