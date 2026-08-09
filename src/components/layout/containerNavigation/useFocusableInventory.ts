import React from 'react';
import {
  CONTAINER_FOCUSABLE_SELECTOR,
  CONTAINER_ROW_SELECTOR,
} from '../../tables/gridCore/tableFocusHelpers';

/**
 * `Container`s inventar over fokuserbare felter: opslag, synlighedsfilter, radiogruppe-
 * normalisering og den MutationObserver-invaliderede cache.
 *
 * Dette er DOM-halvdelen af den gamle `Container.tsx`. Den er skilt fra
 * `focusRowGeometry` (rene beslutninger) og fra `useContainerKeyboardNavigation`
 * (tasteoversættelse), fordi de tre fejler på hver sin måde: et forkert selector-filter
 * her giver et felt for meget eller for lidt i sekvensen; en geometrifejl giver den
 * forkerte nabo; en tastefejl giver den forkerte handling. Blandet i én komponent kunne
 * ingen af dem rammes uden at gå gennem alle tre.
 *
 * Selectorerne ejes af `tableFocusHelpers` og deles med grid-navigationen — de defineres
 * IKKE her. Kontraktens krav om at tab-sekvensen skal være «eksplicit og auditérbart
 * defineret» (`keyboard-navigation.md` §Implementeringsfrihed) er dermed uændret opfyldt.
 */

export type FocusableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLElement;

/**
 * En radiogruppe er ÉT tabstop (WAI-ARIA). Vi beholder den checkede knap, ellers den
 * første — så Tab lander på gruppens aktive valg, mens pil-navigation inde i gruppen
 * håndteres separat af tastelaget.
 */
const normalizeRadioGroupTabStops = (elements: readonly FocusableElement[]): FocusableElement[] => {
  const membersByGroup = new Map<string, HTMLInputElement[]>();
  const groupByRadio = new Map<HTMLInputElement, string>();

  for (const element of elements) {
    if (!(element instanceof HTMLInputElement)) continue;
    if (element.type !== 'radio') continue;
    if (element.name.trim() === '') continue;
    const groupKey = `${element.form?.id ?? ''}:${element.name}`;
    groupByRadio.set(element, groupKey);
    const members = membersByGroup.get(groupKey) ?? [];
    members.push(element);
    membersByGroup.set(groupKey, members);
  }

  const tabStopByGroup = new Map<string, HTMLInputElement>();
  for (const [groupKey, members] of membersByGroup) {
    tabStopByGroup.set(groupKey, members.find((radio) => radio.checked) ?? members[0]);
  }

  return elements.filter((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio') return true;
    const groupKey = groupByRadio.get(element);
    if (!groupKey) return true;
    return tabStopByGroup.get(groupKey) === element;
  });
};

/**
 * Er elementet synligt og dermed fokuserbart?
 *
 * `offsetParent === null` betyder normalt skjult, men også `position: fixed`, `<body>`
 * selv og `display: contents` på en forælder — derfor faldet til computed style i netop
 * den gren. `getComputedStyle` er dyrt og undgås i den hurtige vej.
 */
export const isFocusableElementVisible = (el: HTMLElement): boolean => {
  // `hidden` kan sidde på en wrapper om en betinget vist handling. Browseren giver normalt
  // barnet nul rects, men den eksplicitte kontrol bevarer invarianten i alle DOM-miljøer.
  if (el.closest('[hidden]') !== null) return false;
  if (el.getClientRects().length === 0) return false;

  if (el.offsetParent === null && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (style.position === 'fixed') {
      return style.display !== 'none' && style.visibility !== 'hidden';
    }
    return false;
  }

  return window.getComputedStyle(el).visibility !== 'hidden';
};

/** Alle synlige radioknapper i samme gruppe som `radio`, i DOM-rækkefølge. */
export const getRadioGroupMembers = (radio: HTMLInputElement, container: HTMLElement): HTMLInputElement[] => {
  if (radio.type !== 'radio') return [];
  if (radio.name.trim() === '') return [radio];

  return Array.from(container.querySelectorAll('input[type="radio"]:not([disabled]):not([tabindex="-1"])'))
    .filter((candidate): candidate is HTMLInputElement => candidate instanceof HTMLInputElement)
    .filter((candidate) => candidate.name === radio.name && candidate.form === radio.form)
    .filter(isFocusableElementVisible);
};

export type FocusableInventory = Readonly<{
  /** Fokuserbare felter i containeren, i DOM-rækkefølge, radiogrupper kollapset til ét tabstop. */
  getFocusableElements: () => FocusableElement[];
  /** Elementets nærmeste række-container inden for containeren, eller `null`. */
  getRowContainer: (el: HTMLElement) => HTMLElement | null;
  /** Marker cachen ugyldig, fx efter en programmatisk DOM-ændring i samme tick. */
  invalidate: () => void;
  /** Ligger elementet i et subtræ med egen tabel-navigation? */
  isInTableNavigation: (el: HTMLElement | null) => boolean;
}>;

/**
 * Cache-strategien: MutationObserver invaliderer ved DOM-ændringer, og hver læsning
 * efterfiltrerer for synlighed, fordi et felt kan skjules af en style-ændring, observeren
 * ikke rammer. Det er bevidst konservativt — en for stor liste ville sende fokus til et
 * skjult felt.
 */
export const useFocusableInventory = (
  containerRef: React.RefObject<HTMLDivElement | null>,
): FocusableInventory => {
  const cacheRef = React.useRef<FocusableElement[]>([]);
  const cacheValidRef = React.useRef(false);

  const rebuild = React.useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      cacheRef.current = [];
      return;
    }

    const focusable = Array.from(container.querySelectorAll(CONTAINER_FOCUSABLE_SELECTOR)).filter(
      (el): el is FocusableElement => el instanceof HTMLElement && isFocusableElementVisible(el),
    );
    cacheRef.current = normalizeRadioGroupTabStops(focusable);
    cacheValidRef.current = true;
  }, [containerRef]);

  const getFocusableElements = React.useCallback(() => {
    if (!cacheValidRef.current) rebuild();
    return cacheRef.current.filter(isFocusableElementVisible);
  }, [rebuild]);

  const invalidate = React.useCallback(() => {
    cacheValidRef.current = false;
  }, []);

  const getRowContainer = React.useCallback(
    (el: HTMLElement): HTMLElement | null => {
      const rowContainer = el.closest(CONTAINER_ROW_SELECTOR);
      if (!(rowContainer instanceof HTMLElement)) return null;
      if (!containerRef.current?.contains(rowContainer)) return null;
      return rowContainer;
    },
    [containerRef],
  );

  const isInTableNavigation = React.useCallback(
    (el: HTMLElement | null): boolean => el?.closest('[data-mineo-table-navigation="true"]') !== null && el !== null,
    [],
  );

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver(invalidate);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'style', 'class', 'hidden', 'tabindex', 'aria-disabled'],
    });

    rebuild();

    return () => observer.disconnect();
  }, [containerRef, invalidate, rebuild]);

  return { getFocusableElements, getRowContainer, invalidate, isInTableNavigation };
};
