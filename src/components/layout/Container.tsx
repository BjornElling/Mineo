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

interface ContainerProps {
  children?: React.ReactNode;
}

const Container: React.FC<ContainerProps> = React.memo(({ children }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const focusableCacheRef = React.useRef<FocusableElement[]>([]);
  const cacheValidRef = React.useRef(false);

  const getWidgetHost = React.useCallback((el: HTMLElement | null): HTMLElement | null => {
    if (!el) return null;
    return el.closest('[role="combobox"],[aria-haspopup],[aria-controls]') as HTMLElement | null;
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

    focusableCacheRef.current = Array.from(
      containerRef.current.querySelectorAll(
        "input:not([disabled]):not([tabindex='-1']):not([type=\"hidden\"]):not([type=\"button\"]), input[role=\"combobox\"]:not([disabled]):not([tabindex='-1']):not([type=\"hidden\"]):not([type=\"button\"]), select:not([disabled]):not([tabindex='-1']), textarea:not([disabled]):not([tabindex='-1']), [role=\"combobox\"][tabindex]:not([tabindex='-1']):not([aria-disabled='true']), [aria-haspopup][tabindex]:not([tabindex='-1']):not([aria-disabled='true']), [aria-controls][tabindex]:not([tabindex='-1']):not([aria-disabled='true'])"
      )
    ).filter((el): el is FocusableElement => {
      if (!(el instanceof HTMLElement)) return false;
      // Ekskluder BUTTON tags
      if (el.tagName === 'BUTTON') return false;
      // Tjek synlighed (hurtig check)
      return isElementVisible(el);
    });

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
      attributeFilter: ['disabled', 'style', 'class', 'hidden']
    });

    // Byg initial cache
    rebuildFocusableCache();

    return () => observer.disconnect();
  }, [invalidateCache, rebuildFocusableCache]);

  // Håndter tab-navigation og enter-navigation for at holde fokus inden for containeren
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Håndter både Tab og Enter
    if (e.key !== 'Tab' && e.key !== 'Enter') return;
    if (!containerRef.current) return;

    // Do not intercept keys originating outside the container DOM subtree.
    // React events bubble through portals; allowing container navigation to handle those
    // would break popovers/dialogs/portals (datepicker/autocomplete/etc.).
    const targetNode = e.target instanceof Node ? e.target : null;
    if (targetNode && !containerRef.current.contains(targetNode)) return;

    // IME/composition and OS/browser-level commands should not be interfered with.
    const native = e.nativeEvent as unknown as { isComposing?: boolean };
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
      const closest = activeElement.closest('input,select,textarea,[role="combobox"],[aria-haspopup],[aria-controls]');
      if (!closest) return null;
      if (closest instanceof HTMLInputElement) return closest;
      if (closest instanceof HTMLSelectElement) return closest;
      if (closest instanceof HTMLTextAreaElement) return closest;
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

        if (elementRect.top < containerRect.top + viewportPadding) {
          nextScrollTop += elementRect.top - (containerRect.top + viewportPadding);
        } else if (elementRect.bottom > containerRect.bottom - viewportPadding) {
          nextScrollTop += elementRect.bottom - (containerRect.bottom - viewportPadding);
        }

        if (elementRect.left < containerRect.left + viewportPadding) {
          nextScrollLeft += elementRect.left - (containerRect.left + viewportPadding);
        } else if (elementRect.right > containerRect.right - viewportPadding) {
          nextScrollLeft += elementRect.right - (containerRect.right - viewportPadding);
        }

        if (nextScrollTop !== container.scrollTop || nextScrollLeft !== container.scrollLeft) {
          container.scrollTo({ top: nextScrollTop, left: nextScrollLeft });
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

    // Enter opfører sig PRÆCIS som Tab (cirkulær navigation).
    // Shift+Enter opfører sig som Shift+Tab.
    if (e.key === 'Enter') {
      // Some controls use Enter internally (select/autocomplete/datepicker-like patterns).
      // Detect widget semantics at the active element or its wrapper (not just the raw input).
      if (activeWidgetHasPopup) return;

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
  }, [getFocusableElements, getNearestExpanded, getWidgetHost, invalidateCache, isPopupWidget]);

  return (
    <ScrollContainerProvider containerRef={containerRef}>
      <Box
        ref={containerRef}
        data-mineo-scroll-container="true"
        onKeyDown={handleKeyDown}
        sx={{
          flex: 1,
          padding: 3,
          backgroundColor: '#f8f9fa',
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
