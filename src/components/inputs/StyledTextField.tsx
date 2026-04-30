import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase, { type StyledTextFieldBaseInputType } from './StyledTextFieldBase';
import StyledTextAreaBase from './StyledTextAreaBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { trimWhitespaceEdges } from '../../utils/draftNormalization';
import { isInteractiveDevLoggingEnabled } from '../../utils/debugRuntime';
import { assignRef } from '../../utils/refUtils';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';

const debugStyledTextField = (event: string, details: Record<string, unknown>): void => {
  if (!isInteractiveDevLoggingEnabled) return;
  console.debug('[StyledTextField]', event, details);
};

const formatStyledTextValue = (value: string): string => value;

export type StyledTextFieldValueCommitEvent = CommitEvent<string>;
export type StyledTextFieldDraftChangeEvent = DraftChangeEvent;

export type StyledTextFieldProps = {
  value: string;

  width?: number | string;
  id?: string;
  name?: string;
  label?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  fullWidth?: boolean;

  inputType?: StyledTextFieldBaseInputType;
  sx?: SxProps<Theme>;

  multiline?: boolean;
  rows?: number;

  /**
   * Draft callback (typing only).
   */
  onDraftChange?: DraftChangeHandler;

  /**
   * Commit callback (blur/enter/imperative).
   */
  onCommit?: CommitHandler<string>;

  /**
   * Optional local commit-time validation.
   *
   * - Return a non-empty string to block commit with that error message.
   * - Return `undefined` to accept the value.
   *
   * Note: this validates the committed string value; mapping empty string to `undefined` (if desired)
   * is a consumer responsibility.
   */
  validateOnCommit?: (value: string) => string | undefined;

  /**
   * This field is a "raw text" input:
   * - Typing is always considered committable (`ok: true`) unless `validateOnCommit` is provided.
   * - Local validation is therefore commit-time only (by design).
   */

  /**
   * Producer-owned error reporter (optional). When provided, the field reports its own
   * commit-time validation error up to the form-error registry and rehydrates the invalid
   * draft after undo/redo or remount via `getCurrentError()`.
   */
  onFieldError?: FieldErrorReporter;

  /**
   * Called after internal focus bookkeeping (via `useDraftField`) has run.
   */
  onFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

  /**
   * Physical blur (focus leaves the control).
   *
   * Invariant: internal `useDraftField` bookkeeping runs before this callback.
   */
  onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

  error?: boolean;
  helperText?: string;
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
};

