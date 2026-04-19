import * as React from 'react';
import { TextField, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { visuallyHiddenStyle } from '../shared/visuallyHiddenStyle';
import { copyWholeValueFromReadOnlyField } from '../../utils/clipboardUtils';

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
  placeholder?: string;

  draft: string;
  onDraftChange: (draft: string) => void;

  inputRef?: React.Ref<HTMLTextAreaElement>;

  autoFocus?: boolean;
  fullWidth?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;

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
      rows = 3,
      htmlTextAreaAttributes,
    },
    ref
  ) => {
    const autoId = React.useId();
    const resolvedId = id ?? autoId;
    const resolvedName = name ?? resolvedId;

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
    const a11yErrorId = `${resolvedId}-error`;

    const describedByBase = htmlTextAreaAttributes?.['aria-describedby'];
    const describedBy = showError
      ? [describedByBase, a11yErrorId].filter((v): v is string => Boolean(v && v.trim() !== '')).join(' ')
      : describedByBase;

    const wrapperWidth = fullWidth ? '100%' : typeof width === 'number' ? `${width}px` : width;

    const resolvedCursor: React.CSSProperties['cursor'] | undefined =
      disabled ? 'default' : htmlTextAreaAttributes?.readOnly ? 'pointer' : 'text';

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
              htmlInput: {
                ...htmlTextAreaAttributes,
                'aria-describedby': describedBy,
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
            sx={{
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
                '&.Mui-disabled .MuiInputBase-input': {
                  cursor: 'default',
                },
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

StyledTextAreaBase.displayName = 'StyledTextAreaBase';

export default StyledTextAreaBase;
