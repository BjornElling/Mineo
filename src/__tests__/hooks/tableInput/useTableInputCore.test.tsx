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

const createTextAdapter = (): TableInputAdapter<string, string, ReturnType<typeof makeStringFingerprintFromCanonical>> => ({
  ...createAdapter(),
  preserveInvalidDraft: false,
});

const createVisualErrorAdapter = (): TableInputAdapter<string, string, ReturnType<typeof makeStringFingerprintFromCanonical>> => ({
  ...createAdapter(),
  parse: (draft) => {
    const trimmed = draft.trim();
    if (trimmed === 'bad') return { ok: false, errorMessage: 'Ugyldig værdi' };
    if (trimmed === '9') return { ok: true, value: trimmed, visualErrorMessage: 'Værdien er uden for intervallet' };
    return { ok: true, value: trimmed };
  },
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
  it('blur med lukket editor fokuserer kun og markerer ikke feltet touched', () => {
    const onBlur = vi.fn();
    const { result } = renderHook(
      () =>
        useTableInputCore({
          adapter: createAdapter(),
          gridCell,
          value: '42',
          onBlur,
        }),
      { wrapper: createWrapper(null) }
    );

    act(() => {
      result.current.handleFocus();
    });
    act(() => {
      result.current.handleBlur({ currentTarget: { value: '42', readOnly: true } } as React.FocusEvent<HTMLInputElement>);
    });

    expect(onBlur).not.toHaveBeenCalled();
    expect(result.current.touched).toBe(false);
    expect(result.current.showError).toBe(false);
  });

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

  it('rydder inputfejl og emitter onErrorChange når brugeren begynder at rette draften', () => {
    const onErrorChange = vi.fn();
    const { result } = renderHook(
      () =>
        useTableInputCore({
          adapter: { ...createAdapter(), clearErrorOnChange: true },
          gridCell,
          value: '',
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
    expect(onErrorChange).toHaveBeenLastCalledWith({ hasError: true, kind: 'input' });

    act(() => {
      result.current.handleChange({ target: { value: 'b' } } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.hasError).toBe(false);
    expect(onErrorChange).toHaveBeenLastCalledWith({ hasError: false, kind: 'none' });
  });

  it('viser visualErrorMessage afledt fra committed value uden effect-baseret resync', () => {
    const onBlur = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) =>
        useTableInputCore({
          adapter: createVisualErrorAdapter(),
          gridCell,
          value,
          onBlur,
        }),
      {
        initialProps: { value: '' },
        wrapper: createWrapper(gridCell),
      }
    );

    act(() => {
      result.current.handleChange({ target: { value: '9' } } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
      result.current.handleBlur({ currentTarget: { value: '9' } } as React.FocusEvent<HTMLInputElement>);
    });

    expect(onBlur).toHaveBeenCalledWith({ target: { value: '9' } });
    rerender({ value: '9' });

    expect(result.current.hasError).toBe(true);
    expect(result.current.errorMessage).toBe('Værdien er uden for intervallet');

    rerender({ value: '5' });

    expect(result.current.hasError).toBe(false);
    expect(result.current.errorMessage).toBe('');
  });

  it('overskriver ikke draft når committed value ændres udefra mens editoren er åben', () => {
    const { result, rerender } = renderHook(
      ({ value }) =>
        useTableInputCore({
          adapter: createAdapter(),
          gridCell,
          value,
        }),
      {
        initialProps: { value: 'start' },
        wrapper: createWrapper(gridCell),
      }
    );

    act(() => {
      result.current.handleChange({ target: { value: 'lokal draft' } } as React.ChangeEvent<HTMLInputElement>);
    });
    rerender({ value: 'ekstern' });

    expect(result.current.draft).toBe('lokal draft');
  });

  it('resyncer til committed value for adaptere uden invalid-draft preservation', () => {
    const { result, rerender } = renderHook(
      ({ value }) =>
        useTableInputCore({
          adapter: createTextAdapter(),
          gridCell,
          value,
        }),
      {
        initialProps: { value: 'start' },
        wrapper: createWrapper(null),
      }
    );

    rerender({ value: 'ekstern' });

    expect(result.current.draft).toBe('ekstern');
  });
});
