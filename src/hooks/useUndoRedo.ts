import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formPersistenceStore } from '../stores/formPersistenceStore';
import { type HistoryFrame, undoRedoStore } from '../stores/undoRedoStore';
import { writePersistenceSectionsToSessionStorageWithRollback } from '../utils/persistenceSnapshotStorage';
import { setActiveTabForPage } from './usePersistedActiveTab';

const routeToPageId = (route: string): string => route.replace(/^\/+/, '') || 'stamdata';

const attrSelector = (attr: string, value: string): string => `[${attr}=${JSON.stringify(value)}]`;

const focusRestoredField = (frame: HistoryFrame): void => {
  const selectors: string[] = [];
  if (frame.origin.focusToken) {
    selectors.push(attrSelector('data-mineo-undo-focus-token', frame.origin.focusToken));
  }
  if (frame.origin.fieldPath) {
    selectors.push(attrSelector('data-mineo-undo-field-path', frame.origin.fieldPath));
  }

  const focusable = selectors
    .map((selector) => document.querySelector(selector))
    .find((element): element is HTMLElement => element instanceof HTMLElement);

  if (!focusable) return;
  focusable.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  focusable.focus({ preventScroll: true });
};

const scheduleFocusRestore = (frame: HistoryFrame): void => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => focusRestoredField(frame));
  });
};

const restoreFrame = (frame: HistoryFrame): void => {
  writePersistenceSectionsToSessionStorageWithRollback(frame.sections, () => {
    formPersistenceStore.getState().restoreHistorySections(
      frame.sections,
      frame.sectionRevisions,
      frame.meta
    );
    formPersistenceStore.getState().restoreFieldErrors(frame.fieldErrors, frame.fieldErrorRevisions);
  });
};

export const useUndoRedo = () => {
  const navigate = useNavigate();
  const [availability, setAvailability] = React.useState(() => ({
    canUndo: undoRedoStore.getState().canUndo(),
    canRedo: undoRedoStore.getState().canRedo(),
  }));

  React.useEffect(() => {
    return undoRedoStore.subscribe((state) => {
      setAvailability({
        canUndo: state.canUndo(),
        canRedo: state.canRedo(),
      });
    });
  }, []);

  const applyHistoryFrame = React.useCallback((frame: HistoryFrame | null) => {
    if (!frame) return;
    restoreFrame(frame);
    if (frame.origin.tabKey !== null) {
      setActiveTabForPage(routeToPageId(frame.origin.route), frame.origin.tabKey);
    }
    navigate(frame.origin.route);
    scheduleFocusRestore(frame);
  }, [navigate]);

  const undo = React.useCallback(() => {
    applyHistoryFrame(undoRedoStore.getState().undo());
  }, [applyHistoryFrame]);

  const redo = React.useCallback(() => {
    applyHistoryFrame(undoRedoStore.getState().redo());
  }, [applyHistoryFrame]);

  return {
    canUndo: availability.canUndo,
    canRedo: availability.canRedo,
    undo,
    redo,
  };
};
