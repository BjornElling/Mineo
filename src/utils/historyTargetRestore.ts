import { type HistoryFrame } from '../stores/undoRedoStore';
import { scrollTargetIntoView } from './scrollTargetIntoView';

const attrSelector = (attr: string, value: string): string => `[${attr}=${JSON.stringify(value)}]`;
const attrTokenSelector = (attr: string, value: string): string => `[${attr}~=${JSON.stringify(value)}]`;

const HISTORY_TARGET_RESTORE_MAX_ATTEMPTS = 15;

// Sat mens undo/redo flytter fokus programmatisk (focusRestoredField). Mens det er sat, må felt-/celle-
// blur IKKE committe: blur'et skyldes fokus-flytningen, ikke en brugerredigering, og draften kan endnu
// være forældet (resync er ikke nødvendigvis flushet). Aflæses via isRestoreFocusInProgress().
let restoreFocusInProgress = false;

/** Er en programmatisk undo/redo-fokus-flytning i gang? Commit-stier bruger dette til at undertrykke
 *  blur-commit af et felt, der mister fokus pga. restore (ville committe en forældet draft). */
export const isRestoreFocusInProgress = (): boolean => restoreFocusInProgress;

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
    selectors.push(attrTokenSelector('data-mineo-undo-field-path-aliases', frame.origin.fieldPath));
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
  // Scroll kun hvis det redigerede felt ikke allerede er synligt; ellers centrér det i vinduet
  // (samme adfærd som tab-navigation). Tidligere blev hele sektionen scrollet til toppen, hvilket
  // gav et uønsket spring helt op selv når feltet allerede var synligt. Vi scroller FØR focus, så
  // den efterfølgende `focus({ preventScroll: true })` ikke konkurrerer med scroll-animationen.
  scrollTargetIntoView(target);
  // Undertryk commit mens vi flytter fokus programmatisk: target.focus() udløser SYNKRONT et blur på
  // det tidligere fokuserede felt. Det felts blur-commit ville ellers committe en FORÆLDET draft (fra
  // før epoch-resync nåede at opdatere den) → den netop-gendannede invalidDraft ryddes, og en spuriøs
  // frame fanges der nulstiller redo-stakken. Flaget aflæses af useDraftField/useTableInputCore-commit.
  restoreFocusInProgress = true;
  try {
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  } finally {
    restoreFocusInProgress = false;
  }

  const activeElement = document.activeElement;
  const focused = activeElement === target || (activeElement instanceof Node && target.contains(activeElement));
  if (focused) {
    markRestoreFocus(target);
  }
  return focused;
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

/**
 * Efter en undo/redo-restore: re-targetér fokus til det felt/celle, hvis ændring framet kom fra.
 *
 * Selve værdi-/draft-gendannelsen sker via det restored store-snapshot (sektioner + `invalidDrafts`)
 * plus den autoritative epoch-resync i `useDraftField`/`useTableInputCore` — IKKE her. Denne funktion
 * flytter kun fokus (og scroller) hen til det rette element, når det er mountet på den restored fane.
 */
export const scheduleHistoryTargetRestore = (frame: HistoryFrame): void => {
  if (!frame.origin.fieldPath && !frame.origin.focusToken) return;

  const originalActiveElement = document.activeElement;

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
