/**
 * Sporer det senest fokuserede felt der bærer undo-attributter
 * (`data-mineo-undo-focus-token` / `data-mineo-undo-field-path`).
 *
 * Hvorfor: Et felt-commit udløses typisk af `onBlur` *efter* fokus er flyttet til
 * et andet felt. På commit-tidspunktet er `document.activeElement` derfor det
 * *nye* felt, ikke det der ændrede sig. Vi ville ende med at fange det forkerte
 * felts identitet i undo-historikken og lande fokus det forkerte sted ved undo.
 *
 * Løsningen er at gemme felts identitet *mens* feltet har fokus. Vi lytter på
 * document-niveau (capture phase) på `focusin` og persisterer det sidst sete
 * undo-bærende felts attributter. Værdien gælder indtil et andet undo-bærende
 * felt fokuseres — den ryddes ikke ved blur.
 */

let lastFocusToken: string | null = null;
let lastFieldPath: string | null = null;
let installed = false;
let installedDocument: Document | null = null;

const handleFocusIn = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const focusToken = target.getAttribute('data-mineo-undo-focus-token');
  const fieldPath = target.getAttribute('data-mineo-undo-field-path');
  if (focusToken === null && fieldPath === null) {
    return;
  }
  lastFocusToken = focusToken;
  lastFieldPath = fieldPath;
};

export const installUndoFocusTracker = (): void => {
  if (typeof document === 'undefined') return;
  if (installed && installedDocument === document) return;
  if (installedDocument) {
    installedDocument.removeEventListener('focusin', handleFocusIn, true);
  }
  document.addEventListener('focusin', handleFocusIn, true);
  installed = true;
  installedDocument = document;
};

export const readLastUndoFocus = (): { focusToken: string | null; fieldPath: string | null } => ({
  focusToken: lastFocusToken,
  fieldPath: lastFieldPath,
});

export const __resetUndoFocusTrackerForTests = (): void => {
  if (installedDocument) {
    installedDocument.removeEventListener('focusin', handleFocusIn, true);
  }
  lastFocusToken = null;
  lastFieldPath = null;
  installed = false;
  installedDocument = null;
};
