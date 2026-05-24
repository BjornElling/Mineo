import * as React from 'react';

import { useTableInputHistoryRestore } from '../useTableInputHistoryRestore';
import { useTableInputSaveError } from '../useTableInputSaveError';
import { useGridCellEditing, useGridCellFocus, useGridCoreApi } from '../../components/tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../components/tables/gridCore/gridCoreTypes';
import { assignRef } from '../../utils/refUtils';
import { copyWholeValueFromReadOnlyField, readClipboardText } from '../../utils/clipboardUtils';
import type { TableInputErrorInfo, TableInputErrorKind } from '../../utils/tableInputContracts';
import type { CommittedPayload } from '../../types/parserSpec';
import type { TableInputAdapter } from './tableInputAdapter';

export type TableInputChangeEvent<TValue> = Readonly<{ target: Readonly<{ value: TValue }> }>;

export type UseTableInputCoreOptions<TModel, TCanonical extends string, TFingerprint extends string> = Readonly<{
  adapter: TableInputAdapter<TModel, TCanonical, TFingerprint>;
  gridCell: GridCellCoord;
  value: TModel;
  locked?: boolean;
  onChange?: (e: TableInputChangeEvent<string>) => void;
  onBlur?: (e: TableInputChangeEvent<TModel>) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}>;

export type UseTableInputCoreResult = Readonly<{
  draft: string;
  committedDisplayValue: string;
  renderedValue: string;
  isFocused: boolean;
  touched: boolean;
  hasError: boolean;
  errorMessage: string;
  showError: boolean;
  errorKind: TableInputErrorKind;
  isEditing: boolean;
  isReadOnly: boolean;
  cellFocused: boolean;
  inputElRef: React.RefObject<HTMLInputElement | null>;
  inputRefCallback: (el: HTMLInputElement | null) => void;
  undoFocusToken: string;
  gridCellKey: string;
  a11yInputId: string;
  a11yErrorId: string;
  keyInitiatedEdit: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFocus: () => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  handleCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  handleDoubleClick: () => void;
}>;

const noopErrorInfo: TableInputErrorInfo = { hasError: false, kind: 'none' };
type LocalErrorKind = 'none' | 'input' | 'visual';

