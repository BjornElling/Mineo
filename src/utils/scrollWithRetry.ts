export type ScrollWithRetryOptions = Readonly<{
  maxRetries: number;
  findTarget: () => HTMLElement | null;
  behavior: ScrollBehavior;
  block?: ScrollLogicalPosition;
  onSuccess?: () => void;
  onFailure?: (reason: string) => void;
  failureMessage: string;
}>;

export const scrollWithRetry = (options: ScrollWithRetryOptions): void => {
  if (typeof document === 'undefined') {
    options.onFailure?.('No DOM environment available for scroll');
    return;
  }

  let attempts = 0;
  const block = options.block ?? 'start';

  const tryScroll = () => {
    attempts += 1;
    const target = options.findTarget();

    if (target) {
      target.scrollIntoView({ behavior: options.behavior, block });
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
