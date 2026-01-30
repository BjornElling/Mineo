import * as React from 'react';
import { Box, MenuItem, OutlinedInput, Popover } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import type { SxProps, Theme } from '@mui/material/styles';

/**
 * StyledDropdown (combobox trigger + popover listbox)
 *
 * This component is part of a cross-cutting keyboard-navigation contract:
 * - It renders an `OutlinedInput` that is intentionally `readOnly` (not free-text), but it must still participate in Tab order.
 * - It exposes `role="combobox"` + `aria-controls`/`aria-expanded` so the app's Container-level Tab/Enter navigation can:
 *   - include the control even though it's readOnly
 *   - detect when the popup is open and avoid hijacking Tab/Enter meant for the widget
 * - When the popover is open and the user presses Tab, we close the popover WITHOUT calling `preventDefault()`;
 *   this preserves normal focus traversal (or table-level Tab navigation), and avoids "Tab eats focus" regressions.
 *
 * If you change any of the above, also review:
 * - `src/components/layout/Container.tsx` (focusable selector + popup-widget detection)
 * - `src/components/tables/tableKeyboardNavigation.ts` (table-level key capture and widget detection)
 */
export type StyledDropdownValue = string | number;

export type StyledDropdownChangeEvent<TValue extends StyledDropdownValue | undefined = string> = {
  target: { name?: string; value: TValue };
};

type StyledDropdownCommonProps<TValue extends StyledDropdownValue> = Omit<
  React.ComponentProps<typeof OutlinedInput>,
  'value' | 'onChange' | 'onBlur' | 'placeholder' | 'sx' | 'error' | 'name' | 'id'
> & {
  placeholder?: string;
  width?: number | string;
  children?: React.ReactNode;
  name?: string;
  error?: boolean;
  /**
   * Optional styling hooks for the popover listbox and its options.
   *
   * Note: this component is not a MUI Select; it renders a custom Popover + MenuItem list.
   */
  listboxSx?: SxProps<Theme>;
  optionSx?: SxProps<Theme>;
  iconSx?: SxProps<Theme>;
  /**
   * Optional single source of truth for how the selected value is displayed in the closed control.
   *
   * If omitted, the component expects option children to be `string | number`.
   */
  getOptionLabel?: (value: TValue) => string;
  returnFocusOnClose?: boolean;
  /**
   * Fired when the dropdown popover closes (interaction ended).
   * This is intentionally separate from `onBlur`, which is a physical blur.
   */
  onClose?: () => void;
  sx?: SxProps<Theme>;
  id?: string;
};

type StyledDropdownPropsAllowEmpty<TValue extends StyledDropdownValue> = {
  allowEmpty?: true;
  value?: TValue | undefined;
  onChange?: (e: StyledDropdownChangeEvent<TValue | undefined>) => void;

  /**
   * Physical blur (focus leaves the control).
   *
   * Note: this is not a "commit" callback; commits happen on selection via `onChange`.
   */
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
};

type StyledDropdownPropsNoEmpty<TValue extends StyledDropdownValue> = {
  allowEmpty: false;
  value: TValue;
  onChange?: (e: StyledDropdownChangeEvent<TValue>) => void;

  /**
   * Physical blur (focus leaves the control).
   *
   * Note: this is not a "commit" callback; commits happen on selection via `onChange`.
   */
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
};

export type StyledDropdownProps<TValue extends StyledDropdownValue> = StyledDropdownCommonProps<TValue> &
  (StyledDropdownPropsAllowEmpty<TValue> | StyledDropdownPropsNoEmpty<TValue>);

type DropdownChild<TValue extends StyledDropdownValue> = React.ReactElement<{ value: TValue; children?: React.ReactNode }>;

