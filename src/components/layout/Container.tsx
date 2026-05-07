import React from 'react';
import { Box } from '@mui/material';
import { ScrollContainerProvider } from '../../contexts/ScrollContainerContext';
import ScrollToTopButton from '../ui/ScrollToTopButton';

/**
 * Container komponent til content-område
 * Wrapper indhold med consistent padding og styling
 *
 * KEYBOARD NAVIGATION KONTRAKT (normativ):
 *
 * Tab / Shift+Tab
 *   - Flytter fokus til næste/forrige fokusbare element (cirkulær navigation)
 *   - Må ALDRIG selektere indhold i målelementet
 *   - Kun fokus – ingen selection
 *
 * Enter
 *   - Opfører sig som Tab (flytter fokus fremad)
 *   - Shift+Enter opfører sig som Shift+Tab (flytter fokus bagud)
 *   - Må ALDRIG selektere indhold
 *   - UNDTAGELSE: Popup-widgets (dropdown/datepicker) – Container intercepter IKKE Enter,
 *     så widget selv kan åbne/lukke ved Enter
 *   - UNDTAGELSE: Textareas – Enter giver newline som normalt
 *   - UNDTAGELSE: Radiobuttons – Enter vælger den fokuserede radiobutton
 *
 * ArrowLeft / ArrowRight
 *   - Flytter fokus i samme række, når editor/menu er lukket
 *   - UNDTAGELSE: Radiobuttons – flytter aktiv selection og fokus i radiogruppen med wrap
 *
 * Museklik
 *   - Container håndterer IKKE museklik
 *   - Selection ved museklik er komponentens eget ansvar (ikke Container)
 *
 * Popup-widgets (StyledDropdown, DatePicker, etc.)
 *   - Detekteres via ARIA semantik: role="combobox", aria-haspopup, aria-expanded
 *   - Container respekterer deres interne tastatur-håndtering
 *
 * Cross-cutting contract:
 *   - Container er "single owner" af fokus-traversering på en side
 *   - Interaktive subtrees (tabeller med Excel-navigation) skal kalde preventDefault()
 *     + stopPropagation() for de taster de ejer, ellers kan fokus hoppe dobbelt
 *
 * Se src/contracts/keyboard-navigation.md for fuld dokumentation.
 */
type FocusableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLElement;
type ArrowDirection = 'left' | 'right' | 'up' | 'down';

type FocusRow = {
  key: string;
  top: number;
  elements: FocusableElement[];
};

interface ContainerProps {
  children?: React.ReactNode;
}

const ROW_CONTAINER_SELECTOR =
  '.row--label-right-hover,.row--label-right,.row--label-offset,.row,[class*="row--label-right"],[class*="row--label-offset"],[class*="hover-row"]';
const CONTAINER_FOCUSABLE_SELECTOR =
  "input:not([disabled]):not([tabindex='-1']):not([type=\"hidden\"]):not([type=\"button\"]), " +
  "input[role=\"combobox\"]:not([disabled]):not([tabindex='-1']):not([type=\"hidden\"]):not([type=\"button\"]), " +
  "select:not([disabled]):not([tabindex='-1']), " +
  "textarea:not([disabled]):not([tabindex='-1']), " +
  "button[data-mineo-focusable-button=\"true\"]:not([tabindex='-1']), " +
  "[role=\"combobox\"][tabindex]:not([tabindex='-1']):not([aria-disabled='true']), " +
  "[aria-haspopup][tabindex]:not([tabindex='-1']):not([aria-disabled='true']), " +
  "[aria-controls][tabindex]:not([tabindex='-1']):not([aria-disabled='true'])";
const NON_TEXT_EDITING_INPUT_TYPES = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color']);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeRadioGroupTabStops = (elements: FocusableElement[]): FocusableElement[] => {
  const radioGroupMembers = new Map<string, HTMLInputElement[]>();
  const radioByGroup = new Map<HTMLInputElement, string>();

  for (const element of elements) {
    if (!(element instanceof HTMLInputElement)) continue;
    if (element.type !== 'radio') continue;
    if (element.name.trim() === '') continue;
    const groupKey = `${element.form?.id ?? ''}:${element.name}`;
    radioByGroup.set(element, groupKey);
    const members = radioGroupMembers.get(groupKey) ?? [];
    members.push(element);
    radioGroupMembers.set(groupKey, members);
  }

  const tabStopByGroup = new Map<string, HTMLInputElement>();
  for (const [groupKey, members] of radioGroupMembers) {
    const checked = members.find((radio) => radio.checked);
    tabStopByGroup.set(groupKey, checked ?? members[0]);
  }

  return elements.filter((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio') return true;
    const groupKey = radioByGroup.get(element);
    if (!groupKey) return true;
    return tabStopByGroup.get(groupKey) === element;
  });
};

