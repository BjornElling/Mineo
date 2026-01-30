/**
 * Scroll-utility til at scrolle til en sektion med deterministisk retry-logik
 *
 * Bruger requestAnimationFrame loop indtil element findes eller max retries nås.
 * Dette undgår setTimeout-baserede gæt der kan fejle sporadisk pga. React rendering timing.
 */

import type { SectionId } from '../domain/erstatningsopgoerelse/eoDebugNavigationMap';

/**
 * Scroller til en sektion identificeret ved data-section-id attribute
 *
 * @param sectionId - SectionId fra navigation-map
 * @param options - Optional konfiguration
 * @param options.maxRetries - Max antal requestAnimationFrame forsøg (default: 50 = ~833ms @ 60fps)
 * @param options.onSuccess - Callback når scroll lykkes
 * @param options.onFailure - Callback når scroll fejler efter max retries
 *
 * @example
 * ```typescript
 * scrollToSection('aes', {
 *   onSuccess: () => console.log('Scrolled to AES section'),
 *   onFailure: (msg) => console.warn(msg)
 * });
 * ```
 */
export const scrollToSection = (
  sectionId: SectionId,
  options: {
    maxRetries?: number;
    onSuccess?: () => void;
    onFailure?: (reason: string) => void;
  } = {}
): void => {
  const { maxRetries = 50, onSuccess, onFailure } = options;

  let attempts = 0;

  const tryScroll = () => {
    attempts += 1;

    // Find element med data-section-id attribute
    const element = document.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`);

    if (element) {
      // Element fundet - scroll til det
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onSuccess?.();
      return;
    }

    if (attempts >= maxRetries) {
      // Max retries nået - log fejl i dev mode
      const msg = `scrollToSection fejlede efter ${maxRetries} forsøg for section="${sectionId}"`;
      if (process.env.NODE_ENV === 'development') {
        console.warn(msg);
      }
      onFailure?.(msg);
      return;
    }

    // Retry ved næste frame
    requestAnimationFrame(tryScroll);
  };

  // Start retry-loop
  requestAnimationFrame(tryScroll);
};