const StyledTextField = React.forwardRef<HTMLDivElement, StyledTextFieldProps>(
  (
    {
      value,
      width,
      id,
      name,
      label,
      placeholder,
      disabled,
      required,
      autoFocus,
      fullWidth,
      inputType = 'text',
      sx,
      multiline = false,
      rows,
      onDraftChange,
      onCommit,
      validateOnCommit,
      onFieldError,
      onBlur,
      onFocus,
      onKeyDown,
      error: externalHasError = false,
      helperText: externalHelperText = '',
      inputRef,
    },
    ref
  ) => {
    const inputElementRef = React.useRef<HTMLInputElement>(null);
    const textAreaElementRef = React.useRef<HTMLTextAreaElement>(null);
    const elementRefForHook = multiline ? textAreaElementRef : inputElementRef;

    const mergedInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        assignRef<HTMLInputElement | HTMLTextAreaElement>(inputRef, node);
      },
      [inputRef]
    );

    const mergedTextAreaRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textAreaElementRef.current = node;
        assignRef<HTMLInputElement | HTMLTextAreaElement>(inputRef, node);
      },
      [inputRef]
    );

    const parseString: DraftParse<string> = React.useCallback(
      (draft, { mode }) => {
        const message = validateOnCommit?.(draft);
        if (message && mode === 'commit') {
          return { ok: false, kind: 'invalid', message };
        }
        if (message && mode === 'typing') {
          return { ok: false, kind: 'partial' };
        }
        return { ok: true, value: draft };
      },
      [validateOnCommit]
    );

    const initialInvalidDraft = React.useMemo(() => {
      const currentError = onFieldError?.getCurrentError?.();
      if (
        currentError?.severity === 'error' &&
        currentError.blocksSave !== false &&
        typeof currentError.invalidDraft === 'string'
      ) {
        return { draft: currentError.invalidDraft, message: currentError.message };
      }
      return undefined;
    }, [onFieldError]);

    const {
      draft,
      setDraft: setDraftBase,
      touched,
      error,
      onFocus: onFocusBase,
      onBlur: onBlurBase,
      onKeyDown: onKeyDownBase,
      commit,
    } = useDraftField<string>({
      value,
      format: formatStyledTextValue,
      parse: parseString,
      onCommit: (nextValue) => {
        onCommit?.(createCommitEvent(nextValue));
      },
      inputElementRef: elementRefForHook as React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
      normalizeDraftOnCommit: trimWhitespaceEdges,
      clearErrorOnDraftChange: validateOnCommit !== undefined,
      commitOnBlur: false,
      initialInvalidDraft,
    });

    const visibleLocalError = touched ? error : undefined;
    const resolvedHasError = externalHasError || Boolean(visibleLocalError?.message);
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

    // Notify parent of local error state (producer-owned reporting)
    React.useEffect(() => {
      if (typeof onFieldError !== 'function') return;
      if (visibleLocalError?.message) {
        onFieldError({ message: visibleLocalError.message, blocksSave: true, invalidDraft: draft });
        return;
      }
      onFieldError(undefined);
    }, [draft, onFieldError, visibleLocalError?.message]);

    const skipNextBlurCommitRef = React.useRef(false);

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onFocusBase();
        onFocus?.(e);
      },
      [onFocus, onFocusBase]
    );

    const handleDraftChange = React.useCallback(
      (nextDraft: string) => {
        skipNextBlurCommitRef.current = false;
        setDraftBase(nextDraft);
        onDraftChange?.(createDraftChangeEvent(nextDraft));
      },
      [onDraftChange, setDraftBase]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => key, []);

    const inputActivation = useTwoStageInputActivation<HTMLElement>({
      disabled: Boolean(disabled),
      getDraftForKey,
      onReplaceDraft: (nextDraft) => handleDraftChange(nextDraft),
    });

    const textAreaActivation = useTwoStageInputActivation<HTMLTextAreaElement>({
      disabled: Boolean(disabled),
      getDraftForKey,
      onReplaceDraft: (nextDraft) => handleDraftChange(nextDraft),
    });

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (multiline) {
        if (!textAreaActivation.isEditorOpen) {
          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            e.stopPropagation();
            // UNDTAGELSE TIL "INGEN LIVE PREVIEW": Commit øjeblikkeligt ved DELETE/Backspace
            // Parse og commit direkte (synkront) som table-felter gør
            const normalized = trimWhitespaceEdges('');
            const result = parseString(normalized, { mode: 'commit' });
            if (result.ok) {
              onCommit?.(createCommitEvent(result.value));
            }
            setDraftBase('');
            return;
          }
          textAreaActivation.handleKeyDown(e as React.KeyboardEvent<HTMLTextAreaElement>);
          if (e.defaultPrevented) return;
          onKeyDown?.(e);
            return;
          }

          onKeyDownBase(e);
          if (e.defaultPrevented && e.key === 'Enter') {
            skipNextBlurCommitRef.current = true;
          }
          if (e.defaultPrevented && e.key === 'Escape') {
            textAreaActivation.closeEditor();
            return;
          }
          onKeyDown?.(e);
          return;
        }

        if (!inputActivation.isEditorOpen) {
          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            e.stopPropagation();
            // UNDTAGELSE TIL "INGEN LIVE PREVIEW": Commit øjeblikkeligt ved DELETE/Backspace
            // Parse og commit direkte (synkront) som table-felter gør
            const normalized = trimWhitespaceEdges('');
            const result = parseString(normalized, { mode: 'commit' });
            if (result.ok) {
              onCommit?.(createCommitEvent(result.value));
            }
            setDraftBase('');
            return;
          }
          inputActivation.handleKeyDown(e as React.KeyboardEvent<HTMLInputElement>);
          if (e.defaultPrevented) return;
          onKeyDown?.(e);
          return;
        }

        onKeyDownBase(e);
        if (e.defaultPrevented && e.key === 'Enter') {
          skipNextBlurCommitRef.current = true;
        }
        if (e.defaultPrevented && e.key === 'Escape') {
          inputActivation.closeEditor();
          return;
        }
        onKeyDown?.(e);
      },
      [inputActivation, multiline, onCommit, onKeyDown, onKeyDownBase, parseString, setDraftBase, textAreaActivation]
    );

    React.useEffect(() => {
      debugStyledTextField('render-state', {
        id,
        name,
        label: typeof label === 'string' ? label : undefined,
        multiline,
        value,
        draft,
        touched,
        localError: visibleLocalError?.message ?? '',
        externalHasError,
        externalHelperText,
        resolvedHasError,
        resolvedErrorMessage,
        inputEditorOpen: multiline ? undefined : inputActivation.isEditorOpen,
        textAreaEditorOpen: multiline ? textAreaActivation.isEditorOpen : undefined,
      });
    }, [
      id,
      name,
      label,
      multiline,
      value,
      draft,
      touched,
      visibleLocalError?.message,
      externalHasError,
      externalHelperText,
      resolvedHasError,
      resolvedErrorMessage,
      inputActivation.isEditorOpen,
      textAreaActivation.isEditorOpen,
    ]);

    if (multiline) {
      return (
        <StyledTextAreaBase
          ref={ref}
          id={id}
          name={name}
          label={label}
          placeholder={placeholder}
          draft={draft}
          onDraftChange={handleDraftChange}
          inputRef={mergedTextAreaRef}
          onFocus={handleFocus as (e: React.FocusEvent<HTMLTextAreaElement>) => void}
          onBlur={(e) => {
            onBlurBase(e);
            const unchanged = draft === value;
            debugStyledTextField('blur', {
              id,
              name,
              label: typeof label === 'string' ? label : undefined,
              unchanged,
              skipNextBlurCommit: skipNextBlurCommitRef.current,
              draft,
              value,
            });
            if (!skipNextBlurCommitRef.current && !unchanged) {
              debugStyledTextField('commit-from-blur', {
                id,
                name,
                label: typeof label === 'string' ? label : undefined,
                draft,
                value,
              });
              commit();
            }
            if (textAreaActivation.isEditorOpen) textAreaActivation.closeEditor();
            skipNextBlurCommitRef.current = false;
            onBlur?.(e);
          }}
          onKeyDown={handleKeyDown as (e: React.KeyboardEvent<HTMLTextAreaElement>) => void}
          onMouseDown={textAreaActivation.handleMouseDown}
          onClick={textAreaActivation.handleClick}
          onPaste={textAreaActivation.handlePaste}
          width={width}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          fullWidth={fullWidth}
          error={resolvedHasError}
          helperText={resolvedErrorMessage}
          rows={rows}
          htmlTextAreaAttributes={{ readOnly: !textAreaActivation.isEditorOpen }}
          sx={{
            '& .MuiInputBase-input': {
              caretColor: textAreaActivation.isEditorOpen ? 'auto' : 'transparent',
              cursor: textAreaActivation.isEditorOpen ? 'text' : 'pointer',
            },
            ...sx,
          }}
        />
      );
    }

    return (
      <StyledTextFieldBase
        ref={ref}
        id={id}
        name={name}
        label={label}
        placeholder={placeholder}
        draft={draft}
        onDraftChange={handleDraftChange}
        inputRef={mergedInputRef}
        onFocus={handleFocus as (e: React.FocusEvent<HTMLInputElement>) => void}
        onBlur={(e) => {
          onBlurBase(e);
          const unchanged = draft === value;
          debugStyledTextField('blur', {
            id,
            name,
            label: typeof label === 'string' ? label : undefined,
            unchanged,
            skipNextBlurCommit: skipNextBlurCommitRef.current,
            draft,
            value,
          });
          if (!skipNextBlurCommitRef.current && !unchanged) {
            debugStyledTextField('commit-from-blur', {
              id,
              name,
              label: typeof label === 'string' ? label : undefined,
              draft,
              value,
            });
            commit();
          }
          if (inputActivation.isEditorOpen) inputActivation.closeEditor();
          skipNextBlurCommitRef.current = false;
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown as (e: React.KeyboardEvent<HTMLInputElement>) => void}
        onMouseDown={inputActivation.handleMouseDown}
        onClick={inputActivation.handleClick}
        onPaste={inputActivation.handlePaste}
        inputType={inputType}
        width={width}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        fullWidth={fullWidth}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        htmlInputAttributes={{ readOnly: !inputActivation.isEditorOpen }}
        sx={{
          '& .MuiInputBase-input': {
            caretColor: inputActivation.isEditorOpen ? 'auto' : 'transparent',
            cursor: inputActivation.isEditorOpen ? 'text' : 'pointer',
          },
          ...sx,
        }}
      />
    );
  }
);

StyledTextField.displayName = 'StyledTextField';

export default StyledTextField;
