import React from 'react';

import { scrollTargetIntoView } from '../utils/scrollTargetIntoView';

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
          // Samme scroll-regel som tab/undo: scroll kun hvis sektionen ikke allerede er synlig.
          scrollTargetIntoView(target);
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
