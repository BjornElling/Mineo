/**
 * Scroll-utility til at scrolle til en sektion med deterministisk retry-logik
 *
 * Bruger requestAnimationFrame loop indtil element findes eller max retries nås.
 * Dette undgår setTimeout-baserede gæt der kan fejle sporadisk pga. React rendering timing.
 */

import { blinkFieldAttention } from '../inputCore/react/fieldAttentionBlink';
import { scrollWithRetry, type CancelScrollWithRetry } from './scrollWithRetry';

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
  sectionId: string,
  options: {
    maxRetries?: number;
    /** Bruges kun når en regel ikke har ét konkret felt at pege på. */
    attention?: boolean;
    onSuccess?: () => void;
    onFailure?: (reason: string) => void;
  } = {}
): CancelScrollWithRetry => {
  const { maxRetries = 50, attention = false, onSuccess, onFailure } = options;
  const failureMessage = `scrollToSection fejlede efter ${maxRetries} forsøg for section="${sectionId}"`;

  return scrollWithRetry({
    maxRetries,
    findTarget: () => document.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`),
    // behavior udelades bevidst: scrollTargetIntoView afleder den fra prefers-reduced-motion.
    onSuccess: (target) => {
      if (attention) blinkFieldAttention(target);
      onSuccess?.();
    },
    onFailure: (reason) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(reason);
      }
      onFailure?.(reason);
    },
    failureMessage,
  });
};