export const useTableInputCore = <TModel, TCanonical extends string, TFingerprint extends string>({
  adapter,
  gridCell,
  value,
  locked = false,
  onChange,
  onBlur,
  onErrorChange,
  externalErrorMessage,
  inputRef,
}: UseTableInputCoreOptions<TModel, TCanonical, TFingerprint>): UseTableInputCoreResult => {
  const gridApi = useGridCoreApi();
  const cellFocused = useGridCellFocus(gridCell);
  const isEditing = useGridCellEditing(gridCell);
  const isReadOnly = locked || !isEditing;

  const [draft, setDraft] = React.useState<string>(() => adapter.format(value));
  const [isFocused, setIsFocused] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [saveErrorActive, setSaveErrorActive] = React.useState(false);
  const [keyInitiatedEdit, setKeyInitiatedEdit] = React.useState(false);

  const inputElRef = React.useRef<HTMLInputElement | null>(null);
  const draftRef = React.useRef<string>(draft);
  const hasErrorRef = React.useRef(false);
  const pendingDraftCommitRef = React.useRef(false);
  const localErrorKindRef = React.useRef<LocalErrorKind>('none');
  const originalValueOnEditStartRef = React.useRef<string>('');
  const keyInitiatedEditRef = React.useRef(false);
  const wasEditingRef = React.useRef(false);
  const latestCommittedPayloadRef = React.useRef<CommittedPayload<TModel, TCanonical, TFingerprint>>(
    adapter.toCommittedPayload(value)
  );
  const latest = React.useRef({
    adapter,
    locked,
    onBlur,
    onChange,
    onErrorChange,
  });

  const undoFocusToken = React.useId();
  const a11yInputId = React.useId();
  const a11yErrorId = `${a11yInputId}-error`;
  const gridCellKey = `${gridCell.rowId}:${gridCell.colIndex}`;
  const committedDisplayValue = adapter.format(value);
  const committedVisualError = React.useMemo(() => {
    if (!touched || saveErrorActive) return '';
    return adapter.getCommittedVisualError?.(value)?.trim() ?? '';
  }, [adapter, saveErrorActive, touched, value]);

  const setLocalError = React.useCallback((message: string) => {
    hasErrorRef.current = true;
    setHasError(true);
    setErrorMessage(message);
    localErrorKindRef.current = 'input';
    setSaveErrorActive(true);
    latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
  }, []);

  const clearLocalError = React.useCallback((nextErrorInfo: TableInputErrorInfo = noopErrorInfo) => {
    hasErrorRef.current = false;
    setHasError(false);
    setErrorMessage('');
    localErrorKindRef.current = 'none';
    setSaveErrorActive(false);
    latest.current.onErrorChange?.(nextErrorInfo);
  }, []);

  const setVisualError = React.useCallback((message: string) => {
    hasErrorRef.current = true;
    setHasError(true);
    setErrorMessage(message);
    localErrorKindRef.current = 'visual';
    setSaveErrorActive(false);
    latest.current.onErrorChange?.({ hasError: true, kind: 'visual' });
  }, []);

  const resetEditingState = React.useCallback(() => {
    keyInitiatedEditRef.current = false;
    setKeyInitiatedEdit(false);
  }, []);

  const { clearPendingHistoryResync } = useTableInputHistoryRestore<TModel>({
    value,
    formatCommittedValue: adapter.format,
    inputElementRef: inputElRef,
    isEditing,
    preserveDraft: Boolean(
      pendingDraftCommitRef.current ||
      (adapter.preserveInvalidDraft ?? true) &&
      (saveErrorActive || ((adapter.preserveVisualErrorDraft ?? true) && committedVisualError !== ''))
    ),
    draftRef,
    setDraft,
    focusToken: undoFocusToken,
    fieldPath: gridCellKey,
    resetEditingState,
    onRestoreError: (state) => {
      setTouched(true);
      setLocalError(state.error.message ?? '');
    },
    onRestoreCommitted: () => {
      setTouched(false);
      clearLocalError();
    },
  });

  React.useLayoutEffect(() => {
    latest.current = {
      adapter,
      locked,
      onBlur,
      onChange,
      onErrorChange,
    };
  }, [adapter, locked, onBlur, onChange, onErrorChange]);

  React.useLayoutEffect(() => {
    const previousFingerprint = latestCommittedPayloadRef.current.fingerprint;
    const nextPayload = adapter.toCommittedPayload(value);
    latestCommittedPayloadRef.current = nextPayload;
    if (!isEditing && hasErrorRef.current && localErrorKindRef.current === 'visual') {
      const nextVisualError = adapter.getCommittedVisualError?.(nextPayload.model)?.trim() ?? '';
      clearLocalError(nextVisualError !== '' ? { hasError: true, kind: 'visual' } : noopErrorInfo);
      return;
    }
    if (!isEditing && previousFingerprint !== nextPayload.fingerprint && hasErrorRef.current && saveErrorActive) {
      clearLocalError();
      setTouched(false);
    }
  }, [adapter, clearLocalError, isEditing, saveErrorActive, value]);

  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  React.useEffect(() => {
    latest.current.onErrorChange?.(noopErrorInfo);
  }, []);

  React.useLayoutEffect(() => {
    const wasEditing = wasEditingRef.current;
    wasEditingRef.current = isEditing;
    if (!isEditing) {
      resetEditingState();
      return;
    }
    if (wasEditing) return;
    if (!keyInitiatedEditRef.current) {
      if ((adapter.preserveInvalidDraft ?? true) && hasErrorRef.current) {
        originalValueOnEditStartRef.current = draftRef.current;
        return;
      }
      const committedValue = adapter.toDraftString?.(value) ?? adapter.format(value);
      originalValueOnEditStartRef.current = committedValue;
      draftRef.current = committedValue;
      setDraft(committedValue);
    }
  }, [adapter, isEditing, resetEditingState, value]);

  const commitAndEmitBlur = React.useCallback(
    (rawDraft: string): boolean => {
      pendingDraftCommitRef.current = false;
      setTouched(true);
      const current = latest.current;
      const parsed = current.adapter.parse(rawDraft);
      if (!parsed.ok) {
        setLocalError(parsed.errorMessage);
        return false;
      }

      const nextPayload = current.adapter.toCommittedPayload(parsed.value);
      const isNoop = nextPayload.fingerprint === latestCommittedPayloadRef.current.fingerprint;
      if (parsed.visualErrorMessage !== undefined && parsed.visualErrorMessage.trim() !== '') {
        setVisualError(parsed.visualErrorMessage);
      } else {
        clearLocalError();
      }
      if (isNoop) return true;

      current.onBlur?.({ target: { value: nextPayload.model } });
      return true;
    },
    [clearLocalError, setLocalError, setVisualError]
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly) return;
      const rawDraft = e.target.value ?? '';
      const nextDraft = latest.current.adapter.normalizeDraftChange?.(rawDraft) ?? rawDraft;
      clearPendingHistoryResync();
      if (latest.current.adapter.clearErrorOnChange) {
        clearLocalError();
      }
      if (latest.current.adapter.clearTouchedOnEmptyDraft && nextDraft === '') {
        setTouched(false);
      }
      draftRef.current = nextDraft;
      pendingDraftCommitRef.current = true;
      setDraft(nextDraft);
      latest.current.onChange?.({ target: { value: nextDraft } });
    },
    [clearLocalError, clearPendingHistoryResync, isReadOnly]
  );

  const handleFocus = React.useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      if (latest.current.locked) {
        pendingDraftCommitRef.current = false;
        return;
      }
      const shouldCommit = !e.currentTarget.readOnly || pendingDraftCommitRef.current;
      if (!shouldCommit) return;
      const rawValue = e.currentTarget.readOnly && pendingDraftCommitRef.current
        ? draftRef.current
        : e.currentTarget.value ?? '';
      commitAndEmitBlur(rawValue);
    },
    [commitAndEmitBlur]
  );

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (latest.current.adapter.filterKeyDown?.(e, { isEditing, hasError })) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [hasError, isEditing]);

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const applyPaste = latest.current.adapter.applyPaste;
      if (!applyPaste) return;

      e.preventDefault();
      e.stopPropagation();
      const raw = readClipboardText(e);
      const applied = applyPaste(raw, {
        currentDraft: draftRef.current,
        isEditing,
        selectionStart: typeof e.currentTarget.selectionStart === 'number' ? e.currentTarget.selectionStart : null,
        selectionEnd: typeof e.currentTarget.selectionEnd === 'number' ? e.currentTarget.selectionEnd : null,
      });
      if (applied === null) return;

      clearPendingHistoryResync();
      draftRef.current = applied.draft;
      pendingDraftCommitRef.current = true;
      setDraft(applied.draft);
      latest.current.onChange?.({ target: { value: applied.draft } });
      if (!isEditing) {
        commitAndEmitBlur(applied.draft);
        setIsFocused(true);
        return;
      }
      if (typeof applied.caretPosition === 'number') {
        const caretPosition = applied.caretPosition;
        requestAnimationFrame(() => {
          const el = inputElRef.current;
          if (!el) return;
          try {
            el.setSelectionRange(caretPosition, caretPosition);
          } catch {
            // Browseren kan afvise selection på visse inputtyper; draften er stadig sat.
          }
        });
      }
    },
    [clearPendingHistoryResync, commitAndEmitBlur, isEditing]
  );

  const handleCopy = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      copyWholeValueFromReadOnlyField(e, {
        isReadOnly,
        value: isEditing || (touched && hasErrorRef.current && localErrorKindRef.current !== 'none')
          ? draft
          : adapter.toClipboardString?.(value) ?? adapter.format(value),
        selectionStart: e.currentTarget.selectionStart,
        selectionEnd: e.currentTarget.selectionEnd,
      });
    },
    [adapter, draft, isEditing, isReadOnly, touched, value]
  );

  const handleDoubleClick = React.useCallback(() => {
    if (latest.current.locked) return;
    gridApi.openEditing(gridCell, 'doubleClick');
  }, [gridApi, gridCell]);

  const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
    return {
      getElement: () => inputElRef.current,
      getIsLocked: () => latest.current.locked ?? false,
      commitCurrent: () => {
        if (latest.current.locked) return true;
        const ok = commitAndEmitBlur(inputElRef.current?.value ?? draftRef.current);
        if (!ok) return false;
        setIsFocused(false);
        gridApi.closeEditing();
        return true;
      },
      clearAndCommit: () => {
        if (latest.current.locked) return;
        resetEditingState();
        pendingDraftCommitRef.current = false;
        setTouched(false);
        draftRef.current = '';
        setDraft('');
        const ok = commitAndEmitBlur('');
        if (!ok) return;
        gridApi.closeEditing();
      },
      cancelEdit: () => {
        if (latest.current.locked) return;
        resetEditingState();
        pendingDraftCommitRef.current = false;
        setTouched(false);
        clearLocalError();
        draftRef.current = originalValueOnEditStartRef.current;
        setDraft(originalValueOnEditStartRef.current);
        gridApi.closeEditing();
      },
      prepareEditFromKey: (key: string) => {
        if (latest.current.locked) return false;
        if (!latest.current.adapter.isValidStartKey(key)) return false;
        const committedValue =
          latest.current.adapter.toDraftString?.(latestCommittedPayloadRef.current.model) ??
          latest.current.adapter.format(latestCommittedPayloadRef.current.model);
        originalValueOnEditStartRef.current = committedValue;
        keyInitiatedEditRef.current = true;
        setKeyInitiatedEdit(true);
        setTouched(false);
        if (latest.current.adapter.clearErrorOnChange) {
          clearLocalError();
        }
        draftRef.current = key;
        pendingDraftCommitRef.current = true;
        setDraft(key);
        requestAnimationFrame(() => {
          const el = inputElRef.current;
          if (!el) return;
          try {
            el.setSelectionRange(el.value.length, el.value.length);
          } catch {
            // Browseren kan afvise selection på visse inputtyper; edit-start er stadig gyldig.
          }
        });
        return true;
      },
      selectAll: () => {
        requestAnimationFrame(() => inputElRef.current?.select());
      },
    };
  }, [clearLocalError, commitAndEmitBlur, gridApi, resetEditingState]);

  React.useEffect(() => {
    gridApi.registerEditor(gridCell, editorHandle);
    return () => {
      gridApi.unregisterEditor(gridCell);
    };
    // gridCellKey er en stabil streng-repræsentation af gridCell-koordinaterne.
    // gridCell er intentionelt udeladt fra dep-arrayet for at undgå re-registrering
    // ved inline object literals i caller (ny reference, samme værdier).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorHandle, gridApi, gridCellKey]);

  useTableInputSaveError({
    key: a11yErrorId,
    active: Boolean(adapter.useSaveError && saveErrorActive),
    message: errorMessage,
    inputRef: inputElRef,
  });

  const externalErrorText = (externalErrorMessage ?? '').trim();
  const hasInputError = hasErrorRef.current && localErrorKindRef.current === 'input';
  const hasCommittedVisualError = committedVisualError !== '';
  const hasLocalVisualError =
    hasErrorRef.current &&
    localErrorKindRef.current === 'visual' &&
    (adapter.getCommittedVisualError === undefined || hasCommittedVisualError);
  const displayErrorMessage = hasInputError ? errorMessage : hasCommittedVisualError ? committedVisualError : hasLocalVisualError ? errorMessage : externalErrorText;
  const hasExternalError = externalErrorText !== '';
  const effectiveHasError = hasInputError || hasLocalVisualError || hasCommittedVisualError;
  const errorKind: TableInputErrorKind = hasInputError ? 'input' : hasLocalVisualError || hasCommittedVisualError ? 'visual' : 'none';
  const showError = (effectiveHasError || hasExternalError) && !isFocused && (touched || !isEditing);
  const renderedValue = isEditing || (touched && (hasInputError || hasLocalVisualError)) ? draft : committedDisplayValue;

  const inputRefCallback = React.useCallback(
    (el: HTMLInputElement | null) => {
      inputElRef.current = el;
      assignRef(inputRef, el);
    },
    [inputRef]
  );

  return {
    draft,
    committedDisplayValue,
    renderedValue,
    isFocused,
    touched,
    hasError: effectiveHasError,
    errorMessage: displayErrorMessage,
    showError,
    errorKind,
    isEditing,
    isReadOnly,
    cellFocused,
    inputElRef,
    inputRefCallback,
    undoFocusToken,
    gridCellKey,
    a11yInputId,
    a11yErrorId,
    keyInitiatedEdit,
    handleChange,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handlePaste,
    handleCopy,
    handleDoubleClick,
  };
};
