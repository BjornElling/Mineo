import type { DraftFieldError } from '../hooks/useDraftField';

export type DraftHistoryRestoreState =
  | Readonly<{
      kind: 'error';
      draft: string;
      error: DraftFieldError;
    }>
  | Readonly<{
      kind: 'committed';
    }>;

type DraftHistoryController = Readonly<{
  restoreFromHistory: (state: DraftHistoryRestoreState) => void;
}>;

const controllersByFocusToken = new Map<string, DraftHistoryController>();
const controllersByFieldPath = new Map<string, DraftHistoryController>();

export const registerDraftHistoryController = (
  keys: Readonly<{ focusToken: string | null; fieldPath: string | null }>,
  controller: DraftHistoryController
): (() => void) => {
  if (keys.focusToken) {
    controllersByFocusToken.set(keys.focusToken, controller);
  }
  if (keys.fieldPath) {
    controllersByFieldPath.set(keys.fieldPath, controller);
  }

  return () => {
    if (keys.focusToken && controllersByFocusToken.get(keys.focusToken) === controller) {
      controllersByFocusToken.delete(keys.focusToken);
    }
    if (keys.fieldPath && controllersByFieldPath.get(keys.fieldPath) === controller) {
      controllersByFieldPath.delete(keys.fieldPath);
    }
  };
};

export const restoreDraftHistoryTarget = (
  keys: Readonly<{ focusToken: string | null; fieldPath: string | null }>,
  state: DraftHistoryRestoreState
): boolean => {
  const byFieldPath = keys.fieldPath ? controllersByFieldPath.get(keys.fieldPath) : undefined;
  const controller = byFieldPath ?? (keys.focusToken ? controllersByFocusToken.get(keys.focusToken) : undefined);
  if (!controller) return false;
  controller.restoreFromHistory(state);
  return true;
};
