import * as React from 'react';
import { Divider, MenuItem, Select, Tooltip, type SelectChangeEvent } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { assignRef } from './assignRef';
import { copyTextToClipboard, readClipboardText } from '../../../utils/clipboardUtils';
import { useGridCoreApi } from '../../tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCore/gridCoreTypes';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import StyledDropdown, { type StyledDropdownChangeEvent } from '../StyledDropdown';
import { TABLE_INPUT_HEIGHT, TABLE_INPUT_PADDING_Y } from './tableInputStyles';

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

const TABLE_DROPDOWN_TEXT_PADDING_LEFT = '14px';
const TABLE_DROPDOWN_RESERVED_ICON_WIDTH = '24px';

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
    const [open, setOpen] = React.useState(false);
    const suppressNextClickOpenRef = React.useRef(false);

    const hasTextSelectionWithinWrapper = React.useCallback((): boolean => {
      const host = wrapperRef.current;
      if (!host) return false;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

      try {
        const range = selection.getRangeAt(0);
        return host.contains(range.commonAncestorContainer);
      } catch {
        return false;
      }
    }, []);

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
    const menuHighlightColor = 'var(--color-active-bg)';
    const isLooseTable = grid.tableKind === 'loose';
    const resolvedAppearance = appearance === 'grid' ? (isLooseTable ? 'loose' : 'grid') : appearance;
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'var(--color-input-border)' : 'transparent';
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

    const openMenu = React.useCallback(() => {
      if (readOnly) return;
      setOpen(true);
    }, [readOnly]);

    const closeMenu = React.useCallback(() => {
      setOpen(false);
    }, []);

    const handleTriggerClick = React.useCallback(() => {
      if (suppressNextClickOpenRef.current) {
        suppressNextClickOpenRef.current = false;
        return;
      }
      if (hasTextSelectionWithinWrapper()) return;
      openMenu();
    }, [hasTextSelectionWithinWrapper, openMenu]);

    const handleTriggerMouseUp = React.useCallback(() => {
      suppressNextClickOpenRef.current = hasTextSelectionWithinWrapper();
    }, [hasTextSelectionWithinWrapper]);

    const handleTriggerKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (readOnly) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        openMenu();
      },
      [openMenu, readOnly]
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

    const selectedLabel = React.useMemo(() => {
      const selectedOption = options.find((opt) => !isDividerOption(opt) && opt.value === (value ?? ''));
      return selectedOption && !isDividerOption(selectedOption) ? selectedOption.label : '';
    }, [isDividerOption, options, value]);

    const handleWrapperRef = React.useCallback(
      (el: HTMLSpanElement | null) => {
        wrapperRef.current = el;
        assignRef(inputRef, el);
      },
      [inputRef]
    );

    const findValueByExactLabel = React.useCallback(
      (label: string): string | null => {
        if (allowEmpty && placeholder === label) return '';
        const matched = options.find((opt) => !isDividerOption(opt) && opt.label === label);
        if (!matched || isDividerOption(matched)) return null;
        return matched.value;
      },
      [allowEmpty, isDividerOption, options, placeholder]
    );

    const a11yErrorId = React.useId();
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const showError = externalErrorText !== '';
    const looseDropdownSx: SxProps<Theme> = {
      width: '100%',
      height: TABLE_INPUT_HEIGHT,
      boxSizing: 'border-box',
      fontSize: '13px',
      fontFamily: '"Montserrat", sans-serif',
      color: 'inherit',
      fontFeatureSettings: '"tnum"',
      '& .MuiInputBase-input': {
        font: 'inherit',
        fontSize: 'inherit',
        lineHeight: 'inherit',
        color: 'inherit',
        paddingTop: TABLE_INPUT_PADDING_Y,
        paddingBottom: TABLE_INPUT_PADDING_Y,
        paddingLeft: TABLE_DROPDOWN_TEXT_PADDING_LEFT,
        userSelect: 'text',
        WebkitUserSelect: 'text',
      },
      ...sx,
    };

    const handleLooseChange = React.useCallback(
      (e: StyledDropdownChangeEvent<string | undefined>) => {
        const nextValue = e.target.value;
        onChange?.({ target: { value: nextValue === undefined ? '' : String(nextValue) } });
      },
      [onChange]
    );

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

    const gridCellKey = gridCell ? `${gridCell.rowId}:${gridCell.colIndex}` : null;
    React.useEffect(() => {
      if (!gridCell) return;
      grid.registerEditor(gridCell, editorHandle);
      return () => {
        grid.unregisterEditor(gridCell);
      };
    // gridCellKey er en stabil streng-repræsentation af gridCell-koordinaterne.
    // gridCell er intentionelt udeladt fra dep-arrayet for at undgå re-registrering
    // ved inline object literals i caller (ny reference, samme værdier).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorHandle, grid, gridCellKey]);

    return (
      <Tooltip title={showError ? externalErrorText : ''} arrow placement="top">
        <span
          data-mineo-table-dropdown="true"
          style={{ display: 'block' }}
          onKeyDownCapture={handleKeyDown}
          onCopyCapture={(e) => {
            if (hasTextSelectionWithinWrapper()) return;
            copyTextToClipboard(e, { value: selectedLabel });
          }}
          onPasteCapture={(e) => {
            if (readOnly) return;
            const nextValue = findValueByExactLabel(readClipboardText(e));
            e.preventDefault();
            e.stopPropagation();
            if (nextValue === null) return;
            onChange?.({ target: { value: nextValue } });
          }}
          ref={handleWrapperRef}
        >
          {resolvedAppearance === 'loose' ? (
            allowEmpty ? (
              <StyledDropdown
                width="100%"
                value={(value ?? '') === '' ? undefined : value}
                allowEmpty
                placeholder={placeholder}
                onChange={handleLooseChange}
                onBlur={onBlur}
                error={showError}
                helperText={externalErrorText}
                sx={looseDropdownSx}
              >
                {options.map((opt) => {
                  if (isDividerOption(opt)) {
                    return <StyledDropdown.Divider key={opt.id} />;
                  }
                  return (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  );
                })}
              </StyledDropdown>
            ) : (
              <StyledDropdown
                width="100%"
                value={value ?? ''}
                allowEmpty={false}
                onChange={handleLooseChange}
                onBlur={onBlur}
                error={showError}
                helperText={externalErrorText}
                sx={looseDropdownSx}
              >
                {options.map((opt) => {
                  if (isDividerOption(opt)) {
                    return <StyledDropdown.Divider key={opt.id} />;
                  }
                  return (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  );
                })}
              </StyledDropdown>
            )
          ) : (
            <Select
              open={open}
              value={value ?? ''}
              onChange={handleChange}
              onBlur={onBlur}
              onClose={closeMenu}
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
              // Keep MUI from hijacking `mousedown`; we open explicitly from click/key handlers
              // so closed dropdown text can be selected with the mouse.
              readOnly
              // Note: MUI Select key handling differs by variant/implementation.
              // Capture handler on the wrapper is the single source of truth for clear-on-Delete.
              displayEmpty={allowEmpty}
              SelectDisplayProps={{
                onClick: handleTriggerClick,
                onKeyDown: handleTriggerKeyDown,
                onMouseUp: handleTriggerMouseUp,
              }}
              size="small"
              variant="standard"
              inputProps={{
                tabIndex: readOnly ? -1 : undefined,
                'aria-describedby': showError ? a11yErrorId : undefined,
              }}
              sx={{
                width: '100%',
                height: TABLE_INPUT_HEIGHT,
                boxSizing: 'border-box',
                fontSize: '13px',
                fontFamily: '"Montserrat", sans-serif',
                color: 'inherit',
                fontFeatureSettings: '"tnum"',
                border: '1px solid',
                borderColor: showError ? 'var(--color-input-border-error)' : inputBorderColor,
                borderRadius: inputBorderRadius,
                paddingTop: TABLE_INPUT_PADDING_Y,
                paddingBottom: TABLE_INPUT_PADDING_Y,
                '&:focus-within': {
                  borderColor: 'var(--color-input-border-focus)',
                },
                '& .MuiSelect-select': {
                  minHeight: 'unset',
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: TABLE_DROPDOWN_TEXT_PADDING_LEFT,
                  paddingRight: TABLE_DROPDOWN_RESERVED_ICON_WIDTH,
                  boxSizing: 'border-box',
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                },
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
                  <em style={{ color: 'var(--color-input-placeholder)' }}>{placeholder}</em>
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
          )}
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
