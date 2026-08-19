/**
 * Markør for den fælles bekræftelsesdialog.
 *
 * En åben felteditor må ikke settle, når fokus flyttes ind i en bekræftelsesdialog. Det er en
 * fysisk blur, men ikke en afsluttet redigering: dialogen kan stadig annulleres, og ved en
 * bekræftelse kasserer replacement-flowet editoren atomisk. Markøren gør denne ene fokusovergang
 * auditérbar for både formular- og grid-surface uden at opdage kritiske handlinger via DOM-scanning.
 */
export const CONFIRMATION_DIALOG_FOCUS_MARKER = 'data-mineo-confirmation-dialog';

const CONFIRMATION_DIALOG_SELECTOR = `[${CONFIRMATION_DIALOG_FOCUS_MARKER}="true"]`;

const isInsideConfirmationDialog = (target: EventTarget | null): boolean => {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return target.closest(CONFIRMATION_DIALOG_SELECTOR) !== null;
};

/**
 * Returnerer om en blur er del af fokusovergangen ind i ConfirmationDialog.
 *
 * `relatedTarget` er den autoritative overgang i browsere, der udfylder feltet. Nogle browser-/portalforløb
 * leverer imidlertid ikke altid `relatedTarget` på den første blur; i så fald bruges det aktuelle aktive
 * element som samme konkrete fokusmål. Der læses aldrig efter dialoger eller handlinger – kun efter den
 * allerede kendte eventdestination.
 */
export const isFocusTransferIntoConfirmationDialog = (relatedTarget: EventTarget | null): boolean => {
  if (isInsideConfirmationDialog(relatedTarget)) return true;
  return typeof document !== 'undefined' && isInsideConfirmationDialog(document.activeElement);
};
