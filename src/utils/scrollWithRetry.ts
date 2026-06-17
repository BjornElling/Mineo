import { scrollTargetIntoView } from './scrollTargetIntoView';

export type ScrollWithRetryOptions = Readonly<{
  maxRetries: number;
  findTarget: () => HTMLElement | null;
  /**
   * Override scroll-animationen. Udelades normalt: scrollTargetIntoView afleder den
   * da fra prefers-reduced-motion, så alle scroll-stier respekterer indstillingen ens.
   */
  behavior?: ScrollBehavior;
  onSuccess?: () => void;
  onFailure?: (reason: string) => void;
  failureMessage: string;
}>;

/**
 * Annullér en kørende retry-loop. Idempotent: kan kaldes flere gange / efter at loopet selv
 * er stoppet uden effekt.
 */
export type CancelScrollWithRetry = () => void;

/**
 * Retry-loop der venter (via requestAnimationFrame) til målet findes i DOM'en og derefter
 * scroller det ind i vinduet. Selve scroll-adfærden ejes af scrollTargetIntoView, så interne
 * links, sektion-spring og debug-rækker bruger samme regel som tab-navigation:
 * scroll kun hvis målet ikke allerede er synligt, og centrér det da lodret.
 *
 * Returnerer en cancel-funktion, så kaldere der lever i en React-komponent kan afbryde det
 * selv-planlæggende rAF-loop ved unmount (ellers fortsætter `findTarget`-polling mod en DOM
 * uden målet, indtil maxRetries er nået).
 */
export const scrollWithRetry = (options: ScrollWithRetryOptions): CancelScrollWithRetry => {
  if (typeof document === 'undefined') {
    options.onFailure?.('No DOM environment available for scroll');
    return () => {};
  }

  let attempts = 0;
  let rafId: number | null = null;
  let cancelled = false;

  const tryScroll = () => {
    rafId = null;
    if (cancelled) return;
    attempts += 1;
    const target = options.findTarget();

    if (target) {
      scrollTargetIntoView(target, { behavior: options.behavior });
      options.onSuccess?.();
      return;
    }

    if (attempts >= options.maxRetries) {
      options.onFailure?.(options.failureMessage);
      return;
    }

    rafId = requestAnimationFrame(tryScroll);
  };

  rafId = requestAnimationFrame(tryScroll);

  return () => {
    cancelled = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
};
