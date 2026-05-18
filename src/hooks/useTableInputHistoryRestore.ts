import * as React from 'react';

import {
  registerDraftHistoryController,
  type DraftHistoryRestoreState,
} from '../utils/draftHistoryRegistry';

type DraftHistoryErrorRestoreState = Extract<DraftHistoryRestoreState, { kind: 'error' }>;

export type UseTableInputHistoryRestoreOptions<TValue> = Readonly<{
  value: TValue;
  formatCommittedValue: (value: TValue) => string;
  inputElementRef: React.RefObject<HTMLInputElement | null>;
  isEditing: boolean;
  preserveDraft: boolean;
  draftRef: React.MutableRefObject<string>;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  focusToken: string;
  fieldPath: string;
  resetEditingState: () => void;
  onRestoreError: (state: DraftHistoryErrorRestoreState) => void;
  onRestoreCommitted: () => void;
}>;

export type UseTableInputHistoryRestoreResult = Readonly<{
  clearPendingHistoryResync: () => void;
}>;

export const useTableInputHistoryRestore = <TValue,>({
  value,
  formatCommittedValue,
  inputElementRef,
  isEditing,
  preserveDraft,
  draftRef,
  setDraft,
  focusToken,
  fieldPath,
  resetEditingState,
  onRestoreError,
  onRestoreCommitted,
}: UseTableInputHistoryRestoreOptions<TValue>): UseTableInputHistoryRestoreResult => {
  const latestCommittedDisplayRef = React.useRef(formatCommittedValue(value));
  const pendingHistoryValueResyncRef = React.useRef(false);
  const latestCallbacksRef = React.useRef({
    resetEditingState,
    onRestoreError,
    onRestoreCommitted,
  });

  const syncDraft = React.useCallback(
    (nextDraft: string) => {
      draftRef.current = nextDraft;
      setDraft((current) => (current === nextDraft ? current : nextDraft));
    },
    [draftRef, setDraft]
  );

  React.useLayoutEffect(() => {
    latestCommittedDisplayRef.current = formatCommittedValue(value);
  }, [formatCommittedValue, value]);

  React.useLayoutEffect(() => {
    latestCallbacksRef.current = {
      resetEditingState,
      onRestoreError,
      onRestoreCommitted,
    };
  }, [onRestoreCommitted, onRestoreError, resetEditingState]);

  React.useEffect(() => {
    const nextCommittedDisplay = latestCommittedDisplayRef.current;

    if (pendingHistoryValueResyncRef.current) {
      pendingHistoryValueResyncRef.current = false;
      syncDraft(nextCommittedDisplay);
      return;
    }

    if (isEditing) return;
    const inputEl = inputElementRef.current;
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const hasPhysicalFocus =
      inputEl !== null &&
      activeEl !== null &&
      (activeEl === inputEl || (activeEl instanceof Node && inputEl.contains(activeEl)));
    if (hasPhysicalFocus) return;
    if (preserveDraft) return;
    syncDraft(nextCommittedDisplay);
  }, [formatCommittedValue, inputElementRef, isEditing, preserveDraft, syncDraft, value]);

  const restoreFromHistory = React.useCallback(
    (state: DraftHistoryRestoreState) => {
      const callbacks = latestCallbacksRef.current;
      callbacks.resetEditingState();
      if (state.kind === 'error') {
        pendingHistoryValueResyncRef.current = false;
        syncDraft(state.draft);
        callbacks.onRestoreError(state);
        return;
      }

      pendingHistoryValueResyncRef.current = true;
      syncDraft(latestCommittedDisplayRef.current);
      callbacks.onRestoreCommitted();
    },
    [syncDraft]
  );

  React.useEffect(() => {
    return registerDraftHistoryController(
      { focusToken, fieldPath },
      { restoreFromHistory }
    );
  }, [fieldPath, focusToken, restoreFromHistory]);

  const clearPendingHistoryResync = React.useCallback(() => {
    pendingHistoryValueResyncRef.current = false;
  }, []);

  return { clearPendingHistoryResync };
};
