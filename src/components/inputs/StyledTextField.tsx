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
import { useFieldInvalidDraftChannel } from '../../hooks/useFormFieldErrors';

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
  singleStageClick?: boolean;

  /**
   * Draft-callback (kun typing).
   */
  onDraftChange?: DraftChangeHandler;

  /**
   * Commit-callback (blur/enter/imperativt).
   */
  onCommit?: CommitHandler<string>;

  /**
   * Valgfri lokal commit-time-validering.
   *
   * - Returnér en ikke-tom streng for at blokere commit med den fejlbesked.
   * - Returnér `undefined` for at acceptere værdien.
   *
   * Bemærk: dette validerer den committede streng-værdi; at mappe tom streng til `undefined` (hvis ønsket)
   * er consumerens ansvar.
   */
  validateOnCommit?: (value: string) => string | undefined;

  /**
   * Dette felt er et "rå tekst"-input:
   * - Typing betragtes altid som committable (`ok: true`) med mindre `validateOnCommit` er angivet.
   * - Lokal validering er derfor kun commit-time (by design).
   */

  /**
   * Producer-owned fejlrapportør (valgfri). Når angivet rapporterer feltet sin egen
   * commit-time-valideringsfejl op til form-error-registret og rehydrerer den ugyldige
   * draft efter undo/redo eller remount via `getCurrentError()`.
   */
  onFieldError?: FieldErrorReporter;

  /**
   * Kaldes efter at intern focus-bookkeeping (via `useDraftField`) er kørt.
   */
  onFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

  /**
   * Fysisk blur (fokus forlader kontrollen).
   *
   * Invariant: intern `useDraftField`-bookkeeping kører før dette callback.
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
      singleStageClick = false,
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
      (draft) => {
        const message = validateOnCommit?.(draft);
        if (message) {
          return { ok: false, kind: 'invalid', message };
        }
        return { ok: true, value: draft };
      },
      [validateOnCommit]
    );

    const { committedInvalidDraft, onCommitInvalid, clearInvalidDraft } = useFieldInvalidDraftChannel(onFieldError);

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
        clearInvalidDraft?.();
      },
      onCommitInvalid,
      committedInvalidDraft,
      inputElementRef: elementRefForHook as React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
      normalizeDraftOnCommit: trimWhitespaceEdges,
      commitOnBlur: false,
    });

    // Parse-/commit-fejl persisteres i invalidDrafts via useDraftField og vises afledt herfra.
    // Feltet har ingen separat blocksSave:false-fejl og rapporterer derfor ikke til fieldErrors-storen.
    const visibleLocalError = error;
    const resolvedHasError = externalHasError || Boolean(visibleLocalError?.message);
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

    const skipNextBlurCommitRef = React.useRef(false);

    const handleDraftChange = React.useCallback(
      (nextDraft: string) => {
        skipNextBlurCommitRef.current = false;
        setDraftBase(nextDraft);
        onDraftChange?.(createDraftChangeEvent(nextDraft));
      },
      [onDraftChange, setDraftBase]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => key, []);

    // Caret-etablering ved editor-åbning (to-trins-aktivering) ejes nu af hook'en
    // via `editableElementRef` + `shouldIgnoreBlur`. Se useTwoStageInputActivation.
    const inputActivation = useTwoStageInputActivation<HTMLElement>({
      disabled: Boolean(disabled),
      singleStageClick,
      getDraftForKey,
      onReplaceDraft: (nextDraft) => handleDraftChange(nextDraft),
      editableElementRef: inputElementRef,
    });

    const textAreaActivation = useTwoStageInputActivation<HTMLTextAreaElement>({
      disabled: Boolean(disabled),
      singleStageClick,
      getDraftForKey,
      onReplaceDraft: (nextDraft) => handleDraftChange(nextDraft),
      editableElementRef: textAreaElementRef,
    });

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // Ignorér det focus-event der stammer fra hook'ens programmatiske re-fokus
        // (caret-etablering ved editor-åbning, jf. useTwoStageInputActivation). Det må
        // IKKE gen-tage useDraftField's focus-snapshot: gør det det, fanger snapshot'et
        // den allerede-indtastede første-karakter (åbning via 'key'-vejen sætter draften
        // FØR re-fokus), og Escape-cancel gendanner så "a" i stedet for den committede
        // værdi. Symmetrisk med onBlur-grenens shouldIgnoreBlur-guard.
        const isProgrammaticRefocus = multiline
          ? textAreaActivation.shouldIgnoreBlur()
          : inputActivation.shouldIgnoreBlur();
        if (isProgrammaticRefocus) return;
        onFocusBase();
        onFocus?.(e);
      },
      [inputActivation, multiline, onFocus, onFocusBase, textAreaActivation]
    );

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
              const result = parseString(normalized);
              // Commit kun hvis rydningen faktisk ændrer noget — undgå overflødig undo-frame
              // (jf. StyledDateField/StyledAmountField).
              if (result.ok && (value !== result.value || committedInvalidDraft !== undefined)) {
                onCommit?.(createCommitEvent(result.value));
              }
              // Delete tømmer feltet → ryd evt. ikke-committbar rå draft (jf. StyledDateField).
              clearInvalidDraft?.();
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
            const result = parseString(normalized);
            // Commit kun hvis rydningen faktisk ændrer noget — undgå overflødig undo-frame
            // (jf. StyledDateField/StyledAmountField).
            if (result.ok && (value !== result.value || committedInvalidDraft !== undefined)) {
              onCommit?.(createCommitEvent(result.value));
            }
            // Delete tømmer feltet → ryd evt. ikke-committbar rå draft (jf. StyledDateField).
            clearInvalidDraft?.();
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
      [clearInvalidDraft, committedInvalidDraft, inputActivation, multiline, onCommit, onKeyDown, onKeyDownBase, parseString, setDraftBase, textAreaActivation, value]
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
            // Ignorér det blur der stammer fra hook'ens programmatiske re-fokus
            // (caret-etablering ved editor-åbning): ingen commit, ingen lukning.
            if (textAreaActivation.shouldIgnoreBlur()) return;
            onBlurBase(e);
            // Aldrig "unchanged" mens en ikke-committbar rå draft lever — ellers ryddes invalidDrafts ikke
            // ved clear/edit af et ugyldigt felt, og feltet re-syncer til den gamle ugyldige værdi (jf. StyledDateField).
            const unchanged = draft === value && committedInvalidDraft === undefined;
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
          // Symmetrisk med textarea-grenen: ignorér hook'ens programmatiske re-fokus.
          if (inputActivation.shouldIgnoreBlur()) return;
          onBlurBase(e);
          // Aldrig "unchanged" mens en ikke-committbar rå draft lever (jf. textarea-grenen ovenfor).
          const unchanged = draft === value && committedInvalidDraft === undefined;
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
