import * as React from 'react';
import { act, renderHook } from '@testing-library/react';

import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle, GridCoreStateStore } from '../../../components/tables/gridCore/gridCoreTypes';
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

const createRequiredAdapter = (): TableInputAdapter<string, string, ReturnType<typeof makeStringFingerprintFromCanonical>> => ({
  ...createAdapter(),
  parse: (draft) => {
    const trimmed = draft.trim();
    if (trimmed === '') return { ok: false, errorMessage: 'Værdi mangler' };
    return { ok: true, value: trimmed };
  },
});

const createVisualErrorAdapter = (): TableInputAdapter<string, string, ReturnType<typeof makeStringFingerprintFromCanonical>> => ({
  ...createAdapter(),
  parse: (draft) => {
    const trimmed = draft.trim();
    if (trimmed === 'bad') return { ok: false, errorMessage: 'Ugyldig værdi' };
    if (trimmed === '9') return { ok: true, value: trimmed, visualErrorMessage: 'Værdien er uden for intervallet' };
    return { ok: true, value: trimmed };
  },
  getCommittedVisualError: (value) => {
    if (value === '9') return 'Værdien er uden for intervallet';
    return '';
  },
});

const createWrapper = (
  editingCell: GridCellCoord | null,
  onRegisterEditor?: (handle: GridCellEditorHandle) => void,
  options: Readonly<{ closeEditing?: () => void }> = {}
) => {
  const Wrapper = ({ children }: React.PropsWithChildren) => (
    <GridCoreProvider
      value={{
        gridStateStore: createGridCoreTestStateStore(gridCell, editingCell),
        openEditing: vi.fn(),
        closeEditing: options.closeEditing ?? vi.fn(),
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

const createMutableGridWrapper = (
  state: { editingCell: GridCellCoord | null },
  onRegisterEditor?: (handle: GridCellEditorHandle) => void
) => {
  const store: GridCoreStateStore = {
    subscribe: () => () => undefined,
    getFocusedCell: () => gridCell,
    getEditingCell: () => state.editingCell,
  };

  const Wrapper = ({ children }: React.PropsWithChildren) => (
    <GridCoreProvider
      value={{
        gridStateStore: store,
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
  it('udstiller stabil HTML-identitet fra grid-cellen', () => {
    const { result } = renderHook(
      () =>
        useTableInputCore({
          adapter: createAdapter(),
          gridCell,
          value: '42',
        }),
      { wrapper: createWrapper(null) }
    );

    expect(result.current.gridCellKey).toBe('row-1:0');
    expect(result.current.htmlInputName).toBe('row-1:0');
    expect(result.current.a11yInputId).not.toBe('');
  });

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
    const onErrorChange = vi.fn();
    const gridState = { editingCell: gridCell as GridCellCoord | null };
    const { result, rerender } = renderHook(
      ({ value }) =>
        useTableInputCore({
          adapter: createVisualErrorAdapter(),
          gridCell,
          value,
          onBlur,
          onErrorChange,
        }),
      {
        initialProps: { value: '' },
        wrapper: createMutableGridWrapper(gridState),
      }
    );

    act(() => {
      result.current.handleChange({ target: { value: '9' } } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
      result.current.handleBlur({ currentTarget: { value: '9' } } as React.FocusEvent<HTMLInputElement>);
    });

    expect(onBlur).toHaveBeenCalledWith({ target: { value: '9' } });
    expect(onErrorChange).toHaveBeenLastCalledWith({ hasError: true, kind: 'visual' });
    act(() => {
      gridState.editingCell = null;
    });
    rerender({ value: '9' });

    expect(result.current.hasError).toBe(true);
    expect(result.current.errorMessage).toBe('Værdien er uden for intervallet');
    expect(onErrorChange).toHaveBeenLastCalledWith({ hasError: true, kind: 'visual' });

    rerender({ value: '5' });

    expect(result.current.hasError).toBe(false);
    expect(result.current.errorMessage).toBe('');
  });

  it('rydder stale visual-only state når committed value ændres udefra', () => {
    let editorHandle: GridCellEditorHandle | null = null;
    const gridState = { editingCell: gridCell as GridCellCoord | null };
    const { result, rerender } = renderHook(
      ({ value }) =>
        useTableInputCore({
          adapter: createVisualErrorAdapter(),
          gridCell,
          value,
        }),
      {
        initialProps: { value: '' },
        wrapper: createMutableGridWrapper(gridState, (handle) => {
          editorHandle = handle;
        }),
      }
    );

    act(() => {
      result.current.handleChange({ target: { value: '9' } } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
      result.current.handleBlur({ currentTarget: { value: '9' } } as React.FocusEvent<HTMLInputElement>);
    });
    rerender({ value: '9' });
    rerender({ value: '5' });

    act(() => {
      gridState.editingCell = null;
    });
    rerender({ value: '5' });
    act(() => {
      gridState.editingCell = gridCell;
    });
    rerender({ value: '5' });

    expect(editorHandle).not.toBeNull();
    expect(result.current.draft).toBe('5');
    expect(result.current.hasError).toBe(false);
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

  it('editorHandle.commitCurrent committer den aktuelle draft og lukker editoren', () => {
    let editorHandle: GridCellEditorHandle | null = null;
    const onBlur = vi.fn();
    const closeEditing = vi.fn();
    const { result } = renderHook(
      () =>
        useTableInputCore({
          adapter: createAdapter(),
          gridCell,
          value: '42',
          onBlur,
        }),
      {
        wrapper: createWrapper(gridCell, (handle) => {
          editorHandle = handle;
        }, { closeEditing }),
      }
    );

    act(() => {
      result.current.handleChange({ target: { value: ' 55 ' } } as React.ChangeEvent<HTMLInputElement>);
    });

    let accepted = false;
    act(() => {
      accepted = editorHandle?.commitCurrent() ?? false;
    });

    expect(accepted).toBe(true);
    expect(onBlur).toHaveBeenCalledWith({ target: { value: '55' } });
    expect(closeEditing).toHaveBeenCalledTimes(1);
  });

  it('committer stadig blur når GridCore lukker editoren før input-blur', () => {
    const onBlur = vi.fn();
    const gridState = { editingCell: gridCell as GridCellCoord | null };
    const { result, rerender } = renderHook(
      () =>
        useTableInputCore({
          adapter: createAdapter(),
          gridCell,
          value: '',
          onBlur,
        }),
      {
        wrapper: createMutableGridWrapper(gridState),
      }
    );

    act(() => {
      result.current.handleChange({ target: { value: ' 55 ' } } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
      gridState.editingCell = null;
    });
    rerender();

    act(() => {
      result.current.handleBlur({ currentTarget: { value: '', readOnly: true } } as React.FocusEvent<HTMLInputElement>);
    });

    expect(onBlur).toHaveBeenCalledWith({ target: { value: '55' } });
  });

  it('editorHandle.clearAndCommit rydder og committer tom værdi', () => {
    let editorHandle: GridCellEditorHandle | null = null;
    const onBlur = vi.fn();
    const closeEditing = vi.fn();
    const { result } = renderHook(
      () =>
        useTableInputCore({
          adapter: createAdapter(),
          gridCell,
          value: '42',
          onBlur,
        }),
      {
        wrapper: createWrapper(gridCell, (handle) => {
          editorHandle = handle;
        }, { closeEditing }),
      }
    );

    act(() => {
      editorHandle?.clearAndCommit();
    });

    expect(result.current.draft).toBe('');
    expect(onBlur).toHaveBeenCalledWith({ target: { value: '' } });
    expect(closeEditing).toHaveBeenCalledTimes(1);
  });

  it('editorHandle.clearAndCommit lukker ikke editoren når tom commit afvises', () => {
    let editorHandle: GridCellEditorHandle | null = null;
    const onBlur = vi.fn();
    const closeEditing = vi.fn();
    const { result } = renderHook(
      () =>
        useTableInputCore({
          adapter: createRequiredAdapter(),
          gridCell,
          value: '42',
          onBlur,
        }),
      {
        wrapper: createWrapper(gridCell, (handle) => {
          editorHandle = handle;
        }, { closeEditing }),
      }
    );

    act(() => {
      editorHandle?.clearAndCommit();
    });

    expect(result.current.draft).toBe('');
    expect(result.current.hasError).toBe(true);
    expect(result.current.errorMessage).toBe('Værdi mangler');
    expect(onBlur).not.toHaveBeenCalled();
    expect(closeEditing).not.toHaveBeenCalled();
  });

  it('editorHandle.cancelEdit gendanner edit-start draften uden commit og rydder lokal inputfejl', () => {
    let editorHandle: GridCellEditorHandle | null = null;
    const onBlur = vi.fn();
    const closeEditing = vi.fn();
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
      {
        wrapper: createWrapper(gridCell, (handle) => {
          editorHandle = handle;
        }, { closeEditing }),
      }
    );

    act(() => {
      result.current.handleChange({ target: { value: 'bad' } } as React.ChangeEvent<HTMLInputElement>);
    });
    let accepted = true;
    act(() => {
      accepted = editorHandle?.commitCurrent() ?? true;
    });
    expect(accepted).toBe(false);
    expect(result.current.hasError).toBe(true);

    act(() => {
      editorHandle?.cancelEdit();
    });

    expect(result.current.draft).toBe('42');
    expect(result.current.hasError).toBe(false);
    expect(onBlur).not.toHaveBeenCalled();
    expect(onErrorChange).toHaveBeenLastCalledWith({ hasError: false, kind: 'none' });
    expect(closeEditing).toHaveBeenCalledTimes(1);
  });

  it('editorHandle.prepareEditFromKey accepterer kun adapterens starttaster og starter ny draft', () => {
    let editorHandle: GridCellEditorHandle | null = null;
    const gridState = { editingCell: null as GridCellCoord | null };
    const { result, rerender } = renderHook(
      () =>
        useTableInputCore({
          adapter: {
            ...createAdapter(),
            isValidStartKey: (key) => /^[0-9]$/.test(key),
            clearErrorOnChange: true,
          },
          gridCell,
          value: '42',
        }),
      {
        wrapper: createMutableGridWrapper(gridState, (handle) => {
          editorHandle = handle;
        }),
      }
    );

    let rejected = true;
    act(() => {
      rejected = editorHandle?.prepareEditFromKey('a') ?? true;
    });
    expect(rejected).toBe(false);
    expect(result.current.draft).toBe('42');

    let accepted = false;
    act(() => {
      accepted = editorHandle?.prepareEditFromKey('7') ?? false;
      gridState.editingCell = gridCell;
    });
    rerender();

    expect(accepted).toBe(true);
    expect(result.current.draft).toBe('7');
    expect(result.current.keyInitiatedEdit).toBe(true);
  });
});
