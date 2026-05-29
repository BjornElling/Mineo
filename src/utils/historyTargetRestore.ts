import { type HistoryFrame } from '../stores/undoRedoStore';
import { resolveActiveFieldError } from '../types/fieldErrors';
import { restoreDraftHistoryTarget, type DraftHistoryRestoreState } from './draftHistoryRegistry';

const attrSelector = (attr: string, value: string): string => `[${attr}=${JSON.stringify(value)}]`;

const HISTORY_TARGET_RESTORE_MAX_ATTEMPTS = 15;

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

/**
 * Markér det restore-fokuserede element, så komponenter kan tegne en synlig fokus-ring.
 *
 * Programmatisk `focus()` sætter DOM-fokus, men udløser IKKE browserens/MUI's
 * `:focus-visible`/`.Mui-focusVisible` (den vises kun ved tastatur-navigation). Uden et
 * eksplicit signal får fx en toggle switch derfor ingen visuel indikation ved undo/redo.
 * Markeringen ryddes ved blur, så den kun er synlig indtil brugeren bevæger sig videre.
 */
const UNDO_FOCUS_MARKER = 'data-mineo-undo-focused';

const markRestoreFocus = (target: HTMLElement): void => {
  target.setAttribute(UNDO_FOCUS_MARKER, 'true');
  const clear = () => target.removeAttribute(UNDO_FOCUS_MARKER);
  target.addEventListener('blur', clear, { once: true });
  // Hvis brugeren begynder at indtaste/skifte uden at blur'e først, ryd også da.
  target.addEventListener('input', clear, { once: true });
  target.addEventListener('keydown', clear, { once: true });
};

const focusRestoredField = (target: HTMLElement): boolean => {
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
  const focused = activeElement === target || (activeElement instanceof Node && target.contains(activeElement));
  if (focused) {
    markRestoreFocus(target);
  }
  return focused;
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

const isFocusableUserTarget = (element: HTMLElement): boolean => {
  return element.matches('input, textarea, select, button, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]');
};

const isSameFocusScope = (activeElement: HTMLElement, originalActiveElement: Element | null, target: HTMLElement | null): boolean => {
  if (target && (activeElement === target || target.contains(activeElement))) return true;
  if (originalActiveElement instanceof Node) {
    return activeElement === originalActiveElement || originalActiveElement.contains(activeElement);
  }
  return false;
};

export const scheduleHistoryTargetRestore = (frame: HistoryFrame): void => {
  if (!frame.origin.fieldPath && !frame.origin.focusToken) return;

  const state = resolveDraftRestoreState(frame);
  const originalActiveElement = document.activeElement;

  // Draft-restore must be a one-shot: calling restoreFromHistory multiple times for the same
  // frame would re-apply suppressNextBlurCommit and clobber any user edits made between ticks.
  let draftRestored = false;
  let attempts = 0;
  const tick = () => {
    const target = findRestoredField(frame);
    const activeElement = document.activeElement;
    if (
      attempts > 0 &&
      activeElement instanceof HTMLElement &&
      activeElement !== document.body &&
      !isSameFocusScope(activeElement, originalActiveElement, target) &&
      isFocusableUserTarget(activeElement)
    ) {
      return;
    }

    if (target) {
      if (!draftRestored) {
        draftRestored = restoreDraftHistoryTarget(
          { focusToken: frame.origin.focusToken, fieldPath: frame.origin.fieldPath },
          state
        );
      }
      const focused = focusRestoredField(target);
      if (focused) return;
    }
    attempts += 1;
    if (attempts < HISTORY_TARGET_RESTORE_MAX_ATTEMPTS) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
};
