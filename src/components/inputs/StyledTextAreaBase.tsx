import * as React from 'react';
import { TextField, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { mergeSx } from '../../utils/mergeSx';
import { visuallyHiddenStyle } from '../shared/visuallyHiddenStyle';
import { copyWholeValueFromReadOnlyField } from '../../utils/clipboardUtils';
import MineoTextareaInputComponent from './MineoTextareaInputComponent';
import { resolveAccessibleName } from './accessibleName';

type AllowedInputAttributes = Pick<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  | 'aria-describedby'
  | 'aria-label'
  | 'aria-labelledby'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'enterKeyHint'
  | 'maxLength'
  | 'minLength'
  | 'readOnly'
  | 'spellCheck'
  | 'tabIndex'
> & {
  'data-testid'?: string;
};

export type StyledTextAreaBaseProps = {
  width?: number | string;
  id?: string;
  name?: string;
  label?: React.ReactNode;
  /** Tilgængeligt navn fra feltfamilien eller den transiente input-wrapper. */
  accessibleName: string;
  placeholder?: string;

  draft: string;
  onDraftChange: (draft: string) => void;

  inputRef?: React.Ref<HTMLTextAreaElement>;

  autoFocus?: boolean;
  fullWidth?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  /** Kortere hover-tekst end den fulde besked. Se `StyledTextFieldBaseProps.tooltipText`. */
  tooltipText?: string;
  disabled?: boolean;
  /** Se `StyledTextFieldBaseProps.disabledAppearance` – de to baser skal se ens ud i samme tilstand. */
  disabledAppearance?: 'default' | 'locked';

  rows?: number;

  onFocus?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onCopy?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;

  htmlTextAreaAttributes?: AllowedInputAttributes;
  sx?: SxProps<Theme>;
};

const StyledTextAreaBase = React.forwardRef<HTMLDivElement, StyledTextAreaBaseProps>(
  (
    {
      width = 300,
      id,
      name,
      label,
      accessibleName,
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
      tooltipText,
      sx = {},
      disabled,
      disabledAppearance = 'default',
      autoFocus,
      fullWidth,
      required,
      rows = 3,
      htmlTextAreaAttributes,
    },
    ref
  ) => {
    const autoId = React.useId();
    const resolvedId = id ?? autoId;
    const resolvedName = name ?? resolvedId;
    const resolvedAccessibleName = resolveAccessibleName(
      { ariaLabel: accessibleName },
      `StyledTextAreaBase(${resolvedId})`
    );

    if (import.meta.env.DEV && error && helperText.trim() === '') {
      throw new Error('StyledTextAreaBase: helperText is required when error=true (avoid silent error states)');
    }

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => {
        onFocus?.(e);
      },
      [onFocus]
    );

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLTextAreaElement>) => {
        onBlur?.(e);
      },
      [onBlur]
    );

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onDraftChange(e.target.value);
      },
      [onDraftChange]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        onKeyDown?.(e);
      },
      [onKeyDown]
    );

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => {
        onClick?.(e);
      },
      [onClick]
    );

    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => {
        onMouseDown?.(e);
      },
      [onMouseDown]
    );

    const handleDoubleClick = React.useCallback(
      (e: React.MouseEvent<HTMLTextAreaElement>) => {
        onDoubleClick?.(e);
      },
      [onDoubleClick]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        onPaste?.(e);
      },
      [onPaste]
    );

    const handleCopy = React.useCallback(
      (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        copyWholeValueFromReadOnlyField(e, {
          isReadOnly: htmlTextAreaAttributes?.readOnly === true,
          value: draft,
          selectionStart: e.currentTarget.selectionStart,
          selectionEnd: e.currentTarget.selectionEnd,
        });
        onCopy?.(e);
      },
      [draft, htmlTextAreaAttributes?.readOnly, onCopy]
    );

    const showError = error && helperText.trim() !== '';
    const resolvedTooltipText = tooltipText ?? helperText;
    const a11yErrorId = `${resolvedId}-error`;

    const describedByBase = htmlTextAreaAttributes?.['aria-describedby'];
    const describedBy = showError
      ? [describedByBase, a11yErrorId].filter((v): v is string => Boolean(v && v.trim() !== '')).join(' ')
      : describedByBase;

    const wrapperWidth = fullWidth ? '100%' : typeof width === 'number' ? `${width}px` : width;

    const resolvedCursor: React.CSSProperties['cursor'] | undefined =
      disabled ? 'default' : htmlTextAreaAttributes?.readOnly ? 'pointer' : 'text';
    const useLockedDisabledAppearance = disabledAppearance === 'locked';

    return (
      <Tooltip
        title={showError ? resolvedTooltipText : ''}
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
            value={draft}
            onChange={handleChange}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            fullWidth={fullWidth}
            required={required}
            error={error}
            helperText={undefined}
            inputRef={inputRef}
            multiline
            rows={rows}
            slotProps={{
              input: {
                inputComponent: MineoTextareaInputComponent,
              },
              htmlInput: {
                ...htmlTextAreaAttributes,
                'aria-label': resolvedAccessibleName,
                'aria-describedby': describedBy,
                // Feltidentiteten i DOM er restore-target-attributterne (serialiseret feltadresse +
                // editorlokation), som feltfamilien sender med gennem `htmlTextAreaAttributes` – samme
                // model som StyledTextFieldBase. Basen udleder ingen egen identitet af `name` (§3.2).
                onFocus: handleFocus,
                onBlur: handleBlur,
                onKeyDown: handleKeyDown,
                onClick: handleClick,
                onMouseDown: handleMouseDown,
                onDoubleClick: handleDoubleClick,
                onPaste: handlePaste,
                onCopy: handleCopy,
              },
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
                '& textarea': {
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
                // Deaktiveret udseende er ordret det samme som i `StyledTextFieldBase`. De to baser
                // løser samme concern, og et flerlinjet felt må ikke se anderledes deaktiveret ud end
                // et enkeltlinjet – her manglede både den stiplede ramme, baggrunden og tekstfarven.
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
              },
              // Placeholder-politikken er også fælles: samme dæmpede farve, og placeholderen viger for
              // markøren, når feltet redigeres. Uden de to regler havde kommentarfelterne en anden
              // placeholder-farve end alle andre felter og beholdt teksten under skrivning.
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

StyledTextAreaBase.displayName = 'StyledTextAreaBase';

export default StyledTextAreaBase;
