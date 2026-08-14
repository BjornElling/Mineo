import { scrollTargetIntoView } from '../../utils/scrollTargetIntoView';

// Den ENE undo/redo-fokusrestore-løkke (§3.7). Runtime-neutral: kalderen leverer KUN `findTarget`, der
// lokaliserer det synlige fokusmål. Den fælles adfærd — vent-på-mount over faneskift, scroll-hvis-ikke-synlig,
// fokus-ring-markør og AFBRYDELSE hvis brugeren imens flytter fokus til et andet brugbart felt — bor ÉT sted.
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
  // Her stod tidligere en blur-commit-undertrykkelse (`withRestoreFocusSuppressed` +
  // `isRestoreFocusInProgress`) mod en FORÆLDET draft: `target.focus()` udløser synkront et blur på det
  // tidligere fokuserede felt, hvis blur-commit så ville lande en draft fra før resync. Værnet er slettet,
  // fordi den tilstand ikke kan opstå: undo/redo er `noop` ved åben editor
  // (`criticalActionCoordinator`s EDITOR_HANDLING), så `history.undo()` — og dermed denne løkke — nås
  // aldrig, mens en draft er åben. Setteren fandtes desuden uden nogen læser, så undertrykkelsen var
  // alligevel en no-op. Genindfør den ikke uden først at ændre den noop-politik.
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
 * En felt-origin, hvis fokusmål ALDRIG dukker op, er en brudt invariant — ikke en tolerabel hændelse.
 *
 * Undo/redo-kontrakten §5 siger, at en felt-origin identificerer den editorlokation, ændringen kom fra. Efter en
 * gennemført restore er den tilstand aktuel igen, og lokationen skal derfor findes i DOM. Sker det ikke, peger
 * originen på en identitet, fladen ikke kan levere: en tabel, der har skiftet et række-id under brugeren,
 * en surface, der har glemt restore-attributterne, en editorlokation hvis id er skredet, eller en route/fane, der
 * ikke blev navigeret til.
 *
 * Klassen var usynlig, fordi løkken opgav TAVST: brugeren så blot, at fokus ikke flyttede sig. Værnet gør den
 * opdagelig efter husets console-politik — høj-lydt i udvikling (hvor devtools-monitoren opsamler det), tavs i
 * produktion, hvor manglende fokus er en skavank og ikke må blive til en fejlskærm.
 */
const reportUnreachableRestoreTarget = (describeTarget?: () => string): void => {
  if (!import.meta.env.DEV) return;
  const description = describeTarget?.() ?? 'ukendt mål';
  console.error(
    `[undo/redo] Fokusrestoren fandt aldrig sit mål (${description}) efter ${String(HISTORY_TARGET_RESTORE_MAX_ATTEMPTS)} forsøg. ` +
      'En felt-origin skal kunne findes i DOM, når dens tilstand er gendannet (undo-redo-contract §5). ' +
      'Kontrollér, at fladen bevarer rækkens/feltets identitet på tværs af undo/redo, og at den sætter restore-attributterne.'
  );
};

/**
 * Den delte rAF-retry-restore-løkke (§3.7). Runtime-agnostisk: kalderen leverer KUN `findTarget`, der lokaliserer
 * det synlige fokusmål (feltadresse + editorlokation, jf. `historyRestoreTarget`). Den fælles adfærd —
 * vent-på-mount over faneskift, scroll-hvis-ikke-synlig, fokus-ring-markør og AFBRYDELSE hvis brugeren imens
 * flytter fokus til et andet brugbart felt — bor ÉT sted.
 *
 * `describeTarget` bruges KUN i diagnostikken, når målet aldrig dukker op. Den er en funktion, så en serialisering
 * af originen ikke betales, når restoren lykkes (det normale forløb).
 */
export const runHistoryTargetRestoreLoop = (
  findTarget: () => HTMLElement | null,
  describeTarget?: () => string
): void => {
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
      return;
    }
    // Opbrugte forsøg — og brugeren har IKKE selv flyttet fokus væk (det tilfælde returnerer ovenfor).
    // Målet findes altså ikke, og det er en brudt invariant frem for et normalt udfald.
    reportUnreachableRestoreTarget(describeTarget);
  };
  requestAnimationFrame(tick);
};
