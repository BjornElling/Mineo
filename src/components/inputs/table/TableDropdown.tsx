import * as React from 'react';
import { Divider, MenuItem, Select, Tooltip, type SelectChangeEvent } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { assignRef } from './assignRef';
import { useGridCoreApi } from '../../tables/gridCoreContext';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCoreTypes';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';

/**
 * TableDropdown (table-cell select)
 *
 * Cross-cutting navigation contract:
 * - The wrapper sets `data-mineo-table-dropdown="true"` so table keyboard navigation can detect this widget.
 * - `src/components/tables/tableKeyboardNavigation.ts` has a special-case:
 *     - Enter on a TableDropdown must open the menu (do NOT trigger table-level Enter navigation).
 * - This component must NOT intercept Tab; Tab is handled by table- or container-level navigation.
 * - We only intercept Delete/Backspace (when allowEmpty) to clear the selection, and only when the menu is closed.
 *
 * If you change the wrapper attribute or key handling, review `tableKeyboardNavigation.ts` as well.
 */
export type TableDropdownValueOption = Readonly<{ value: string; label: string }>;
export type TableDropdownDividerOption = Readonly<{ kind: 'divider'; id: string }>;
export type TableDropdownOption = TableDropdownValueOption | TableDropdownDividerOption;

export type TableDropdownChangeEvent = Readonly<{ target: { value: string } }>;

type TableDropdownPropsAllowEmpty = Readonly<{
  allowEmpty?: true;
  value?: string;
  placeholder?: string;
}>;

type TableDropdownPropsNoEmpty = Readonly<{
  allowEmpty: false;
  value: string;
  placeholder?: never;
}>;

export type TableDropdownProps = (TableDropdownPropsAllowEmpty | TableDropdownPropsNoEmpty) &
  Readonly<{
    gridCell?: GridCellCoord;
    readOnly?: boolean;
    /**
     * Visual style variant.
     *
     * - `grid`: compact/flat look intended for HTML-grid tables.
     * - `loose`: outlined look matching `Styled*Field` inputs (used in MUI "loose" tables).
     */
    appearance?: 'grid' | 'loose';
    options: readonly TableDropdownOption[];
    onChange?: (e: TableDropdownChangeEvent) => void;
    onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
    externalErrorMessage?: string;
    inputRef?: React.Ref<HTMLElement>;
    sx?: SxProps<Theme>;
  }>;

