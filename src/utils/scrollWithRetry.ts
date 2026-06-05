import { scrollTargetIntoView } from './scrollTargetIntoView';

export type ScrollWithRetryOptions = Readonly<{
  maxRetries: number;
  findTarget: () => HTMLElement | null;
  behavior: ScrollBehavior;
  onSuccess?: () => void;
  onFailure?: (reason: string) => void;
  failureMessage: string;
}>;

/**
 * Retry-loop der venter (via requestAnimationFrame) til målet findes i DOM'en og derefter
 * scroller det ind i vinduet. Selve scroll-adfærden ejes af scrollTargetIntoView, så interne
 * links, sektion-spring og debug-rækker bruger samme regel som tab-navigation:
 * scroll kun hvis målet ikke allerede er synligt, og centrér det da lodret.
 */
export const scrollWithRetry = (options: ScrollWithRetryOptions): void => {
  if (typeof document === 'undefined') {
    options.onFailure?.('No DOM environment available for scroll');
    return;
  }

  let attempts = 0;

  const tryScroll = () => {
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

    requestAnimationFrame(tryScroll);
  };

  requestAnimationFrame(tryScroll);
};
