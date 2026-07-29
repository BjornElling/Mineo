import * as React from 'react';
import { TextField, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../utils/mergeSx';
import { visuallyHiddenStyle } from '../shared/visuallyHiddenStyle';
import { copyWholeValueFromReadOnlyField } from '../../utils/clipboardUtils';
import { isInteractiveDevLoggingEnabled } from '../../utils/debugRuntime';
import type { InputSelectionSnapshot } from '../../utils/inputSelectionUtils';

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
  /** Undo/redo-restore-mål (§3.7): serialiseret feltadresse + editorlokations-id. */
  'data-mineo-field-address'?: string;
  'data-mineo-editor-location-id'?: string;
  'data-mineo-field-path'?: string;
};

export type StyledTextFieldBaseInputType = 'text' | 'search' | 'tel' | 'url' | 'email' | 'password';

/**
 * UI-only tekst-input-base.
 *
 * Invarianter:
 * - Styret af `draft` (string); ingen parsing/validering/commit udføres her.
 * - Kun enkelt linje (ingen textarea / multiline); consumere skal bruge en dedikeret komponent til multiline.
 * - Keyboard-handlere bindes til det underliggende `<input>` via MUI `slotProps.htmlInput`.
 * - Muse-interaktions-handlere (`onClick`/`onMouseDown`/`onDoubleClick`) bindes til input-roden
 *   (`slotProps.input`), så hele feltets hit-area (inkl. adornments) deltager i to-trins-aktivering.
 * - Fejl ved ugyldigt input vises via rød kant + tooltip ved hover (helper text er skjult).
 * - `inputType` påvirker kun browserens UI/IME og autofill; man må ikke regne med det for domæne-semantik.
 * - `htmlInputAttributes` kan påvirke hvad browseren tillader brugeren at indtaste; det skal sættes af field-adaptere
 *   (fx `StyledXField...`-komponenter), ikke af sider/call-sites.
 *
 * Refs:
 * - Den forwardede `ref` peger på MUI TextField-rodelementet (wrapper).
 * - Brug `inputRef` til at interagere med selve `<input>`.
 */
export type StyledTextFieldBaseProps = {
  width?: number | string;
  id?: string;
  name?: string;
  label?: React.ReactNode;
  placeholder?: string;

  draft: string;
  onDraftChange: (draft: string, selection: InputSelectionSnapshot) => void;

  inputRef?: React.Ref<HTMLInputElement>;

  autoFocus?: boolean;
  fullWidth?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  disabledAppearance?: 'default' | 'locked';

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
      disabledAppearance = 'default',
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
        onDraftChange(e.target.value, {
          selectionStart: e.currentTarget.selectionStart,
          selectionEnd: e.currentTarget.selectionEnd,
        });
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

    const mergedHtmlInputProps = {
      ...htmlInputAttributes,
      'aria-describedby': describedBy,
      // Stabil felt-sti til save-gate-lokalisering af det blokerende felt. Feltfamiliens felter sætter
      // desuden restore-target-attributterne (feltadresse + editorlokation) via `htmlInputAttributes`.
      'data-mineo-field-path': htmlInputAttributes?.['data-mineo-field-path'] ?? name,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      onPaste: handlePaste,
      onCopy: handleCopy,
    };

    const wrapperWidth = fullWidth ? '100%' : typeof width === 'number' ? `${width}px` : width;

    const resolvedCursor: React.CSSProperties['cursor'] | undefined =
      disabled ? 'default' : htmlInputAttributes?.readOnly ? 'pointer' : 'text';
    const useLockedDisabledAppearance = disabledAppearance === 'locked';

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
            slotProps={{
              input: {
                ...(endAdornment ? { endAdornment } : {}),
                onClick: handleClick,
                onMouseDown: handleMouseDown,
                onDoubleClick: handleDoubleClick,
              },
              htmlInput: mergedHtmlInputProps,
            }}
            disabled={disabled}
            size="small"
            variant="outlined"
            sx={mergeSx({
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
                  backgroundColor: useLockedDisabledAppearance
                    ? 'var(--color-input-disabled-locked-bg, var(--color-input-disabled-bg))'
                    : 'var(--color-input-disabled-bg)',
                },
                '&.Mui-disabled:not(.Mui-error) fieldset': {
                  borderColor: useLockedDisabledAppearance
                    ? 'var(--color-input-disabled-border, var(--color-input-border))'
                    : 'var(--color-input-border)',
                  borderStyle: useLockedDisabledAppearance ? 'solid' : 'dashed',
                },
                '&.Mui-disabled:not(.Mui-error):hover fieldset': {
                  borderColor: useLockedDisabledAppearance
                    ? 'var(--color-input-disabled-border, var(--color-input-border))'
                    : 'var(--color-input-border)',
                },
                '&.Mui-disabled .MuiInputBase-input': {
                  cursor: 'default',
                  color: useLockedDisabledAppearance
                    ? 'var(--mineo-color-input-disabled-locked, var(--mineo-color-input-disabled))'
                    : 'var(--mineo-color-input-disabled)',
                  WebkitTextFillColor: useLockedDisabledAppearance
                    ? 'var(--mineo-color-input-disabled-locked, var(--mineo-color-input-disabled))'
                    : 'var(--mineo-color-input-disabled)',
                },
                '&.Mui-disabled .MuiInputAdornment-root': {
                  color: useLockedDisabledAppearance
                    ? 'var(--mineo-color-input-disabled-locked, var(--mineo-color-input-disabled))'
                    : 'var(--mineo-color-input-disabled)',
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
                color: 'var(--mineo-color-placeholder)',
                opacity: 1,
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiInputBase-input:not([readonly])::placeholder': {
                opacity: 0,
              },
            }, sx)}
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