const TableDropdown = React.memo(
  ({
    gridCell,
    value,
    readOnly = false,
    appearance = 'grid',
    placeholder = 'Vælg...',
    options,
    onChange,
    onBlur,
    externalErrorMessage,
    inputRef,
    sx,
    ...rest
  }: TableDropdownProps) => {
    const wrapperRef = React.useRef<HTMLSpanElement | null>(null);

    const getTriggerAndListbox = React.useCallback((): { trigger: HTMLElement | null; listbox: HTMLElement | null } => {
      const host = wrapperRef.current;
      const trigger = host?.querySelector('[role="combobox"]') as HTMLElement | null;
      const controlsId = trigger?.getAttribute('aria-controls') ?? null;
      const listbox = controlsId ? document.getElementById(controlsId) : null;
      return { trigger, listbox: listbox instanceof HTMLElement ? listbox : null };
    }, []);

    const ensureMenuKeyboardFocus = React.useCallback((fromNode?: Element | null) => {
      const fromNodeListbox = fromNode instanceof Element
        ? (fromNode.querySelector('[role="listbox"]') as HTMLElement | null)
        : null;
      const { listbox: triggerListbox } = getTriggerAndListbox();
      const listbox = fromNodeListbox ?? triggerListbox;
      if (!listbox) return;

      const selectedOption = listbox.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
      const tabbableOption = listbox.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
      const firstOption = listbox.querySelector<HTMLElement>('[role="option"]');
      const target = tabbableOption ?? selectedOption ?? firstOption ?? listbox;

      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    }, [getTriggerAndListbox]);

    const grid = useGridCoreApi();
    const menuHighlightColor = 'rgba(25, 118, 210, 0.08)';
    const isLooseTable = grid.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'rgba(0, 0, 0, 0.12)' : 'transparent';
    const allowEmpty: boolean = (rest as Readonly<{ allowEmpty?: boolean }>).allowEmpty ?? true;

    if (import.meta.env.DEV && allowEmpty === false && (value === undefined || value.trim() === '')) {
      throw new Error('TableDropdown: value is required when allowEmpty=false');
    }

    const isDividerOption = React.useCallback((option: TableDropdownOption): option is TableDropdownDividerOption => {
      return 'kind' in option && option.kind === 'divider';
    }, []);

    const handleChange = React.useCallback(
      (event: SelectChangeEvent<string>) => {
        if (readOnly) return;
        onChange?.({ target: { value: event.target.value } });
      },
      [onChange, readOnly]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLElement>) => {
        if (readOnly) return;

        const activeEl = (e.target instanceof HTMLElement ? e.target : null) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        const expandedHost = activeEl?.closest('[aria-expanded]') as HTMLElement | null;
        const expanded = expandedHost?.getAttribute('aria-expanded') === 'true';
        if (expanded) return;

        if (e.key === 'Backspace' || e.key === 'Delete') {
          // In table context, Delete is normally handled at table-capture level first.
          // Keep this as a defensive fallback for isolated/non-table usage.
          if (!allowEmpty) return;
          e.preventDefault();
          e.stopPropagation();
          onChange?.({ target: { value: '' } });
          return;
        }

        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key.length !== 1) return;
        const trimmedKey = e.key.trim();
        if (trimmedKey.length !== 1) return;

        const normalizedKey = trimmedKey.toLocaleLowerCase('da-DK');
        const matchingIndices: number[] = [];
        options.forEach((opt, index) => {
          if (isDividerOption(opt)) return;
          const label = opt.label.trim();
          if (label.length === 0) return;
          const firstChar = label.charAt(0).toLocaleLowerCase('da-DK');
          if (firstChar === normalizedKey) {
            matchingIndices.push(index);
          }
        });

        if (matchingIndices.length === 0) return;

        const currentIndex = typeof value === 'string'
          ? options.findIndex((opt) => !isDividerOption(opt) && opt.value === value)
          : -1;
        const currentPos = matchingIndices.indexOf(currentIndex);
        const nextPos = currentPos === -1 ? 0 : (currentPos + 1) % matchingIndices.length;
        const nextOption = options[matchingIndices[nextPos]];
        if (!nextOption || isDividerOption(nextOption)) return;
        const nextValue = nextOption.value;
        if (typeof nextValue !== 'string') return;

        e.preventDefault();
        e.stopPropagation();
        onChange?.({ target: { value: nextValue } });
      },
      [allowEmpty, isDividerOption, onChange, options, readOnly, value]
    );

    const a11yErrorId = React.useId();
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const showError = externalErrorText !== '';

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => {
          const host = wrapperRef.current;
          if (!host) return null;
          const trigger = host.querySelector('[role="combobox"]');
          return trigger instanceof HTMLElement ? trigger : host;
        },
        getIsLocked: () => readOnly,
        commitCurrent: () => true,
        clearAndCommit: () => {
          if (readOnly || !allowEmpty) return;
          onChange?.({ target: { value: '' } });
        },
        cancelEdit: () => {
          grid.closeEditing();
        },
        prepareEditFromKey: () => false,
        selectAll: () => {
          // no-op for dropdown
        },
      };
    }, [allowEmpty, grid, onChange, readOnly]);

    React.useEffect(() => {
      if (!gridCell) return;
      grid.registerEditor(gridCell, editorHandle);
      return () => {
        grid.unregisterEditor(gridCell);
      };
    }, [editorHandle, grid, gridCell]);

    return (
      <Tooltip title={showError ? externalErrorText : ''} arrow placement="top">
        <span
          data-mineo-table-dropdown="true"
          style={{ display: 'block' }}
          onKeyDownCapture={handleKeyDown}
          ref={(el) => {
            wrapperRef.current = el;
            assignRef(inputRef, el);
          }}
        >
          <Select
            value={value ?? ''}
            onChange={handleChange}
            onBlur={onBlur}
            MenuProps={{
              variant: 'selectedMenu',
              // Keep focus off Menu paper/root; focus is set explicitly in `onEntered`.
              autoFocus: false,
              disableAutoFocusItem: false,
              slotProps: {
                transition: {
                  onEntered: (enteredNode: unknown) => {
                    const nodeElement = enteredNode instanceof Element ? enteredNode : null;
                    ensureMenuKeyboardFocus(nodeElement);
                    requestAnimationFrame(() => ensureMenuKeyboardFocus(nodeElement));
                  },
                },
                paper: {
                  sx: {
                    '& .MuiMenuItem-root.Mui-focusVisible': {
                      backgroundColor: menuHighlightColor,
                    },
                    '& .MuiMenuItem-root.Mui-selected': {
                      backgroundColor: menuHighlightColor,
                    },
                    '& .MuiMenuItem-root.Mui-selected:hover': {
                      backgroundColor: menuHighlightColor,
                    },
                    '& .MuiMenuItem-root:hover': {
                      backgroundColor: menuHighlightColor,
                    },
                  },
                },
                list: {
                  autoFocusItem: true,
                },
              },
            }}
            // Note: MUI Select key handling differs by variant/implementation.
            // Capture handler on the wrapper is the single source of truth for clear-on-Delete.
            displayEmpty={allowEmpty}
            size="small"
            variant={appearance === 'loose' ? 'outlined' : 'standard'}
            disabled={readOnly}
            inputProps={{
              'aria-describedby': showError ? a11yErrorId : undefined,
            }}
            sx={{
              width: '100%',
              fontSize: '13px',
              fontFamily: '"Montserrat", sans-serif',
              color: 'inherit',
              fontFeatureSettings: '"tnum"',
              ...(appearance === 'loose'
                ? {
                    backgroundColor: '#ffffff',
                    borderRadius: inputBorderRadius,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: showError ? '#d32f2f' : inputBorderColor,
                      borderWidth: '1px',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: showError ? '#d32f2f' : 'rgba(0, 0, 0, 0.25)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#1976d2',
                      borderWidth: '1px',
                    },
                    '& .MuiSelect-select:focus': {
                      backgroundColor: 'transparent',
                    },
                  }
                : {
                    height: '100%',
                    border: '1px solid',
                    borderColor: showError ? '#d32f2f' : inputBorderColor,
                    borderRadius: inputBorderRadius,
                    '&:focus-within': {
                      borderColor: '#1976d2',
                    },
                  }),
              ...(appearance === 'grid'
                ? {
                    '& .MuiSelect-select': {
                      paddingTop: '4px',
                      paddingBottom: '4px',
                      paddingLeft: '8px',
                      paddingRight: '24px',
                    },
                  }
                : {}),
              '& .MuiInputBase-input': {
                font: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'inherit',
              },
              '&:before': { display: 'none' },
              '&:after': { display: 'none' },
              ...sx,
            }}
          >
            {allowEmpty ? (
              <MenuItem value="">
                <em style={{ color: 'rgba(0,0,0,0.4)' }}>{placeholder}</em>
              </MenuItem>
            ) : null}
            {options.map((opt) => {
              if (isDividerOption(opt)) {
                return <Divider key={opt.id} component="li" role="separator" />;
              }
              return (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              );
            })}
          </Select>
          {showError ? (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {externalErrorText}
            </span>
          ) : null}
        </span>
      </Tooltip>
    );
  }
);

TableDropdown.displayName = 'TableDropdown';

export default TableDropdown;
