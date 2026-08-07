import React from 'react';
import { hasTableBoundaryExit } from '../../tables/gridCore/tableFocusHelpers';
import { getPopupWidgetHost, isPopupWidget, isPopupWidgetExpanded } from '../../inputs/popupWidgetSemantics';
import { CONTAINER_FOCUSABLE_SELECTOR } from '../../tables/gridCore/tableFocusHelpers';
import { scrollTargetIntoView } from '../../../utils/scrollTargetIntoView';
import {
  type FocusCandidate,
  resolveCircularNeighbor,
  resolveHorizontalTarget,
  resolveVerticalTarget,
} from './focusRowGeometry';
import {
  type FocusableElement,
  type FocusableInventory,
  getRadioGroupMembers,
} from './useFocusableInventory';

/**
 * Tasteoversættelsen for `Container`: fra tastetryk til «hvilket felt skal have fokus».
 *
 * Laget ejer PRÆCIS de beslutninger, der afhænger af tasten og af den aktive kontrols
 * semantik — undtagelserne i `keyboard-navigation.md`. Hvor målfeltet afhænger af
 * geometri, spørger det `focusRowGeometry`; hvor det afhænger af DOM, spørger det
 * inventaret. Selve fokus-effekten (`focusOnly`) er den ene bivirkning laget udfører.
 *
 * Den observerbare adfærd er uændret fra den monolitiske `Container.tsx`; kontraktens
 * §Implementeringsfrihed (l. 228-237) tillader eksplicit denne omlægning.
 */

const NON_TEXT_EDITING_INPUT_TYPES = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color']);

const isTextEditingInput = (element: Element): element is HTMLInputElement | HTMLTextAreaElement => {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !NON_TEXT_EDITING_INPUT_TYPES.has(element.type);
};

/**
 * Kollaps en eventuel tekst-selection til en caret i slutningen.
 *
 * Normativt krav: keyboard-fokus må ALDRIG efterlade markeret indhold
 * (`keyboard-navigation.md`). Nogle MUI-widgets selekterer selv ved fokus, så
 * neutraliseringen skal ske EFTER dem — derfor kaldes den fra en `requestAnimationFrame`.
 */
const collapseSelection = (element: Element | null): void => {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
  if (element.selectionStart === element.selectionEnd) return;
  const caret = element.value.length;
  try {
    element.setSelectionRange(caret, caret);
  } catch {
    // Input-typer som number/date understøtter ikke setSelectionRange og har ingen synlig selection.
  }
};

/** Fokusér uden selection og uden scroll-hop. */
const focusOnly = (element: FocusableElement): void => {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }

  // Scroll-adfærden ejes af scrollTargetIntoView, så tab-navigation, undo/redo og interne
  // links opfører sig ens.
  scrollTargetIntoView(element);

  requestAnimationFrame(() => {
    if (document.activeElement !== element) return;
    collapseSelection(element);
  });
};

/**
 * Måler kandidaterne op til geometri-kernens værdiform. Rects måles ÉN gang pr. tastetryk
 * og genbruges, fordi `getBoundingClientRect` tvinger layout.
 */
const measureCandidates = (
  elements: readonly FocusableElement[],
  inventory: FocusableInventory,
): FocusCandidate<FocusableElement>[] => {
  const rowContainerTops = new Map<HTMLElement, number>();
  return elements.map((element) => {
    const rowContainer = inventory.getRowContainer(element);
    if (rowContainer && !rowContainerTops.has(rowContainer)) {
      rowContainerTops.set(rowContainer, rowContainer.getBoundingClientRect().top);
    }
    return {
      element,
      rect: element.getBoundingClientRect(),
      rowContainer,
      rowContainerTop: rowContainer ? rowContainerTops.get(rowContainer) ?? null : null,
      isInTableNavigation: inventory.isInTableNavigation(element),
    };
  });
};

type ArrowDirection = 'left' | 'right' | 'up' | 'down';

const resolveArrowDirection = (key: string): ArrowDirection | null => {
  if (key === 'ArrowLeft') return 'left';
  if (key === 'ArrowRight') return 'right';
  if (key === 'ArrowUp') return 'up';
  if (key === 'ArrowDown') return 'down';
  return null;
};

