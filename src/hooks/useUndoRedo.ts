import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formPersistenceStore } from '../stores/formPersistenceStore';
import { type HistoryFrame, undoRedoStore } from '../stores/undoRedoStore';
import { writePersistenceSectionsToSessionStorageWithRollback } from '../utils/persistenceSnapshotStorage';
import { restoreDraftHistoryTarget, type DraftHistoryRestoreState } from '../utils/draftHistoryRegistry';
import { resolveActiveFieldError } from '../types/fieldErrors';
import { setActiveTabForPage } from './usePersistedActiveTab';

const routeToPageId = (route: string): string => route.replace(/^\/+/, '') || 'stamdata';

const attrSelector = (attr: string, value: string): string => `[${attr}=${JSON.stringify(value)}]`;

const FOCUS_RESTORE_MAX_ATTEMPTS = 60;

const isRestoreTargetVisible = (element: HTMLElement): boolean => {
  if (!element.isConnected) return false;
  if (element.hasAttribute('hidden')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hasAttribute('hidden')) return false;
    if (current.getAttribute('aria-hidden') === 'true') return false;

    const style = window.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }

  return true;
};

const findRestoredField = (frame: HistoryFrame): HTMLElement | null => {
  const selectors: string[] = [];
  if (frame.origin.fieldPath) {
    selectors.push(attrSelector('data-mineo-undo-field-path', frame.origin.fieldPath));
  }
  if (frame.origin.focusToken) {
    selectors.push(attrSelector('data-mineo-undo-focus-token', frame.origin.focusToken));
  }

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element instanceof HTMLElement && isRestoreTargetVisible(element)) {
        return element;
      }
    }
  }
  return null;
};

const focusRestoredField = (target: HTMLElement): boolean => {
  // Genbrug "fejl og advarsler"-scroll-mønsteret: scroll til feltets indeholdende sektion
  // (block: 'start') hvis vi finder en, ellers til feltet selv. Sætter derefter fokus uden
  // ekstra scroll, så browseren ikke flytter sig efter sektion-scroll'en.
  const section = target.closest('[data-section-id]');
  if (section instanceof HTMLElement) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }

  const activeElement = document.activeElement;
  return activeElement === target || (activeElement instanceof Node && target.contains(activeElement));
};

const scheduleFocusRestore = (frame: HistoryFrame): void => {
  // Tab- og side-skift kan udløse async mount af det målrettede felt; retry over flere
  // frames indtil feltet findes eller vi giver op (samme mønster som useScrollToSectionWithRetry).
  let attempts = 0;
  const tick = () => {
    const target = findRestoredField(frame);
    if (target && focusRestoredField(target)) {
      return;
    }
    attempts += 1;
    if (attempts < FOCUS_RESTORE_MAX_ATTEMPTS) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
};

const resolveDraftRestoreState = (frame: HistoryFrame): DraftHistoryRestoreState => {
  const fieldPath = frame.origin.fieldPath;
  if (fieldPath) {
    const bySource = frame.fieldErrors[frame.origin.sectionKey]?.[fieldPath];
    const activeError = bySource ? resolveActiveFieldError(bySource) : undefined;
    if (
      activeError?.severity === 'error' &&
      activeError.blocksSave !== false &&
      typeof activeError.invalidDraft === 'string'
    ) {
      return {
        kind: 'error',
        draft: activeError.invalidDraft,
        error: {
          kind: 'invalid',
          message: activeError.message,
          invalidDraft: activeError.invalidDraft,
        },
      };
    }
  }

  return { kind: 'committed' };
};

const scheduleDraftRestore = (frame: HistoryFrame): void => {
  const state = resolveDraftRestoreState(frame);
  let attempts = 0;
  const tick = () => {
    const restored = restoreDraftHistoryTarget(
      { focusToken: frame.origin.focusToken, fieldPath: frame.origin.fieldPath },
      state
    );
    attempts += 1;
    if (!restored && attempts < FOCUS_RESTORE_MAX_ATTEMPTS) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
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
    scheduleDraftRestore(frame);
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
