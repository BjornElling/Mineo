/**
 * Scroll-utility til at scrolle til en sektion med deterministisk retry-logik
 *
 * Bruger requestAnimationFrame loop indtil element findes eller max retries nås.
 * Dette undgår setTimeout-baserede gæt der kan fejle sporadisk pga. React rendering timing.
 */

import type { SectionId } from '../domain/eoRowEvaluation/eoRowNavigationMap';
import { scrollWithRetry } from './scrollWithRetry';

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
  const failureMessage = `scrollToSection fejlede efter ${maxRetries} forsøg for section="${sectionId}"`;

  scrollWithRetry({
    maxRetries,
    findTarget: () => document.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`),
    // behavior udelades bevidst: scrollTargetIntoView afleder den fra prefers-reduced-motion.
    onSuccess,
    onFailure: (reason) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(reason);
      }
      onFailure?.(reason);
    },
    failureMessage,
  });
};
