import { scrollTargetIntoView } from '../../utils/scrollTargetIntoView';
import { withRestoreFocusSuppressed } from './restoreFocusFlag';

// Den ENE undo/redo-fokusrestore-løkke (§3.7). Runtime-neutral: kalderen leverer KUN `findTarget`, der
// lokaliserer det synlige fokusmål. Den fælles adfærd — vent-på-mount over faneskift, scroll-hvis-ikke-synlig,
// fokus-ring-markør, blur-commit-undertrykkelse under den programmatiske fokus, og AFBRYDELSE hvis brugeren
// imens flytter fokus til et andet brugbart felt — bor ÉT sted.
//
// Målopslaget selv ejes af `historyRestoreTarget` (feltadresse + editorlokation). Der findes ingen anden
// restore-vej og ingen anden feltidentitet i DOM; grænsen håndhæves af `input/single-field-identity-in-dom`.

export const HISTORY_TARGET_RESTORE_MAX_ATTEMPTS = 15;

/**
 * Er elementet synligt som fokusmål? Ét sandt sted for restore-synlighed: målopslaget (feltadresse +
 * editorlokation) og løkken bruger SAMME prædikat, så et element ikke kan gælde som fundet men uegnet.
 */
export const isRestoreTargetVisible = (element: HTMLElement): boolean => {
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
  // før resync nåede at opdatere den) → en spuriøs frame, der nulstiller redo-stakken. Flaget bor i
  // `restoreFocusFlag` og aflæses af commit-stierne.
  withRestoreFocusSuppressed(() => {
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  });

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
 * Den delte rAF-retry-restore-løkke (§3.7). Runtime-agnostisk: kalderen leverer KUN `findTarget`, der lokaliserer
 * det synlige fokusmål (feltadresse + editorlokation, jf. `historyRestoreTarget`). Den fælles adfærd —
 * vent-på-mount over faneskift, scroll-hvis-ikke-synlig, fokus-ring-markør, blur-commit-undertrykkelse under den
 * programmatiske fokus, og AFBRYDELSE hvis brugeren imens flytter fokus til et andet brugbart felt — bor ÉT sted.
 */
export const runHistoryTargetRestoreLoop = (findTarget: () => HTMLElement | null): void => {
  const originalActiveElement = document.activeElement;

  let attempts = 0;
  const tick = () => {
    const target = findTarget();
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
