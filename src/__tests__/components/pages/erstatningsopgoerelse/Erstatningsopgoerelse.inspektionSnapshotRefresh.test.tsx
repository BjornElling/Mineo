// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../../../inputCore/runtime/slimInputStore';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Erstatningsopgoerelse from '../../../../components/pages/Erstatningsopgoerelse';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../../contexts/RoutePathnameProvider';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../../../../settings/appSettingsStorage';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../../inputCore/react';
import { getProductionInputCatalog } from '../../../../inputCore/catalog/productionCatalog';
import { slimInputStore } from '../../../../inputCore/runtime/slimInputStore';
import { settleField } from '../../../../inputCore/inputReducer';
import { stamdataSkadelidteField } from '../../../../inputCore/catalog/stamdataDescriptors';

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
  default: () => <div>EO-kontrol indhold</div>,
}));

vi.mock('../../../../components/pages/erstatningsopgoerelse/EOKontrolTabel', () => ({
  default: () => <div>Kontroltabel indhold</div>,
}));

vi.mock('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot')>()),
  computeEoSnapshot: computeEoSnapshotMock,
}));

describe('Erstatningsopgoerelse kontrol snapshot-refresh', () => {
  beforeEach(() => {
    sessionStorage.clear();
    computeEoSnapshotMock.mockClear();
    writeLocalStorage(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ showEOInspektionMenu: true })
    );
  });

  it('genbygger snapshot ved hver afsluttet revision uafhængigt af den aktive fane', async () => {
    const catalog = getProductionInputCatalog();
    __hydrateSlimInputStoreForTest(slimInputStore, catalog.validateSettledInput({
      sections: {
        stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
        varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
      },
      rejectedInputs: {},
    }));
    const binding = createProductionInputRuntimeBinding();

    render(
      <MemoryRouter initialEntries={['/erstatningsopgoerelse']}>
        <AppSettingsProvider>
          <RoutePathnameProvider>
            <ProductionInputRuntimeProvider binding={binding}>
              <Erstatningsopgoerelse />
            </ProductionInputRuntimeProvider>
          </RoutePathnameProvider>
        </AppSettingsProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(computeEoSnapshotMock).toHaveBeenCalledTimes(1));

    act(() => {
      binding.edit.dispatch(settleField(stamdataSkadelidteField.bind(), 'Før tab-entry'));
    });
    await waitFor(() => expect(computeEoSnapshotMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('tab', { name: 'Beregning' }));
    expect(computeEoSnapshotMock).toHaveBeenCalledTimes(2);

    act(() => {
      binding.edit.dispatch(settleField(stamdataSkadelidteField.bind(), 'Mens Beregning er aktiv'));
    });
    await waitFor(() => {
      expect(computeEoSnapshotMock).toHaveBeenCalledTimes(3);
    });

    fireEvent.click(screen.getByText('Kontroltabel'));
    expect(computeEoSnapshotMock).toHaveBeenCalledTimes(3);

    act(() => {
      binding.edit.dispatch(settleField(stamdataSkadelidteField.bind(), 'Mens Kontroltabel er aktiv'));
    });
    await waitFor(() => {
      expect(computeEoSnapshotMock).toHaveBeenCalledTimes(4);
    });
  });
});
