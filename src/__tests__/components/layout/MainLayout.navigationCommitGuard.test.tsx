// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react/productionInputRuntime';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import MainLayout from '../../../components/layout/MainLayout';
import { OpenEditor } from './editorTestUtils';

// Greenfield-navigation (§1.4): sideskift er en settle-handling. Coordinatorens `prepare("navigate")` settler
// den åbne editor; et fail-closed `blocked` (uventet settle-fejl) stopper navigationen og fokuserer feltet.

const catalog = getProductionInputCatalog();
const emptyInput = () => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
    renteberegning: null, varigemen: null, forsoergertab: null,
    erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

describe('MainLayout navigation commit guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    slimInputStore.hydrate(emptyInput());
  });

  afterEach(() => {
    slimInputStore.hydrate(emptyInput());
  });

  it('keeps navigation fail-closed when an editable field is still active during page change', async () => {
    const ActiveEditorPage = () => (
      <div>
        <div>Stamdata testside</div>
        <OpenEditor label="Aktivt felt" />
      </div>
    );

    const SatserPage = () => <div>Satser testside</div>;

    render(
      <AppSettingsProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          <MemoryRouter initialEntries={['/stamdata']}>
            <Routes>
              <Route
                path="/stamdata"
                element={
                  <MainLayout>
                    <ActiveEditorPage />
                  </MainLayout>
                }
              />
              <Route
                path="/satser"
                element={
                  <MainLayout>
                    <SatserPage />
                  </MainLayout>
                }
              />
            </Routes>
          </MemoryRouter>
        </ProductionInputRuntimeProvider>
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Aktivt felt')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Satser'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Stamdata testside')).toBeInTheDocument();
    expect(screen.queryByText('Satser testside')).toBeNull();
    expect(await screen.findByText('Kan ikke skifte side: afslut eller ret det aktive felt først.')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Aktivt felt')).toHaveFocus();
    });
  });
});
