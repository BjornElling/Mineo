import * as React from 'react';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import TableDropdown from '../../../components/inputs/table/TableDropdown';
import { GridCoreProvider } from '../../../components/tables/gridCore/gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle } from '../../../components/tables/gridCore/gridCoreTypes';
import userEvent from '@testing-library/user-event';

describe('TableDropdown GridCore integration', () => {
  it('registrerer editor-handle når gridCell er sat', () => {
    const gridCell: GridCellCoord = { rowId: 'r1', colIndex: 4 };
    const registerEditor = vi.fn<(cell: GridCellCoord, handle: GridCellEditorHandle) => void>();
    const unregisterEditor = vi.fn<(cell: GridCellCoord) => void>();

    const { unmount } = render(
      <GridCoreProvider
        value={{
          focusedCell: null,
          editingCell: null,
          openEditing: vi.fn(),
          closeEditing: vi.fn(),
          registerEditor,
          unregisterEditor,
          getEditor: vi.fn().mockReturnValue(null),
          requestFocusPlan: vi.fn(),
        }}
      >
        <TableDropdown
          gridCell={gridCell}
          value=""
          options={[{ value: 'a', label: 'A' }]}
        />
      </GridCoreProvider>
    );

    expect(registerEditor).toHaveBeenCalledTimes(1);
    expect(registerEditor).toHaveBeenCalledWith(gridCell, expect.objectContaining({ getElement: expect.any(Function) }));

    const registeredHandle = registerEditor.mock.calls[0]?.[1];
    expect(registeredHandle?.getIsLocked()).toBe(false);
    expect(registeredHandle?.prepareEditFromKey('a')).toBe(false);
    expect(registeredHandle?.commitCurrent()).toBe(true);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
    expect(registeredHandle?.getElement()).toBe(trigger);

    unmount();
    expect(unregisterEditor).toHaveBeenCalledTimes(1);
    expect(unregisterEditor).toHaveBeenCalledWith(gridCell);
  });

  it('clearAndCommit rydder kun når allowEmpty=true', () => {
    const gridCell: GridCellCoord = { rowId: 'r1', colIndex: 4 };
    const registerEditor = vi.fn<(cell: GridCellCoord, handle: GridCellEditorHandle) => void>();
    const onChange = vi.fn();

    const { rerender } = render(
      <GridCoreProvider
        value={{
          focusedCell: null,
          editingCell: null,
          openEditing: vi.fn(),
          closeEditing: vi.fn(),
          registerEditor,
          unregisterEditor: vi.fn(),
          getEditor: vi.fn().mockReturnValue(null),
          requestFocusPlan: vi.fn(),
        }}
      >
        <TableDropdown
          gridCell={gridCell}
          value="a"
          allowEmpty={false}
          options={[{ value: 'a', label: 'A' }]}
          onChange={onChange}
        />
      </GridCoreProvider>
    );

    const nonEmptyHandle = registerEditor.mock.calls[0]?.[1];
    nonEmptyHandle?.clearAndCommit();
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <GridCoreProvider
        value={{
          focusedCell: null,
          editingCell: null,
          openEditing: vi.fn(),
          closeEditing: vi.fn(),
          registerEditor,
          unregisterEditor: vi.fn(),
          getEditor: vi.fn().mockReturnValue(null),
          requestFocusPlan: vi.fn(),
        }}
      >
        <TableDropdown
          gridCell={gridCell}
          value="a"
          allowEmpty
          options={[{ value: 'a', label: 'A' }]}
          onChange={onChange}
        />
      </GridCoreProvider>
    );

    const emptyHandle = registerEditor.mock.calls[registerEditor.mock.calls.length - 1]?.[1];
    emptyHandle?.clearAndCommit();
    expect(onChange).toHaveBeenCalledWith({ target: { value: '' } });
  });

  it('kopierer den viste label fra focused table dropdown', async () => {
    const user = userEvent.setup();

    render(
      <GridCoreProvider
        value={{
          focusedCell: null,
          editingCell: null,
          openEditing: vi.fn(),
          closeEditing: vi.fn(),
          registerEditor: vi.fn(),
          unregisterEditor: vi.fn(),
          getEditor: vi.fn().mockReturnValue(null),
          requestFocusPlan: vi.fn(),
        }}
      >
        <TableDropdown
          value="a"
          options={[{ value: 'a', label: 'Alfa' }]}
        />
      </GridCoreProvider>
    );

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    const clipboardData = {
      setData: vi.fn(),
    };
    const copyEvent = createEvent.copy(trigger);
    Object.defineProperty(copyEvent, 'clipboardData', { value: clipboardData });

    fireEvent(trigger, copyEvent);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', 'Alfa');
    expect(copyEvent.defaultPrevented).toBe(true);
  });

  it('vælger matching option ved paste af præcis label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <GridCoreProvider
        value={{
          focusedCell: null,
          editingCell: null,
          openEditing: vi.fn(),
          closeEditing: vi.fn(),
          registerEditor: vi.fn(),
          unregisterEditor: vi.fn(),
          getEditor: vi.fn().mockReturnValue(null),
          requestFocusPlan: vi.fn(),
        }}
      >
        <TableDropdown
          value="a"
          options={[
            { value: 'a', label: 'Alfa' },
            { value: 'b', label: 'Beta' },
          ]}
          onChange={onChange}
        />
      </GridCoreProvider>
    );

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    await user.paste(trigger, 'Beta');

    expect(onChange).toHaveBeenCalledWith({ target: { value: 'b' } });
  });
});
