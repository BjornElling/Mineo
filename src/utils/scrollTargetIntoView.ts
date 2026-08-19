/**
 * Samlet scroll-/spring-til-adfærd for hele programmet.
 *
 * Ét sted ejer beslutningen om HVORDAN der scrolles til et mål, så undo/redo-fokus,
 * tab-navigation, interne links (fx fejl-links i EO-beregning) og tabel-validering
 * alle opfører sig ens:
 *
 *   - Hvis målet allerede er synligt i scroll-containerens vindue, scrolles der IKKE.
 *   - Ellers scrolles målet så det er nogenlunde lodret centreret i vinduet
 *     (samme adfærd som tab-navigation), mens vandret adfærd er kant-baseret.
 *
 * Scroll-containeren er det div, der bærer `data-mineo-scroll-container="true"`
 * (se Container.tsx). Hvis et mål ligger uden for en sådan container (sjældent),
 * falder vi tilbage til native Element.scrollIntoView med tilsvarende options.
 */

const SCROLL_CONTAINER_SELECTOR = '[data-mineo-scroll-container="true"]';

/** Vandret kant-margin, så et mål ikke klistrer helt op ad containerens kant. */
const HORIZONTAL_VIEWPORT_PADDING = 24;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const resolveScrollContainer = (target: HTMLElement): HTMLElement | null => {
  const container = target.closest(SCROLL_CONTAINER_SELECTOR);
  return container instanceof HTMLElement ? container : null;
};

export type ScrollTargetIntoViewOptions = Readonly<{
  /**
   * Tving scroll selv hvis målet allerede er synligt. Bruges sjældent – default er
   * "scroll kun hvis nødvendigt", som er den ønskede adfærd alle steder.
   */
  force?: boolean;
  /** Override scroll-animationen. Default afledes af prefers-reduced-motion. */
  behavior?: ScrollBehavior;
}>;

/**
 * Er målet helt inden for containerens lodrette vindue?
 *
 * I jsdom returnerer getBoundingClientRect typisk 0'er; så er begge rects degenererede
 * og elementet regnes som synligt (vi scroller ikke). Det matcher testenes forventning
 * om at scroll er en ren browser-bivirkning, ikke noget der ændrer fokus-/datatilstand.
 */
const isVerticallyWithin = (containerRect: DOMRect, elementRect: DOMRect): boolean => {
  return elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
};

/**
 * Scroll målet ind i den nærmeste Mineo-scroll-container, men kun hvis det er nødvendigt.
 *
 * @returns true hvis et scroll-mål kunne håndteres (uanset om der faktisk blev scrollet).
 */
export const scrollTargetIntoView = (
  target: HTMLElement | null | undefined,
  options: ScrollTargetIntoViewOptions = {}
): boolean => {
  if (!target || typeof document === 'undefined') return false;

  const behavior: ScrollBehavior = options.behavior ?? (prefersReducedMotion() ? 'auto' : 'smooth');
  const container = resolveScrollContainer(target);

  // Fallback: mål uden for en kendt scroll-container. Brug native scrollIntoView, men
  // bevar "centrér"-intentionen og "kun hvis nødvendigt" via 'nearest'-block når muligt.
  if (!container) {
    target.scrollIntoView({ behavior, block: options.force ? 'center' : 'nearest' });
    return true;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = target.getBoundingClientRect();

  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);

  let nextScrollTop = container.scrollTop;
  let nextScrollLeft = container.scrollLeft;

  const needsVerticalScroll = options.force || !isVerticallyWithin(containerRect, elementRect);
  if (needsVerticalScroll) {
    // Centrér målet lodret i vinduet (samme math som tab-navigationens focusOnly).
    const elementCenterY = elementRect.top - containerRect.top + elementRect.height / 2;
    const desiredScrollTop = container.scrollTop + elementCenterY - container.clientHeight / 2;
    nextScrollTop = clamp(desiredScrollTop, 0, maxScrollTop);
  }

  // Vandret adfærd er kant-baseret (ikke centreret), så brede tabeller ikke hopper unødigt.
  if (elementRect.left < containerRect.left + HORIZONTAL_VIEWPORT_PADDING) {
    nextScrollLeft += elementRect.left - (containerRect.left + HORIZONTAL_VIEWPORT_PADDING);
  } else if (elementRect.right > containerRect.right - HORIZONTAL_VIEWPORT_PADDING) {
    nextScrollLeft += elementRect.right - (containerRect.right - HORIZONTAL_VIEWPORT_PADDING);
  }
  nextScrollLeft = clamp(nextScrollLeft, 0, maxScrollLeft);

  if (nextScrollTop !== container.scrollTop || nextScrollLeft !== container.scrollLeft) {
    container.scrollTo({ top: nextScrollTop, left: nextScrollLeft, behavior });
  }

  return true;
};
