import * as React from 'react';
import { TextField, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { visuallyHiddenStyle } from '../shared/visuallyHiddenStyle';
import { copyWholeValueFromReadOnlyField } from '../../utils/clipboardUtils';
import { isInteractiveDevLoggingEnabled } from '../../utils/debugRuntime';

type AllowedInputAttributes = Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  | 'aria-describedby'
  | 'aria-label'
  | 'aria-labelledby'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'enterKeyHint'
  | 'inputMode'
  | 'maxLength'
  | 'minLength'
  | 'pattern'
  | 'readOnly'
  | 'spellCheck'
  | 'tabIndex'
> & {
  'data-testid'?: string;
};

export type StyledTextFieldBaseInputType = 'text' | 'search' | 'tel' | 'url' | 'email' | 'password';

/**
 * UI-only text input base.
 *
 * Invariants:
 * - Controlled by `draft` (string); no parsing/validation/commit is performed here.
 * - Single-line only (no textarea / multiline); consumers must use a dedicated component for multiline.
 * - Keyboard handlers are bound to the underlying `<input>` via MUI `slotProps.htmlInput`.
 * - Mouse interaction handlers (`onClick`/`onMouseDown`/`onDoubleClick`) are bound to the input root
 *   (`InputProps`) so the full field hit-area (including adornments) participates in two-stage activation.
 * - Invalid-input errors are shown via red border + tooltip on hover (helper text is hidden).
 * - `inputType` only affects browser UI/IME and autofill; it must not be relied on for domain semantics.
 * - `htmlInputAttributes` can affect what the browser allows the user to enter; it must be set by field-adapters
 *   (e.g. `StyledXField...` components), not by pages/call-sites.
 *
 * Refs:
 * - Forwarded `ref` targets the MUI TextField root element (wrapper).
 * - Use `inputRef` for interacting with the actual `<input>`.
 */
export type StyledTextFieldBaseProps = {
  width?: number | string;
  id?: string;
  name?: string;
  label?: React.ReactNode;
  placeholder?: string;

  draft: string;
  onDraftChange: (draft: string) => void;

  inputRef?: React.Ref<HTMLInputElement>;

  autoFocus?: boolean;
  fullWidth?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;

  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onCopy?: (e: React.ClipboardEvent<HTMLInputElement>) => void;

  inputType?: StyledTextFieldBaseInputType;
  htmlInputAttributes?: AllowedInputAttributes;
  endAdornment?: React.ReactNode;
  sx?: SxProps<Theme>;
};

const debugTextFieldBase = (event: string, details: Record<string, unknown>): void => {
  if (!isInteractiveDevLoggingEnabled) return;
  console.debug('[StyledTextFieldBase]', event, details);
};

const StyledTextFieldBase = React.forwardRef<HTMLDivElement, StyledTextFieldBaseProps>(
  (
    {
      width = 300,
      id,
      name,
      label,
      placeholder,
      draft,
      onDraftChange,
      onBlur,
      onFocus,
      onKeyDown,
      onClick,
      onMouseDown,
      onDoubleClick,
      onPaste,
      onCopy,
      inputRef,
      error = false,
      helperText = '',
      sx = {},
      disabled,
      autoFocus,
      fullWidth,
      required,
      inputType = 'text',
      htmlInputAttributes,
      endAdornment,
    },
    ref
  ) => {
    const autoId = React.useId();
    const resolvedId = id ?? autoId;
    const resolvedName = name ?? resolvedId;

    if (import.meta.env.DEV && error && helperText.trim() === '') {
      throw new Error('StyledTextFieldBase: helperText is required when error=true (avoid silent error states)');
    }

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        onFocus?.(e);
      },
      [onFocus]
    );

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        onBlur?.(e);
      },
      [onBlur]
    );

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onDraftChange(e.target.value);
      },
      [onDraftChange]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(e);
      },
      [onKeyDown]
    );

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        onClick?.(e);
      },
      [onClick]
    );

    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        onMouseDown?.(e);
      },
      [onMouseDown]
    );

    const handleDoubleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        onDoubleClick?.(e);
      },
      [onDoubleClick]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        onPaste?.(e);
      },
      [onPaste]
    );

    const handleCopy = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        copyWholeValueFromReadOnlyField(e, {
          isReadOnly: htmlInputAttributes?.readOnly === true,
          value: draft,
          selectionStart: e.currentTarget.selectionStart,
          selectionEnd: e.currentTarget.selectionEnd,
        });
        onCopy?.(e);
      },
      [draft, htmlInputAttributes?.readOnly, onCopy]
    );

    const showError = error && helperText.trim() !== '';
    const a11yErrorId = `${resolvedId}-error`;

    const describedByBase = htmlInputAttributes?.['aria-describedby'];
    const describedBy = showError
      ? [describedByBase, a11yErrorId].filter((v): v is string => Boolean(v && v.trim() !== '')).join(' ')
      : describedByBase;

    const mergedHtmlInputProps: React.InputHTMLAttributes<HTMLInputElement> = {
      ...htmlInputAttributes,
      'aria-describedby': describedBy,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      onPaste: handlePaste,
      onCopy: handleCopy,
    };

    const wrapperWidth = fullWidth ? '100%' : typeof width === 'number' ? `${width}px` : width;

    const resolvedCursor: React.CSSProperties['cursor'] | undefined =
      disabled ? undefined : htmlInputAttributes?.readOnly ? 'pointer' : 'text';

    const renderCountRef = React.useRef(0);
    const excessiveRenderLoggedRef = React.useRef(false);
    const lastDraftRef = React.useRef(draft);
    const renderResetTimeoutRef = React.useRef<number | null>(null);
    React.useEffect(() => {
      if (!isInteractiveDevLoggingEnabled) return;

      renderCountRef.current += 1;
      if (renderResetTimeoutRef.current !== null) {
        window.clearTimeout(renderResetTimeoutRef.current);
      }
      renderResetTimeoutRef.current = window.setTimeout(() => {
        renderCountRef.current = 0;
        excessiveRenderLoggedRef.current = false;
        renderResetTimeoutRef.current = null;
      }, 1000);
      if (lastDraftRef.current !== draft) {
        console.debug('[StyledTextFieldBase] draft changed on render', {
          id: resolvedId,
          renderCount: renderCountRef.current,
          prev: lastDraftRef.current,
          next: draft,
        });
        lastDraftRef.current = draft;
      }
      if (!excessiveRenderLoggedRef.current && renderCountRef.current > 20) {
        excessiveRenderLoggedRef.current = true;
        console.debug('[StyledTextFieldBase] excessive renders detected', {
          id: resolvedId,
          renderCount: renderCountRef.current,
          draft,
          error,
          disabled,
        });
      }
      return () => {
        if (renderResetTimeoutRef.current !== null) {
          window.clearTimeout(renderResetTimeoutRef.current);
          renderResetTimeoutRef.current = null;
        }
      };
    }, [disabled, draft, error, resolvedId]);

    React.useEffect(() => {
      debugTextFieldBase('mount', {
        id: resolvedId,
        name: resolvedName,
        label: typeof label === 'string' ? label : undefined,
      });
      return () => {
        debugTextFieldBase('unmount', {
          id: resolvedId,
          name: resolvedName,
        });
      };
    }, [label, resolvedId, resolvedName]);

    React.useEffect(() => {
      debugTextFieldBase('render-state', {
        id: resolvedId,
        name: resolvedName,
        label: typeof label === 'string' ? label : undefined,
        draft,
        error,
        showError,
        helperText,
        disabled: Boolean(disabled),
        readOnly: htmlInputAttributes?.readOnly === true,
        hasEndAdornment: endAdornment !== undefined,
      });
    }, [resolvedId, resolvedName, label, draft, error, showError, helperText, disabled, htmlInputAttributes?.readOnly, endAdornment]);

    return (
      <Tooltip
        title={showError ? helperText : ''}
        arrow
        placement="top"
        disableHoverListener={!showError}
        disableFocusListener={!showError}
        disableTouchListener={!showError}
      >
        <span style={{ display: 'inline-block', width: wrapperWidth, position: 'relative' }}>
          <TextField
            ref={ref}
            id={resolvedId}
            name={resolvedName}
            label={label}
            inputRef={inputRef}
            value={draft}
            onChange={handleChange}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            fullWidth={fullWidth}
            required={required}
            type={inputType}
            error={error}
            helperText={undefined}
            InputProps={{
              ...(endAdornment ? { endAdornment } : {}),
              onClick: handleClick,
              onMouseDown: handleMouseDown,
              onDoubleClick: handleDoubleClick,
            }}
            slotProps={{
              htmlInput: mergedHtmlInputProps,
            }}
            disabled={disabled}
            size="small"
            variant="outlined"
            sx={{
              width: typeof width === 'number' ? `${width}px` : width,
              position: 'relative',
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'var(--color-input-bg)',
                borderRadius: '10px',
                cursor: resolvedCursor,
                '& input': {
                  cursor: resolvedCursor,
                },
                '& .MuiInputAdornment-root': {
                  cursor: resolvedCursor,
                },
                '& .MuiInputAdornment-root *': {
                  cursor: resolvedCursor,
                },
                '& fieldset': {
                  borderColor: 'var(--color-input-border)',
                  borderWidth: '1px',
                },
                '&:hover fieldset': {
                  borderColor: 'var(--color-input-border-hover)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--color-input-border-focus)',
                  borderWidth: '1px',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'var(--color-input-disabled-bg)',
                },
                '&.Mui-disabled:not(.Mui-error) fieldset': {
                  borderColor: 'var(--color-input-border)',
                  borderStyle: 'dashed',
                },
                '&.Mui-disabled:not(.Mui-error):hover fieldset': {
                  borderColor: 'var(--color-input-border)',
                },
                '&.Mui-disabled .MuiInputBase-input': {
                  WebkitTextFillColor: 'var(--color-input-disabled-text)',
                },
                '&.Mui-disabled .MuiInputAdornment-root': {
                  color: 'var(--color-input-disabled-text)',
                },
                '&.Mui-error fieldset': {
                  borderColor: 'var(--color-input-border-error)',
                  borderWidth: '1px',
                },
                '&.Mui-error:hover fieldset': {
                  borderColor: 'var(--color-input-border-error)',
                },
                '&.Mui-error.Mui-focused fieldset': {
                  borderColor: 'var(--color-input-border-focus)',
                  borderWidth: '1px',
                },
              },
              '& .MuiInputBase-input::placeholder': {
                color: 'var(--color-input-placeholder)',
                opacity: 1,
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiInputBase-input:not([readonly])::placeholder': {
                opacity: 0,
              },
              ...sx,
            }}
          />
          {showError && (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {helperText}
            </span>
          )}
        </span>
      </Tooltip>
    );
  }
);

StyledTextFieldBase.displayName = 'StyledTextFieldBase';

export default StyledTextFieldBase;
