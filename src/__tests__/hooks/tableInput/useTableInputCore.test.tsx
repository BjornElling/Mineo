import * as React from 'react';
import { act, renderHook } from '@testing-library/react';

import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle } from '../../../components/tables/gridCore/gridCoreTypes';
import { makeStringFingerprintFromCanonical } from '../../../types/parserSpec';
import type { TableInputAdapter } from '../../../hooks/tableInput';
import { useTableInputCore } from '../../../hooks/tableInput';
import { createGridCoreTestStateStore } from '../../components/inputs/gridCoreTestUtils';

const gridCell: GridCellCoord = { rowId: 'row-1', colIndex: 0 };

const createAdapter = (): TableInputAdapter<string, string, ReturnType<typeof makeStringFingerprintFromCanonical>> => ({
  format: (value) => value,
  parse: (draft) => {
    const trimmed = draft.trim();
    if (trimmed === 'bad') return { ok: false, errorMessage: 'Ugyldig værdi' };
    return { ok: true, value: trimmed };
  },
  toCommittedPayload: (value) => ({
    model: value,
    canonical: value,
    fingerprint: makeStringFingerprintFromCanonical(value),
  }),
  isValidStartKey: (key) => key.length === 1,
  preserveInvalidDraft: true,
  useSaveError: true,
});

const createWrapper = (
  editingCell: GridCellCoord | null,
  onRegisterEditor?: (handle: GridCellEditorHandle) => void
) => {
  const Wrapper = ({ children }: React.PropsWithChildren) => (
    <GridCoreProvider
      value={{
        gridStateStore: createGridCoreTestStateStore(gridCell, editingCell),
        openEditing: vi.fn(),
        closeEditing: vi.fn(),
        registerEditor: (_cell, handle) => onRegisterEditor?.(handle),
        unregisterEditor: vi.fn(),
        getEditor: vi.fn().mockReturnValue(null),
        requestFocusPlan: vi.fn(),
      }}
    >
      {children}
    </GridCoreProvider>
  );
  return Wrapper;
};

describe('useTableInputCore', () => {
  it('emitter ikke onBlur ved no-op, men rydder en tidligere lokal inputfejl', () => {
    const onBlur = vi.fn();
    const onErrorChange = vi.fn();
    const { result } = renderHook(
      () =>
        useTableInputCore({
          adapter: createAdapter(),
          gridCell,
          value: '42',
          onBlur,
          onErrorChange,
        }),
      { wrapper: createWrapper(gridCell) }
    );

    act(() => {
      result.current.handleChange({ target: { value: 'bad' } } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
      result.current.handleBlur({ currentTarget: { value: 'bad' } } as React.FocusEvent<HTMLInputElement>);
    });
    expect(result.current.hasError).toBe(true);

    act(() => {
      result.current.handleChange({ target: { value: '42' } } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
      result.current.handleBlur({ currentTarget: { value: '42' } } as React.FocusEvent<HTMLInputElement>);
    });

    expect(onBlur).not.toHaveBeenCalled();
    expect(onErrorChange).toHaveBeenLastCalledWith({ hasError: false, kind: 'none' });
  });

  it('holder onChange som draft-kanal og onBlur som commit-kanal', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const { result } = renderHook(
      () =>
        useTableInputCore({
          adapter: createAdapter(),
          gridCell,
          value: '',
          onChange,
          onBlur,
        }),
      { wrapper: createWrapper(gridCell) }
    );

    act(() => {
      result.current.handleChange({ target: { value: ' 123 ' } } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(onChange).toHaveBeenCalledWith({ target: { value: ' 123 ' } });
    expect(onBlur).not.toHaveBeenCalled();

    act(() => {
      result.current.handleBlur({ currentTarget: { value: ' 123 ' } } as React.FocusEvent<HTMLInputElement>);
    });

    expect(onBlur).toHaveBeenCalledWith({ target: { value: '123' } });
  });
});
