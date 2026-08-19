/**
 * Popup-widget-semantik: ÉN klassifikation af "er dette en popup-kontrol, og er den åben?".
 *
 * Både `Container` (sidens fokus-traversering) og grid-navigationen (`tableKeyboardNavigation`) skal
 * frigive aktiveringstaster til en popup-kontrol, så kontrollen selv kan åbne/lukke sin menu.
 * Tidligere havde de to flader hver sin kopi af opslaget, og grid'et brugte desuden en PRIVAT
 * markør-attribut (`data-mineo-table-dropdown`) fra en slettet komponent til at genkende dropdowns
 * i celler. Klassifikationen hører til kontrollens semantik, ikke til den flade den står på –
 * derfor er den her, ved dropdownen selv, og måles udelukkende på ARIA:
 *
 * - `role="combobox"` eller `aria-haspopup` ⇒ popup-kontrol.
 * - `aria-controls` alene er for bredt (bruges også af rene labels/beskrivelser) og tælles kun
 *   som widget-signal, når kontrollen samtidig er åben.
 * - Åben måles på `aria-expanded="true"`, eller – for widgets der holder expanded-tilstanden på en
 *   søsker/wrapper – på at det `aria-controls`-udpegede element faktisk er synligt.
 *
 * `StyledDropdown` er den ene popup-kontrol i appen og eksponerer alle tre attributter, i både
 * form- og celle-varianten (`ChoiceField` / `GridChoiceCell`). En ny popup-kontrol med korrekt
 * ARIA-semantik klassificeres derfor rigtigt af begge flader uden at skulle registreres nogen steder.
 */

/** Nærmeste forfader (inkl. elementet selv), der bærer popup-widget-semantik. */
export const getPopupWidgetHost = (el: HTMLElement | null): HTMLElement | null => {
  if (!el) return null;
  return el.closest('[role="combobox"],[aria-haspopup],[aria-controls]') as HTMLElement | null;
};

/**
 * Er den nærmeste popup-widget åben? Læses fra `aria-expanded` når kontrollen selv bærer den, ellers
 * konservativt fra synligheden af det `aria-controls`-udpegede popup-element.
 */
export const isPopupWidgetExpanded = (el: HTMLElement | null): boolean => {
  if (!el) return false;
  const expandedHost = el.closest('[aria-expanded]') as HTMLElement | null;
  if (expandedHost?.getAttribute('aria-expanded') === 'true') return true;

  const widgetHost = getPopupWidgetHost(el);
  if (widgetHost?.getAttribute('aria-expanded') === 'true') return true;

  const controlsId = widgetHost?.getAttribute('aria-controls');
  if (!controlsId) return false;
  const controlled = document.getElementById(controlsId);
  if (!(controlled instanceof HTMLElement)) return false;
  if (controlled.hasAttribute('hidden')) return false;
  if (controlled.getAttribute('aria-hidden') === 'true') return false;

  const rects = controlled.getClientRects();
  if (rects.length === 0) return false;
  const style = window.getComputedStyle(controlled);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
};

/**
 * Bærer værts-elementet popup-widget-semantik? `isExpanded` gør det bredere `aria-controls`-signal
 * gyldigt (jf. modulets doc).
 */
export const isPopupWidget = (host: HTMLElement | null, isExpanded: boolean): boolean => {
  if (!host) return false;
  const role = host.getAttribute('role');
  if (role === 'combobox') return true;
  if (host.getAttribute('aria-haspopup') !== null) return true;
  if (host.getAttribute('aria-controls') !== null && isExpanded) return true;
  return false;
};

/**
 * Er `el` inde i en LUKKET popup-kontrol? Det er præcis det tilfælde, hvor en omgivende
 * navigationsflade skal frigive kontrollens aktiveringstast (Enter), så menuen kan åbne.
 * En ÅBEN popup håndterer selv alle taster; den frigives af `isPopupWidgetExpanded`-grenen.
 */
export const isInClosedPopupWidget = (el: HTMLElement | null): boolean => {
  const host = getPopupWidgetHost(el);
  if (!host) return false;
  if (!isPopupWidget(host, false)) return false;
  return !isPopupWidgetExpanded(el);
};