const StyledDropdownInner = <TValue extends StyledDropdownValue>(
  {
    value,
    onChange,
    onBlur,
    onClose,
    placeholder = '',
    width = 200,
    children,
    name,
    error = false,
    getOptionLabel,
    allowEmpty = true,
    returnFocusOnClose = true,
    sx,
    listboxSx,
    optionSx,
    iconSx,
    id,
    disabled,
    ...otherProps
  }: StyledDropdownProps<TValue>,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  const [open, setOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const inputElementRef = React.useRef<HTMLInputElement | null>(null);
  const listboxRef = React.useRef<HTMLDivElement | null>(null);

  const autoId = React.useId();
  const resolvedId = id ?? autoId;
  const listboxId = `${resolvedId}-listbox`;

  const childrenArray = React.useMemo(() => {
    return React.Children.toArray(children) as DropdownChild<TValue>[];
  }, [children]);

  const resolvedValue = value as TValue | undefined;

  const hasEmptyOption = allowEmpty && placeholder.trim() !== '';

  const configErrorMessage = React.useMemo(() => {
    const counts = new Map<TValue, number>();
    const duplicates: TValue[] = [];
    for (const child of childrenArray) {
      const v = child.props.value;
      const next = (counts.get(v) ?? 0) + 1;
      counts.set(v, next);
      if (next === 2) duplicates.push(v);
    }

    if (duplicates.length > 0) {
      return `Ugyldig konfiguration: duplicate option values (${duplicates.join(', ')})`;
    }

    if (!allowEmpty && resolvedValue !== undefined) {
      const exists = childrenArray.some((child) => child.props.value === resolvedValue);
      if (!exists) {
        return 'Ugyldig konfiguration: value findes ikke blandt options (allowEmpty=false)';
      }
    }

    return '';
  }, [allowEmpty, childrenArray, resolvedValue]);

  const hasConfigError = configErrorMessage.trim() !== '';

  if (import.meta.env.DEV && hasConfigError) {
    throw new Error(configErrorMessage);
  }

  const { inputProps: userInputProps, ...outlinedInputProps } = otherProps;

  type VisualOption =
    | { kind: 'empty' }
    | { kind: 'value'; value: TValue; key: React.Key; children: React.ReactNode };

  const visualOptions = React.useMemo<VisualOption[]>(() => {
    const mapped: VisualOption[] = childrenArray.map((child, index) => ({
      kind: 'value',
      value: child.props.value,
      key: child.key ?? index,
      children: child.props.children,
    }));

    return hasEmptyOption ? [{ kind: 'empty' }, ...mapped] : mapped;
  }, [childrenArray, hasEmptyOption]);

  const getValueAtVisualIndex = React.useCallback(
    (visualIndex: number): TValue | undefined => {
      const opt = visualOptions[visualIndex];
      if (!opt) return undefined;
      if (opt.kind === 'empty') return undefined;
      return opt.value;
    },
    [visualOptions]
  );

  const selectedIndex = React.useMemo(() => {
    if (resolvedValue === undefined) return hasEmptyOption ? 0 : -1;
    const index = visualOptions.findIndex((opt) => opt.kind === 'value' && opt.value === resolvedValue);
    if (index >= 0) return index;
    // Runtime fallback (PROD): if allowEmpty=false and a value is missing among options,
    // keep keyboard/navigation deterministic by highlighting the first option.
    return hasEmptyOption ? 0 : visualOptions.length > 0 ? 0 : -1;
  }, [hasEmptyOption, resolvedValue, visualOptions]);

  const selectedChild = React.useMemo(() => {
    return childrenArray.find((child) => child.props.value === resolvedValue);
  }, [childrenArray, resolvedValue]);

  const selectedLabel = React.useMemo((): string => {
    if (resolvedValue === undefined) return '';
    if (getOptionLabel) return getOptionLabel(resolvedValue);

    const label = selectedChild?.props.children;
    if (typeof label === 'string' || typeof label === 'number') return String(label);

    if (import.meta.env.DEV) {
      throw new Error('StyledDropdown: option label must be a string/number or provide getOptionLabel(value)');
    }
    return '';
  }, [getOptionLabel, resolvedValue, selectedChild]);

  const handleOpen = React.useCallback(() => {
    if (disabled || hasConfigError) return;
    // Ensure the combobox input keeps focus when opening; keyboard navigation is handled on the input.
    inputElementRef.current?.focus();
    setAnchorEl(anchorRef.current);
    setOpen(true);
    const initialHighlight = selectedIndex >= 0 ? selectedIndex : visualOptions.length > 0 ? 0 : -1;
    setHighlightedIndex(initialHighlight);
  }, [disabled, hasConfigError, selectedIndex, visualOptions.length]);

  const handleClose = React.useCallback(
    (reason: 'select' | 'escapeKeyDown' | 'backdropClick' | 'tab') => {
      setOpen(false);
      setAnchorEl(null);
      setHighlightedIndex(-1);
      onClose?.();
      // IMPORTANT: on `tab`, we intentionally do NOT restore focus here.
      // The browser (or table/container navigation) must be allowed to move focus to the next control.
      if (returnFocusOnClose && reason !== 'tab') {
        inputElementRef.current?.focus();
      }
    },
    [onClose, returnFocusOnClose]
  );

  React.useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const inAnchor = anchorRef.current?.contains(target) ?? false;
      const inListbox = listboxRef.current?.contains(target) ?? false;
      if (inAnchor || inListbox) return;
      event.preventDefault();
      event.stopPropagation();
      handleClose('backdropClick');
      inputElementRef.current?.focus();
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [handleClose, open]);

  const handleSelect = React.useCallback(
    (val: TValue | undefined) => {
      if (val === undefined && !allowEmpty) return;

      // Safe due to the `allowEmpty` runtime guard:
      // - if `allowEmpty === false`, `val` cannot be `undefined` here
      // - if `allowEmpty === true`, `onChange` expects `TValue | undefined`
      (onChange as ((e: StyledDropdownChangeEvent<TValue | undefined>) => void) | undefined)?.({
        target: { name, value: val },
      });
      handleClose('select');
    },
    [allowEmpty, handleClose, name, onChange]
  );

  const containerSxBase: SxProps<Theme> = {
    position: 'relative',
    width: typeof width === 'number' ? `${width}px` : width,
  };

  const inputSxBase: SxProps<Theme> = {
    width: '100%',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    paddingRight: '36px',
    cursor: disabled || hasConfigError ? 'default' : 'pointer',
    '& input': {
      cursor: disabled || hasConfigError ? 'default' : 'pointer',
    },
    '& .MuiInputAdornment-root': {
      cursor: disabled || hasConfigError ? 'default' : 'pointer',
    },
    '& .MuiInputAdornment-root *': {
      cursor: disabled || hasConfigError ? 'default' : 'pointer',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(0,0,0,0.12)',
      borderWidth: '1px',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(0,0,0,0.25)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#1976d2',
      borderWidth: '1px',
    },
    '&.Mui-error .MuiOutlinedInput-notchedOutline': {
      borderColor: '#d32f2f',
      borderWidth: '1px',
    },
    '&.Mui-error:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#d32f2f',
    },
    '&.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#1976d2',
      borderWidth: '1px',
    },
    '& input::placeholder': {
      color: 'rgba(0,0,0,0.4)',
      opacity: 1,
    },
  };

  const containerSx: SxProps<Theme> = sx
    ? Array.isArray(sx)
      ? [containerSxBase, ...sx]
      : [containerSxBase, sx]
    : containerSxBase;

  const inputSx: SxProps<Theme> = sx
    ? Array.isArray(sx)
      ? [inputSxBase, ...sx]
      : [inputSxBase, sx]
    : inputSxBase;

  const listboxSxMerged: SxProps<Theme> = listboxSx
    ? Array.isArray(listboxSx)
      ? [
          {
            minWidth: typeof width === 'number' ? `${width}px` : width,
            outline: 'none',
          },
          ...listboxSx,
        ]
      : [
          {
            minWidth: typeof width === 'number' ? `${width}px` : width,
            outline: 'none',
          },
          listboxSx,
        ]
    : {
        minWidth: typeof width === 'number' ? `${width}px` : width,
        outline: 'none',
      };

  const iconSxMerged: SxProps<Theme> = iconSx
    ? Array.isArray(iconSx)
      ? [
          {
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'rgba(0,0,0,0.6)',
          },
          ...iconSx,
        ]
      : [
          {
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'rgba(0,0,0,0.6)',
          },
          iconSx,
        ]
    : {
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        color: 'rgba(0,0,0,0.6)',
      };

  return (
    <Box sx={containerSx}>
      <OutlinedInput
        ref={(node: HTMLDivElement | null) => {
          anchorRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        size="small"
        id={resolvedId}
        value={selectedLabel}
        inputRef={inputElementRef}
        // Intentionally `readOnly`: the control is a combobox trigger, not a free-text input.
        // Note: `readOnly` inputs are normally excluded from the app's Container-level tab/enter navigation.
        // This dropdown is included via an explicit Container exception keyed on `input[role="combobox"]`.
        readOnly
        name={name}
        error={error || hasConfigError}
        disabled={disabled || hasConfigError}
        onBlur={onBlur}
        onClick={handleOpen}
        placeholder={placeholder}
        inputProps={{
          ...userInputProps,
          role: 'combobox',
          'aria-haspopup': 'listbox',
          'aria-expanded': open,
          'aria-controls': open ? listboxId : undefined,
          'aria-activedescendant':
            open && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined,
          tabIndex: disabled || hasConfigError ? -1 : (userInputProps?.tabIndex ?? 0),
        }}
        onKeyDown={(e) => {
          if (disabled || hasConfigError) return;

          if (open) {
            if (e.key === 'Tab') {
              handleClose('tab');
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              const maxIndex = visualOptions.length - 1;
              setHighlightedIndex((prev) => {
                const next = prev < 0 ? (maxIndex >= 0 ? 0 : -1) : Math.min(prev + 1, maxIndex);
                return next;
              });
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
              return;
            }
            if (e.key === 'Enter') {
              if (highlightedIndex < 0) return;
              e.preventDefault();
              e.stopPropagation();
              handleSelect(getValueAtVisualIndex(highlightedIndex));
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              handleClose('escapeKeyDown');
              return;
            }
          }

          if (e.key === 'Backspace' || e.key === 'Delete') {
            if (allowEmpty) {
              e.preventDefault();
              e.stopPropagation();
              // UNDTAGELSE TIL "INGEN LIVE PREVIEW": Commit øjeblikkeligt ved DELETE/Backspace
              handleSelect(undefined);
            }
            return;
          }

          if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            handleOpen();
            return;
          }

          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            handleClose('escapeKeyDown');
          }
        }}
        sx={inputSx}
        {...outlinedInputProps}
      />

      <ArrowDropDownIcon sx={iconSxMerged} />

      <Popover
        open={open}
        anchorEl={anchorEl}
        // Keep focus on the combobox input (focus ring + arrow-key navigation).
        // MUI Popover is Modal-based; default focus management may steal focus into the popover.
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        // Disable modal backdrop to prevent aria-hidden warning.
        // MUI Modal sætter aria-hidden="true" på root-elementet, hvilket er ugyldigt når inputtet beholder fokus.
        // hideBackdrop fjerner backdrop-overlay (kun visuel ændring, funktionalitet bevares).
        hideBackdrop
        // Slå modal scroll lock fra - vi bruger ikke backdrop, så scroll lock er unødvendigt.
        // Dette forhindrer aria-hidden manipulation på root-elementet.
        slotProps={{
          root: {
            // Disable MUI Modal's default scroll lock and aria-hidden behavior.
            // The dropdown does not need modal semantics (no backdrop, no trap).
            disableScrollLock: true,
          },
        }}
        onClose={(_, reason) => {
          handleClose(reason);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box id={listboxId} role="listbox" sx={listboxSxMerged} ref={listboxRef}>
          {visualOptions.map((opt, index) => {
            const v = getValueAtVisualIndex(index);
            const isSelected = v === resolvedValue;
            const optionSxMerged: SxProps<Theme> = optionSx
              ? Array.isArray(optionSx)
                ? [
                    {
                      cursor: 'pointer',
                      backgroundColor:
                        highlightedIndex === index
                          ? 'rgba(25, 118, 210, 0.08)'
                          : isSelected
                            ? 'rgba(25, 118, 210, 0.12)'
                            : 'transparent',
                      '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.08)' },
                    },
                    ...optionSx,
                  ]
                : [
                    {
                      cursor: 'pointer',
                      backgroundColor:
                        highlightedIndex === index
                          ? 'rgba(25, 118, 210, 0.08)'
                          : isSelected
                            ? 'rgba(25, 118, 210, 0.12)'
                            : 'transparent',
                      '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.08)' },
                    },
                    optionSx,
                  ]
              : {
                  cursor: 'pointer',
                  backgroundColor:
                    highlightedIndex === index
                      ? 'rgba(25, 118, 210, 0.08)'
                      : isSelected
                        ? 'rgba(25, 118, 210, 0.12)'
                        : 'transparent',
                  '&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.08)' },
                };

            return (
              <MenuItem
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                key={opt.kind === 'empty' ? `${resolvedId}__empty__` : opt.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => handleSelect(v)}
                selected={isSelected}
                sx={optionSxMerged}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {opt.kind === 'empty' ? <em style={{ color: 'rgba(0,0,0,0.4)' }}>{placeholder}</em> : opt.children}
              </MenuItem>
            );
          })}
        </Box>
      </Popover>
    </Box>
  );
};

type StyledDropdownComponent = {
  <TValue extends StyledDropdownValue>(
    props: StyledDropdownProps<TValue> & React.RefAttributes<HTMLDivElement>
  ): React.ReactElement;
  displayName?: string;
};

const StyledDropdown = React.forwardRef(StyledDropdownInner) as unknown as StyledDropdownComponent;

StyledDropdown.displayName = 'StyledDropdown';

export default StyledDropdown;
