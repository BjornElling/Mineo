/**
 * Sporer det senest fokuserede felt der bærer undo-attributter
 * (`data-mineo-undo-focus-token` / `data-mineo-undo-field-path`).
 *
 * Hvorfor: Et felt-commit udløses typisk af `onBlur` *efter* fokus er flyttet til
 * et andet felt. På commit-tidspunktet er `document.activeElement` derfor det
 * *nye* felt, ikke det der ændrede sig. Vi ville ende med at fange det forkerte
 * felts identitet i undo-historikken og lande fokus det forkerte sted ved undo.
 *
 * Løsningen for almindelige felter er at gemme feltets identitet *mens* feltet
 * har fokus. Tabelceller sender deres `fieldPath` eksplicit ved commit og bruger
 * derfor ikke trackerens `focusToken` som autoritativt undo-mål.
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
  if (focusToken === null && fieldPath === null) return;
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

export const clearLastUndoFocus = (): void => {
  lastFocusToken = null;
  lastFieldPath = null;
};

export const __resetUndoFocusTrackerForTests = (): void => {
  if (installedDocument) {
    installedDocument.removeEventListener('focusin', handleFocusIn, true);
  }
  clearLastUndoFocus();
  installed = false;
  installedDocument = null;
};
