import * as React from 'react';
import { MenuItem, Select, type SelectChangeEvent } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

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
export type TableDropdownOption = Readonly<{ value: string; label: string }>;

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
    sx?: SxProps<Theme>;
  }>;

const TableDropdown = React.memo(
  ({
    value,
    readOnly = false,
    appearance = 'grid',
    placeholder = 'Vælg...',
    options,
    onChange,
    onBlur,
    sx,
    ...rest
  }: TableDropdownProps) => {
    const allowEmpty: boolean = (rest as Readonly<{ allowEmpty?: boolean }>).allowEmpty ?? true;

    if (import.meta.env.DEV && allowEmpty === false && (value === undefined || value.trim() === '')) {
      throw new Error('TableDropdown: value is required when allowEmpty=false');
    }

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
        if (!allowEmpty) return;
        if (e.key !== 'Backspace' && e.key !== 'Delete') return;

        const activeEl = (e.target instanceof HTMLElement ? e.target : null) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        const expandedHost = activeEl?.closest('[aria-expanded]') as HTMLElement | null;
        const expanded = expandedHost?.getAttribute('aria-expanded') === 'true';
        if (expanded) return;

        e.preventDefault();
        e.stopPropagation();
        onChange?.({ target: { value: '' } });
      },
      [allowEmpty, onChange, readOnly]
    );

    return (
      <span data-mineo-table-dropdown="true" style={{ display: 'block' }} onKeyDownCapture={handleKeyDown}>
        <Select
          value={value ?? ''}
          onChange={handleChange}
          onBlur={onBlur}
          // Note: MUI Select key handling differs by variant/implementation.
          // Capture handler on the wrapper is the single source of truth for clear-on-Delete.
          displayEmpty={allowEmpty}
          size="small"
          variant={appearance === 'loose' ? 'outlined' : 'standard'}
          disabled={readOnly}
          sx={{
            width: '100%',
            fontSize: '13px',
            fontFamily: '"Montserrat", sans-serif',
            color: 'inherit',
            fontFeatureSettings: '"tnum"',
            ...(appearance === 'loose'
              ? {
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.12)',
                    borderWidth: '1px',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 0, 0, 0.25)',
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
                  borderColor: 'transparent',
                  borderRadius: '4px',
                  '&:focus-within': {
                    borderColor: 'primary.main',
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
          {options.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </span>
    );
  }
);

TableDropdown.displayName = 'TableDropdown';

export default TableDropdown;
