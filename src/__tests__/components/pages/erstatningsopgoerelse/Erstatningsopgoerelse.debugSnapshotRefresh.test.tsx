// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

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

vi.mock('../../../../components/pages/erstatningsopgoerelse/EODebug', () => ({
  default: () => <div>EO debug indhold</div>,
}));

vi.mock('../../../../components/pages/erstatningsopgoerelse/EODebugTabel', () => ({
  default: () => <div>Debug tabel indhold</div>,
}));

vi.mock('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot', () => ({
  computeEoSnapshot: computeEoSnapshotMock,
}));

describe('Erstatningsopgoerelse debug snapshot-refresh', () => {
  beforeEach(() => {
    sessionStorage.clear();
    computeEoSnapshotMock.mockClear();
    writeLocalStorage(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ showEODebugMenu: true })
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
      <AppSettingsProvider>
        <FormPersistenceProvider>
          <Probe />
          <Erstatningsopgoerelse />
        </FormPersistenceProvider>
      </AppSettingsProvider>
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
        skadestype: '',
        skadesdato: '',
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
        skadestype: '',
        skadesdato: '',
      });
    });
    await waitFor(() => {
      expect(computeEoSnapshotMock).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByText('Debug tabel'));
    expect(computeEoSnapshotMock).toHaveBeenCalledTimes(2);

    act(() => {
      ctx!.persistData('stamdata', {
        journalnr: '',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Mens Debug tabel er aktiv',
        skadestype: '',
        skadesdato: '',
      });
    });
    await waitFor(() => {
      expect(computeEoSnapshotMock).toHaveBeenCalledTimes(3);
    });
  });
});