const getRadioGroupMembers = (radio: HTMLInputElement, container: HTMLElement): HTMLInputElement[] => {
  if (radio.type !== 'radio') return [];
  if (radio.name.trim() === '') return [radio];

  return Array.from(container.querySelectorAll('input[type="radio"]:not([disabled]):not([tabindex="-1"])'))
    .filter((candidate): candidate is HTMLInputElement => candidate instanceof HTMLInputElement)
    .filter((candidate) => candidate.name === radio.name && candidate.form === radio.form);
};

const Container = React.memo(({ children }: ContainerProps) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const focusableCacheRef = React.useRef<FocusableElement[]>([]);
  const cacheValidRef = React.useRef(false);

  const getWidgetHost = React.useCallback((el: HTMLElement | null): HTMLElement | null => {
    if (!el) return null;
    return el.closest('[role="combobox"],[aria-haspopup],[aria-controls]') as HTMLElement | null;
  }, []);

  const getRowContainer = React.useCallback((el: HTMLElement): HTMLElement | null => {
    const container = el.closest(ROW_CONTAINER_SELECTOR);
    if (!(container instanceof HTMLElement)) return null;
    if (!containerRef.current?.contains(container)) return null;
    return container;
  }, []);

  const getNearestExpanded = React.useCallback((el: HTMLElement | null): boolean => {
    if (!el) return false;
    const expandedHost = el.closest('[aria-expanded]') as HTMLElement | null;
    if (expandedHost?.getAttribute('aria-expanded') === 'true') return true;

    const widgetHost = getWidgetHost(el);
    if (widgetHost?.getAttribute('aria-expanded') === 'true') return true;

    const controlsId = widgetHost?.getAttribute('aria-controls');
    if (!controlsId) return false;
    const controlled = document.getElementById(controlsId);
    if (!(controlled instanceof HTMLElement)) return false;
    if (controlled.hasAttribute('hidden')) return false;
    if (controlled.getAttribute('aria-hidden') === 'true') return false;

    // Some widgets keep expanded state on a sibling/wrapper, but expose `aria-controls` to the popup element.
    // Use the controlled element's visibility as a conservative "is open" signal.
    const rects = controlled.getClientRects();
    if (rects.length === 0) return false;
    const style = window.getComputedStyle(controlled);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  }, [getWidgetHost]);

  const isPopupWidget = React.useCallback((host: HTMLElement | null, isExpanded: boolean): boolean => {
    if (!host) return false;
    const role = host.getAttribute('role');
    const hasPopup = host.getAttribute('aria-haspopup') !== null;
    const hasControls = host.getAttribute('aria-controls') !== null;

    // `aria-controls` alone is too broad; treat it as a widget signal only when combined with other widget semantics.
    if (role === 'combobox') return true;
    if (hasPopup) return true;
    if (hasControls && isExpanded) return true;
    return false;
  }, []);

  /**
   * Tjek om et element er synligt og fokusbart
   * Robust check der håndterer edge cases (fixed, body, sticky, etc.)
   */
  const isElementVisible = React.useCallback((el: HTMLElement) => {
    // Quick check: Hvis elementet har bounding rects, er det synligt i layout
    // Dette fanger de fleste normale cases hurtigt
    const rects = el.getClientRects();
    if (rects.length === 0) {
      return false; // Elementet optager ingen plads = skjult
    }

    // offsetParent check - null kan betyde flere ting:
    // - display: none (usynlig)
    // - position: fixed (kan være synlig!)
    // - body/html element (kan være synlig!)
    // - display: contents på forælder (kan være synlig!)
    if (el.offsetParent === null && el !== document.body) {
      // offsetParent === null betyder normalt skjult, UNDTAGEN for position: fixed
      // Fallback til computed style for præcis check (kun én gang)
      const style = window.getComputedStyle(el);

      // Tjek om det er fixed position (kan være synlig trods offsetParent === null)
      if (style.position === 'fixed') {
        // Fixed-position: Tjek både display og visibility
        return style.display !== 'none' && style.visibility !== 'hidden';
      }

      // Ikke fixed og offsetParent === null → skjult
      return false;
    }

    // For normale elementer (offsetParent !== null): Tjek visibility
    // Dette fanger visibility: hidden som ikke påvirker offsetParent
    // getComputedStyle er dyrt, men nødvendigt for korrekthed
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden') {
      return false;
    }

    return true;
  }, []);

  /**
   * Byg eller genbyg cache af fokusbare elementer
   */
  const rebuildFocusableCache = React.useCallback(() => {
    if (!containerRef.current) {
      focusableCacheRef.current = [];
      return;
    }

    const focusableElements = Array.from(
      containerRef.current.querySelectorAll(CONTAINER_FOCUSABLE_SELECTOR)
    ).filter((el): el is FocusableElement => {
      if (!(el instanceof HTMLElement)) return false;
      // Tjek synlighed (hurtig check)
      return isElementVisible(el);
    });
    focusableCacheRef.current = normalizeRadioGroupTabStops(focusableElements);

    cacheValidRef.current = true;
  }, [isElementVisible]);

  /**
   * Hent fokusbare elementer (bruger cache hvis gyldig)
   */
  const getFocusableElements = React.useCallback(() => {
    if (!cacheValidRef.current) {
      rebuildFocusableCache();
    }
    // Filtrér igen for synlighed (elementer kan blive skjult dynamisk)
    return focusableCacheRef.current.filter(isElementVisible);
  }, [rebuildFocusableCache, isElementVisible]);

  /**
   * Invalider cache når DOM ændres
   */
  const invalidateCache = React.useCallback(() => {
    cacheValidRef.current = false;
  }, []);

  const isInTableNavigation = React.useCallback((el: HTMLElement | null): boolean => {
    if (!el) return false;
    return el.closest('[data-mineo-table-navigation="true"]') !== null;
  }, []);

  // Observer DOM-ændringer for at invalidere cache
  React.useEffect(() => {
    if (!containerRef.current) return;

    const observer = new MutationObserver(() => {
      invalidateCache();
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'style', 'class', 'hidden', 'tabindex', 'aria-disabled']
    });

    // Byg initial cache
    rebuildFocusableCache();

    return () => observer.disconnect();
  }, [invalidateCache, rebuildFocusableCache]);

  // Håndter tab-navigation og enter-navigation for at holde fokus inden for containeren
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const isArrowKey = e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown';
    // Håndter Tab/Enter + pilnavigation (kun når editor/menu er lukket)
    if (e.key !== 'Tab' && e.key !== 'Enter' && !isArrowKey) return;
    if (!containerRef.current) return;

    // Do not intercept keys originating outside the container DOM subtree.
    // React events bubble through portals; allowing container navigation to handle those
    // would break popovers/dialogs/portals (datepicker/autocomplete/etc.).
    const targetNode = e.target instanceof Node ? e.target : null;
    if (targetNode && !containerRef.current.contains(targetNode)) return;

    // IME/composition and OS/browser-level commands should not be interfered with.
    const native = e.nativeEvent as unknown as { isComposing?: boolean; mineoTableBoundaryExit?: boolean };
    if (native.isComposing === true) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Undtag textareas fra Enter-navigation (tillad newline)
    if (e.key === 'Enter' && e.target instanceof HTMLTextAreaElement) {
      return; // Lad Enter opføre sig normalt i textareas
    }

    // Brug cached liste (hurtig)
    const focusableElements = getFocusableElements();

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    const activeFocusable: FocusableElement | null = (() => {
      if (!(activeElement instanceof HTMLElement)) return null;
      const closest = activeElement.closest('input,select,textarea,button[data-mineo-focusable-button="true"],[role="combobox"],[aria-haspopup],[aria-controls]');
      if (!closest) return null;
      if (closest instanceof HTMLInputElement) return closest;
      if (closest instanceof HTMLSelectElement) return closest;
      if (closest instanceof HTMLTextAreaElement) return closest;
      if (closest instanceof HTMLButtonElement && closest.matches('button[data-mineo-focusable-button="true"]')) return closest;
      if (closest instanceof HTMLElement && closest.getAttribute('role') === 'combobox') return closest;
      if (closest instanceof HTMLElement && (closest.hasAttribute('aria-haspopup') || closest.hasAttribute('aria-controls'))) return closest;
      return null;
    })();

    // Widget detection for key interception must consider wrappers, not just raw inputs.
    const activeElementAsHtml = activeElement instanceof HTMLElement ? activeElement : null;
    const activeWidgetHost = getWidgetHost(activeElementAsHtml);
    const activeWidgetIsExpanded = getNearestExpanded(activeElementAsHtml);
    const activeWidgetHasPopup = isPopupWidget(activeWidgetHost, activeWidgetIsExpanded);

    let currentIndex = activeFocusable ? focusableElements.indexOf(activeFocusable) : -1;
    if (currentIndex === -1) {
      invalidateCache();
      const refreshed = getFocusableElements();
      currentIndex = activeFocusable ? refreshed.indexOf(activeFocusable) : -1;
      if (currentIndex !== -1) {
        focusableElements.splice(0, focusableElements.length, ...refreshed);
      }
    }

    /**
     * Fokusér element uden at selektere indhold.
     * Undgår scroll-hop når muligt.
     *
     * KRITISK: Neutraliserer selection efter keyboard-fokus (Tab/Enter).
     * Nogle komponenter/MUI widgets selekterer indhold automatisk ved fokus,
     * men ved keyboard-navigation må der ALDRIG være selection.
     * Vi kollapserer derfor selection deferred (efter at komponenten har haft chancen for at selektere).
     */
    const focusOnly = (element: FocusableElement) => {
      try {
        element.focus({ preventScroll: true });
      } catch {
        element.focus();
      }

      const container = containerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const viewportPadding = 24;
        let nextScrollTop = container.scrollTop;
        let nextScrollLeft = container.scrollLeft;
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);

        const elementIsOutsideVerticalViewport = elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom;
        if (elementIsOutsideVerticalViewport) {
          const elementCenterY = elementRect.top - containerRect.top + elementRect.height / 2;
          const desiredScrollTop = container.scrollTop + elementCenterY - container.clientHeight / 2;
          nextScrollTop = clamp(desiredScrollTop, 0, maxScrollTop);
        }

        // Horizontal behavior remains edge-based; only vertical behavior is centered.
        if (elementRect.left < containerRect.left + viewportPadding) {
          nextScrollLeft += elementRect.left - (containerRect.left + viewportPadding);
        } else if (elementRect.right > containerRect.right - viewportPadding) {
          nextScrollLeft += elementRect.right - (containerRect.right - viewportPadding);
        }
        nextScrollLeft = clamp(nextScrollLeft, 0, maxScrollLeft);

        if (nextScrollTop !== container.scrollTop || nextScrollLeft !== container.scrollLeft) {
          container.scrollTo({ top: nextScrollTop, left: nextScrollLeft, behavior: 'smooth' });
        }
      }

      // Neutralisér selection deferred (requestAnimationFrame) for at sikre,
      // at vi kører EFTER eventuelle komponenter der sætter selection ved fokus.
      requestAnimationFrame(() => {
        // Sikkerhedstjek: Er elementet stadig fokuseret?
        if (document.activeElement !== element) return;

        // Kun inputs/textareas kan have text selection
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;

        // Hvis der er selection (selectionStart !== selectionEnd), kollaps til caret i slutningen
        if (element.selectionStart !== element.selectionEnd) {
          const len = element.value.length;
          try {
            element.setSelectionRange(len, len);
          } catch {
            // Nogle input-typer (number, date) understøtter ikke setSelectionRange.
            // Ignorer fejl - de har typisk ingen synlig selection alligevel.
          }
        }
      });
    };

    const moveFocus = (direction: -1 | 1) => {
      if (currentIndex === -1) {
        focusOnly(direction === -1 ? lastElement : firstElement);
        return;
      }

      if (direction === -1) {
        focusOnly(currentIndex === 0 ? lastElement : focusableElements[currentIndex - 1]);
        return;
      }

      focusOnly(currentIndex === focusableElements.length - 1 ? firstElement : focusableElements[currentIndex + 1]);
    };

    const moveByArrow = (direction: ArrowDirection) => {
      if (!activeFocusable) return;
      const allowTableBoundaryExit = native.mineoTableBoundaryExit === true;
      if (isInTableNavigation(activeFocusable) && !allowTableBoundaryExit) return;

      // Bevar eksisterende praksis i åbne widgets (dropdown/menu/date osv.)
      if (activeWidgetIsExpanded) return;

      // Pilnavigation gælder kun i fokus-men-ikke-redigér mode.
      // ReadOnly=false betyder typisk åben editor i Mineos 2-trins inputs.
      const isTextEditingInput = (element: FocusableElement): element is HTMLInputElement | HTMLTextAreaElement => {
        if (element instanceof HTMLTextAreaElement) return true;
        if (!(element instanceof HTMLInputElement)) return false;
        return !NON_TEXT_EDITING_INPUT_TYPES.has(element.type);
      };
      if (isTextEditingInput(activeFocusable) && !activeFocusable.readOnly) {
        return;
      }

      if (
        activeFocusable instanceof HTMLInputElement &&
        activeFocusable.type === 'radio' &&
        (direction === 'left' || direction === 'right')
      ) {
        const container = containerRef.current;
        if (!container) return;

        const radioGroupMembers = getRadioGroupMembers(activeFocusable, container).filter(isElementVisible);
        if (radioGroupMembers.length <= 1) return;

        const currentRadioIndex = radioGroupMembers.indexOf(activeFocusable);
        if (currentRadioIndex < 0) return;

        const nextRadioIndex =
          direction === 'right'
            ? (currentRadioIndex + 1) % radioGroupMembers.length
            : (currentRadioIndex - 1 + radioGroupMembers.length) % radioGroupMembers.length;
        const target = radioGroupMembers[nextRadioIndex];
        if (!target) return;

        e.preventDefault();
        target.click();
        focusOnly(target);
        invalidateCache();
        return;
      }

      const nonTableFocusables = focusableElements.filter((el) => !isInTableNavigation(el));
      if (!focusableElements.includes(activeFocusable)) return;

      const visualRowTolerancePx = 8;
      const rectByElement = new Map<FocusableElement, DOMRect>();
      const getRect = (element: FocusableElement): DOMRect => {
        const cached = rectByElement.get(element);
        if (cached) return cached;
        const rect = (element as HTMLElement).getBoundingClientRect();
        rectByElement.set(element, rect);
        return rect;
      };
      const sortByHorizontalPosition = (items: FocusableElement[]) => {
        return items
          .slice()
          .sort((a, b) => {
            const aRect = getRect(a);
            const bRect = getRect(b);
            if (aRect.left !== bRect.left) return aRect.left - bRect.left;
            return aRect.top - bRect.top;
          });
      };

      const activeRect = getRect(activeFocusable);
      const activeRowContainer = getRowContainer(activeFocusable as HTMLElement);

      if (direction === 'left' || direction === 'right') {
        if (nonTableFocusables.length === 0) return;
        if (!nonTableFocusables.includes(activeFocusable)) return;

        const currentRowElements = sortByHorizontalPosition(
          nonTableFocusables.filter((candidate) => {
            const candidateContainer = getRowContainer(candidate as HTMLElement);
            if (activeRowContainer && candidateContainer) return candidateContainer === activeRowContainer;
            if (activeRowContainer && !candidateContainer) {
              const candidateTop = getRect(candidate).top;
              return Math.abs(candidateTop - activeRect.top) <= visualRowTolerancePx;
            }
            if (!activeRowContainer && candidateContainer) return false;
            const candidateTop = getRect(candidate).top;
            return Math.abs(candidateTop - activeRect.top) <= visualRowTolerancePx;
          })
        );
        if (currentRowElements.length === 0) return;

        const currentElementIndex = currentRowElements.indexOf(activeFocusable);
        if (currentElementIndex < 0) return;

        const nextIndex =
          direction === 'right'
            ? (currentElementIndex + 1) % currentRowElements.length
            : (currentElementIndex - 1 + currentRowElements.length) % currentRowElements.length;
        const target = currentRowElements[nextIndex];
        if (!target) return;
        e.preventDefault();
        focusOnly(target);
        return;
      }

      const rowsByContainer = new Map<HTMLElement, FocusableElement[]>();
      const rowsWithoutContainer: FocusRow[] = [];
      for (const element of focusableElements) {
        const rowContainer = getRowContainer(element as HTMLElement);
        if (rowContainer) {
          if (!rowsByContainer.has(rowContainer)) {
            rowsByContainer.set(rowContainer, []);
          }
          rowsByContainer.get(rowContainer)?.push(element);
          continue;
        }
        const top = getRect(element).top;
        const existing = rowsWithoutContainer.find((row) => Math.abs(row.top - top) <= visualRowTolerancePx);
        if (existing) {
          existing.elements.push(element);
        } else {
          rowsWithoutContainer.push({ key: `visual:${rowsWithoutContainer.length}`, top, elements: [element] });
        }
      }

      const rowsFromContainer: FocusRow[] = Array.from(rowsByContainer.entries()).map(([container, elements], index) => ({
        key: `dom:${index}`,
        top: container.getBoundingClientRect().top,
        elements: sortByHorizontalPosition(elements),
      }));
      const rows = [...rowsFromContainer, ...rowsWithoutContainer.map((row) => ({ ...row, elements: sortByHorizontalPosition(row.elements) }))]
        .filter((row) => row.elements.length > 0)
        .sort((a, b) => a.top - b.top);
      if (rows.length === 0) return;

      const currentRowIndex = rows.findIndex((row) => row.elements.includes(activeFocusable));
      if (currentRowIndex < 0) return;

      const nextRowIndex =
        direction === 'down'
          ? (currentRowIndex + 1) % rows.length
          : (currentRowIndex - 1 + rows.length) % rows.length;
      const targetRow = rows[nextRowIndex];
      // Boundary-exit fra tabel (markeret af tableKeyboardNavigation) lander her.
      // Fordi rows er bygget fra hele focusable-listen (inkl. tabel), finder vi fortsat
      // den naborekke der ligger over/under i den samlede side-navigation.
      const target = direction === 'down'
        ? targetRow.elements[0]
        : targetRow.elements[targetRow.elements.length - 1];
      if (!target) return;
      e.preventDefault();
      focusOnly(target);
    };

    if (isArrowKey) {
      const arrowDirection: ArrowDirection =
        e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowUp' ? 'up' : 'down';
      moveByArrow(arrowDirection);
      return;
    }

    // Enter opfører sig PRÆCIS som Tab (cirkulær navigation).
    // Shift+Enter opfører sig som Shift+Tab.
    if (e.key === 'Enter') {
      // Some controls use Enter internally (select/autocomplete/datepicker-like patterns).
      // Detect widget semantics at the active element or its wrapper (not just the raw input).
      if (activeWidgetHasPopup) return;

      if (activeFocusable instanceof HTMLInputElement && activeFocusable.type === 'radio') {
        e.preventDefault();
        // Bevar native aktiveringssemantik: Enter på fokuseret radio svarer til brugeraktiveret click,
        // hvilket også driver evt. controlled onChange-flow i React.
        activeFocusable.click();
        return;
      }

      e.preventDefault();
      moveFocus(e.shiftKey ? -1 : 1);
      return;
    }

    // Tab navigation - ALTID prevent default for at forhindre at forlade containeren
    // unless widget popup is currently expanded (open).
    // Closed combobox/select controls must still participate in circular container Tab-order.
    if (activeWidgetIsExpanded) {
      // KRITISK FIX: Selvom vi ikke intercepter Tab for popup-widgets,
      // skal vi stadig neutralisere selection på næste felt efter browser's default Tab.
      // Vi venter til næste frame (efter browser har flyttet fokus).
      requestAnimationFrame(() => {
        const newActiveElement = document.activeElement;
        if (newActiveElement instanceof HTMLInputElement || newActiveElement instanceof HTMLTextAreaElement) {
          if (newActiveElement.selectionStart !== newActiveElement.selectionEnd) {
            const len = newActiveElement.value.length;
            try {
              newActiveElement.setSelectionRange(len, len);
            } catch {
              // Ignorer fejl for input-typer der ikke understøtter setSelectionRange
            }
          }
        }
      });

      return;
    }
    e.preventDefault();
    moveFocus(e.shiftKey ? -1 : 1);
  }, [getFocusableElements, getNearestExpanded, getRowContainer, getWidgetHost, invalidateCache, isElementVisible, isInTableNavigation, isPopupWidget]);

  return (
    <ScrollContainerProvider containerRef={containerRef}>
      <Box
        ref={containerRef}
        data-mineo-scroll-container="true"
        onKeyDown={handleKeyDown}
        sx={{
          flex: 1,
          padding: 3,
          backgroundColor: 'var(--color-surface)',
          overflowY: 'auto',
          overflowX: 'auto',
          height: '100vh'
        }}
      >
        <Box sx={{ width: '1000px', paddingLeft: '50px', paddingTop: '50px' }}>
          {children}
        </Box>
        <ScrollToTopButton />
      </Box>
    </ScrollContainerProvider>
  );
});

Container.displayName = 'Container';

export default Container;