export const useContainerKeyboardNavigation = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  inventory: FocusableInventory,
): ((e: React.KeyboardEvent<HTMLDivElement>) => void) => {
  const { getFocusableElements, invalidate, isInTableNavigation } = inventory;

  return React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const arrowDirection = resolveArrowDirection(e.key);
      if (e.key !== 'Tab' && e.key !== 'Enter' && arrowDirection === null) return;

      const container = containerRef.current;
      if (!container) return;

      // Intercept ikke taster fra uden for containerens DOM-subtræ. React-events bobler
      // gennem portals; ellers ville popovers/dialogs/datepickere gå i stykker.
      const targetNode = e.target instanceof Node ? e.target : null;
      if (targetNode && !container.contains(targetNode)) return;

      // IME/composition og OS-/browser-kommandoer må ikke forstyrres.
      if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing === true) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Enter i en textarea giver newline som normalt.
      if (e.key === 'Enter' && e.target instanceof HTMLTextAreaElement) return;

      let focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const activeElement = document.activeElement;
      // Det aktive elements fokus-stop slås op med PRÆCIS samme selector, som inventaret
      // indsamler med — ellers kunne de to divergere, og opslaget nedenfor ville ikke finde
      // elementet i sin egen liste.
      const activeFocusable: FocusableElement | null = (() => {
        if (!(activeElement instanceof HTMLElement)) return null;
        const closest = activeElement.closest(CONTAINER_FOCUSABLE_SELECTOR);
        return closest instanceof HTMLElement ? closest : null;
      })();

      // Widget-detektion skal tage højde for wrappers, ikke kun rå inputs.
      const activeElementAsHtml = activeElement instanceof HTMLElement ? activeElement : null;
      const activeWidgetIsExpanded = isPopupWidgetExpanded(activeElementAsHtml);
      const activeWidgetHasPopup = isPopupWidget(getPopupWidgetHost(activeElementAsHtml), activeWidgetIsExpanded);

      // Er det aktive felt faldet ud af en forældet cache? Genbyg én gang, før vi giver op.
      if (activeFocusable && !focusableElements.includes(activeFocusable)) {
        invalidate();
        const refreshed = getFocusableElements();
        if (refreshed.includes(activeFocusable)) focusableElements = refreshed;
      }

      if (arrowDirection !== null) {
        if (!activeFocusable) return;
        // Tabel-navigationen ejer piletaster inde i tabellen; kun en markeret kant-exit
        // slipper videre til side-navigationen.
        if (isInTableNavigation(activeFocusable) && !hasTableBoundaryExit(e.nativeEvent)) return;
        // Bevar eksisterende praksis i åbne widgets (dropdown/menu/date).
        if (activeWidgetIsExpanded) return;
        // Pilnavigation gælder kun i fokus-men-ikke-redigér mode. readOnly=false betyder
        // typisk åben editor i Mineos 2-trins inputs.
        if (isTextEditingInput(activeFocusable) && !activeFocusable.readOnly) return;

        // Radiogruppe: vandrette piletaster flytter aktivt valg OG fokus, med wrap.
        if (
          activeFocusable instanceof HTMLInputElement &&
          activeFocusable.type === 'radio' &&
          (arrowDirection === 'left' || arrowDirection === 'right')
        ) {
          const members = getRadioGroupMembers(activeFocusable, container);
          if (members.length <= 1) return;
          const target = resolveCircularNeighbor(members, activeFocusable, arrowDirection === 'right' ? 1 : -1);
          if (!target) return;
          e.preventDefault();
          target.click();
          focusOnly(target);
          invalidate();
          return;
        }

        const candidates = measureCandidates(focusableElements, inventory);
        const active = candidates.find((candidate) => candidate.element === activeFocusable);
        if (!active) return;

        const target =
          arrowDirection === 'up' || arrowDirection === 'down'
            ? resolveVerticalTarget(candidates, active, arrowDirection)
            : resolveHorizontalTarget(candidates, active, arrowDirection);
        if (!target) return;

        e.preventDefault();
        focusOnly(target.element);
        return;
      }

      // Enter opfører sig PRÆCIS som Tab (cirkulær), Shift+Enter som Shift+Tab.
      if (e.key === 'Enter') {
        // Popup-kontroller bruger Enter internt til at åbne/lukke deres menu.
        if (activeWidgetHasPopup) return;

        if (activeFocusable instanceof HTMLInputElement && activeFocusable.type === 'radio') {
          e.preventDefault();
          // Bevar native aktiveringssemantik: Enter på fokuseret radio svarer til et
          // brugeraktiveret click, hvilket også driver et controlled onChange-flow i React.
          activeFocusable.click();
          return;
        }
      } else if (activeWidgetIsExpanded) {
        // Tab i en ÅBEN popup lades til browseren, men selection på næste felt skal stadig
        // neutraliseres — derfor efter næste frame, når fokus er flyttet.
        // Lukkede combobox-kontroller indgår normalt i den cirkulære Tab-rækkefølge.
        requestAnimationFrame(() => collapseSelection(document.activeElement));
        return;
      }

      e.preventDefault();
      const step = e.shiftKey ? -1 : 1;
      if (!activeFocusable || !focusableElements.includes(activeFocusable)) {
        focusOnly(step === -1 ? focusableElements[focusableElements.length - 1] : focusableElements[0]);
        return;
      }
      const target = resolveCircularNeighbor(focusableElements, activeFocusable, step);
      if (target) focusOnly(target);
    },
    [containerRef, getFocusableElements, invalidate, inventory, isInTableNavigation],
  );
};
