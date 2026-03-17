import React from 'react';

export const useScrollToSectionWithRetry = (): ((sectionId: string) => void) => {
  const pendingScrollRafRef = React.useRef<number | null>(null);

  const clearPendingScroll = React.useCallback(() => {
    if (pendingScrollRafRef.current !== null) {
      cancelAnimationFrame(pendingScrollRafRef.current);
      pendingScrollRafRef.current = null;
    }
  }, []);

  return React.useCallback(
    (sectionId: string) => {
      clearPendingScroll();
      let attempts = 0;
      const maxAttempts = 60;

      const tick = () => {
        const target = document.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          pendingScrollRafRef.current = null;
          return;
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          pendingScrollRafRef.current = requestAnimationFrame(tick);
        } else {
          pendingScrollRafRef.current = null;
        }
      };

      pendingScrollRafRef.current = requestAnimationFrame(tick);
    },
    [clearPendingScroll]
  );
};
