// @vitest-environment jsdom
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { FormPersistenceProvider, initializePersistenceRuntime } from '../../contexts/FormPersistenceContext';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  __resetLegacyGridTransactionBridgeForTests,
  cancelLegacyGridRejectedClear,
  consumeLegacyGridRejectedClear,
  stageLegacyGridRejectedClear,
} from '../../input/legacyGridTransactionBridge';
import { executeLegacyInputTransaction as executeInputTransaction } from '../../input/inputTransactionRunner';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { erstatningsopgoerelseSchema } from '../../schemas/formSchemas';
import { inputRuntimeStore, type HistoryFrameOrigin } from '../../stores/inputRuntimeStore';

const PAGE_KEY = 'erstatningsopgoerelse' as const;
const undoFieldPath = 'row-1:2';
const rejectedFieldPath = 'eo-offentlige-ydelser::row-1:2';
const origin: HistoryFrameOrigin = {
  route: '/erstatningsopgoerelse',
  tabKey: 'offentlige-ydelser',
  sectionKey: PAGE_KEY,
  fieldPath: undoFieldPath,
  focusToken: null,
};

describe('legacyGridTransactionBridge', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetLegacyGridTransactionBridgeForTests();
  });

  it('fletter canonical gridværdi og rejected-clear i én transaktion og ét undo-trin', () => {
    const runtime = initializePersistenceRuntime();
    const initialValues = createErstatningsopgoerelseInitialValues();
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <FormPersistenceProvider runtime={runtime}>{children}</FormPersistenceProvider>
    );
    const { result } = renderHook(
      () => usePersistedForm(erstatningsopgoerelseSchema, PAGE_KEY, initialValues),
      { wrapper }
    );

    act(() => {
      executeInputTransaction({
        kind: 'changeRejectedInputs',
        changes: [{ pageKey: PAGE_KEY, fieldPath: rejectedFieldPath, draft: '12' }],
      }, { origin });
    });
    const beforeRevision = inputRuntimeStore.getState().revision;
    const beforeHistoryLength = inputRuntimeStore.getState().history.past.length;

    stageLegacyGridRejectedClear({
      section: PAGE_KEY,
      undoFieldPath,
      clear: { pageKey: PAGE_KEY, fieldPath: rejectedFieldPath, expectedRaw: '12' },
    });
    act(() => {
      result.current.setValues(
        (previous) => ({ ...previous, eoLedsagetekst: 'ændret' }),
        { fieldPath: undoFieldPath }
      );
    });

    expect(inputRuntimeStore.getState().revision).toBe(beforeRevision + 1);
    expect(inputRuntimeStore.getState().history.past).toHaveLength(beforeHistoryLength + 1);
    expect(inputRuntimeStore.getState().invalidDrafts[PAGE_KEY][rejectedFieldPath]).toBeUndefined();
    expect(inputRuntimeStore.getState().sections[PAGE_KEY]?.eoLedsagetekst).toBe('ændret');

    act(() => { executeInputTransaction({ kind: 'undo' }); });
    expect(inputRuntimeStore.getState().invalidDrafts[PAGE_KEY][rejectedFieldPath]).toBe('12');
    expect(inputRuntimeStore.getState().sections[PAGE_KEY]).toBeNull();
  });

  it('rydder ikke en nyere rejected tekst med et gammelt staged clear', () => {
    const runtime = initializePersistenceRuntime();
    const initialValues = createErstatningsopgoerelseInitialValues();
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <FormPersistenceProvider runtime={runtime}>{children}</FormPersistenceProvider>
    );
    const { result } = renderHook(
      () => usePersistedForm(erstatningsopgoerelseSchema, PAGE_KEY, initialValues),
      { wrapper }
    );

    executeInputTransaction({
      kind: 'changeRejectedInputs',
      changes: [{ pageKey: PAGE_KEY, fieldPath: rejectedFieldPath, draft: 'nyere' }],
    }, { origin });
    stageLegacyGridRejectedClear({
      section: PAGE_KEY,
      undoFieldPath,
      clear: { pageKey: PAGE_KEY, fieldPath: rejectedFieldPath, expectedRaw: 'gammel' },
    });
    act(() => {
      result.current.setValues(
        (previous) => ({ ...previous, eoLedsagetekst: 'ændret' }),
        { fieldPath: undoFieldPath }
      );
    });

    expect(inputRuntimeStore.getState().invalidDrafts[PAGE_KEY][rejectedFieldPath]).toBe('nyere');
  });

  it('forveksler ikke samme rowId og kolonne på tværs af tabeller', () => {
    const otherFieldPath = 'anden-tabel::row-1:2';
    stageLegacyGridRejectedClear({
      section: PAGE_KEY,
      undoFieldPath,
      clear: { pageKey: PAGE_KEY, fieldPath: rejectedFieldPath, expectedRaw: '12' },
    });
    stageLegacyGridRejectedClear({
      section: PAGE_KEY,
      undoFieldPath,
      clear: { pageKey: PAGE_KEY, fieldPath: otherFieldPath, expectedRaw: '12' },
    });

    expect(consumeLegacyGridRejectedClear(PAGE_KEY, undoFieldPath)).toBeUndefined();
    cancelLegacyGridRejectedClear(PAGE_KEY, otherFieldPath);
    expect(consumeLegacyGridRejectedClear(PAGE_KEY, undoFieldPath)?.fieldPath).toBe(rejectedFieldPath);
  });
});
