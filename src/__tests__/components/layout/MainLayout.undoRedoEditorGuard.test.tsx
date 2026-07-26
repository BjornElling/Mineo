// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../../inputCore/runtime/slimInputStore';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react/productionInputRuntime';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { dispatchInput } from '../../../inputCore/runtime/dispatchInput';
import { settleField } from '../../../inputCore/inputReducer';
import { satserAargangField } from '../../../inputCore/catalog/satserDescriptors';

import MainLayout from '../../../components/layout/MainLayout';
import { OpenEditor } from './editorTestUtils';

// Greenfield undo/redo-genvej (§1.4/§3.6): shellen driver `useUndoRedoShortcuts`, som kalder den ene
// write-grænses history via coordinatoren. Mens en editor er åben er genvejen et STILLE no-op (coordinatorens
// `prepare("undo"|"redo")` returnerer `noop`); uden åben editor kører undo/redo mod history. Vi hævder derfor
// mod den ægte runtime-history i stedet for det legacy `useUndoRedo`-mock.

const catalog = getProductionInputCatalog();

const emptyInput = () => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
    renteberegning: null, varigemen: null, forsoergertab: null,
    erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const renderLayout = (children: React.ReactNode) =>
  render(
    <AppSettingsProvider>
      <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
        <MemoryRouter initialEntries={['/stamdata']}>
          <MainLayout>{children}</MainLayout>
        </MemoryRouter>
      </ProductionInputRuntimeProvider>
    </AppSettingsProvider>,
  );

/** Bygger en history-frame (satsår 2020), så et efterfølgende undo har noget at gendanne. */
const seedUndoableHistory = () => {
  __hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  dispatchInput(slimInputStore, catalog, settleField(satserAargangField.bind(), '2020'));
};

const dispatchUndoShortcut = () => {
  const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
};

const dispatchShortcut = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('MainLayout undo/redo editor guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  afterEach(() => {
    __hydrateSlimInputStoreForTest(slimInputStore, emptyInput());
  });

  it('ignores undo shortcuts silently while an editor is open', async () => {
    seedUndoableHistory();
    expect(slimInputStore.getState().input.sections.satser?.aargang).toBe(2020);

    renderLayout(<OpenEditor label="Aktivt felt" />);
    await waitFor(() => {
      expect(screen.getByLabelText('Aktivt felt')).toBeInTheDocument();
    });

    let event: KeyboardEvent | undefined;
    await act(async () => {
      event = dispatchUndoShortcut();
      // Coordinatorens prepare er async; lad no-op-beslutningen afsluttes.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(event?.defaultPrevented).toBe(true);
    // Åben editor → stille no-op: history er urørt, satsåret står stadig 2020.
    expect(slimInputStore.getState().input.sections.satser?.aargang).toBe(2020);
    expect(screen.queryByText('Kan ikke fortryde eller gentage: afslut eller ret det aktive felt først.')).toBeNull();
  });

  it('calls undo when no editor is active', async () => {
    seedUndoableHistory();
    expect(slimInputStore.getState().input.sections.satser?.aargang).toBe(2020);

    renderLayout(<button type="button">Ikke editor</button>);

    let event: KeyboardEvent | undefined;
    await act(async () => {
      event = dispatchUndoShortcut();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(event?.defaultPrevented).toBe(true);
    // Ingen åben editor → undo kører mod history: satsåret er fortrudt tilbage til tom.
    await waitFor(() => {
      expect(slimInputStore.getState().input.sections.satser).toBeNull();
    });
  });

  it.each([
    ['Ctrl+Y', { key: 'y', ctrlKey: true }],
    ['Ctrl+Shift+Z', { key: 'z', ctrlKey: true, shiftKey: true }],
  ])('calls redo for %s when no editor is active', async (_label, init) => {
    seedUndoableHistory();
    // Fortryd først, så der findes noget at gentage.
    dispatchInput(slimInputStore, catalog, { kind: 'undo' });
    expect(slimInputStore.getState().input.sections.satser).toBeNull();

    renderLayout(<button type="button">Ikke editor</button>);

    let event: KeyboardEvent | undefined;
    await act(async () => {
      event = dispatchShortcut(init);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(event?.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(slimInputStore.getState().input.sections.satser?.aargang).toBe(2020);
    });
  });
});
