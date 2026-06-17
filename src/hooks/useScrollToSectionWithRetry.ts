import React from 'react';

import { scrollWithRetry, type CancelScrollWithRetry } from '../utils/scrollWithRetry';

const SECTION_SCROLL_MAX_RETRIES = 60;

/**
 * Springer til en sektion (`[data-section-id]`) når den dukker op i DOM'en. Bygger på det
 * kanoniske `scrollWithRetry`-lag, så sektion-spring, interne links og debug-rækker deler
 * præcis samme "vent-til-mål-findes-så-scroll"-regel (én sandhedskilde for adfærd).
 *
 * Et igangværende retry-loop annulleres både ved nyt kald og ved unmount, så pollingen ikke
 * lever videre mod en DOM uden målet efter at komponenten er væk.
 */
export const useScrollToSectionWithRetry = (): ((sectionId: string) => void) => {
  const cancelPendingScrollRef = React.useRef<CancelScrollWithRetry | null>(null);

  const cancelPendingScroll = React.useCallback(() => {
    cancelPendingScrollRef.current?.();
    cancelPendingScrollRef.current = null;
  }, []);

  React.useEffect(() => cancelPendingScroll, [cancelPendingScroll]);

  return React.useCallback(
    (sectionId: string) => {
      cancelPendingScroll();
      cancelPendingScrollRef.current = scrollWithRetry({
        maxRetries: SECTION_SCROLL_MAX_RETRIES,
        findTarget: () => document.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`),
        failureMessage: `Sektionen '${sectionId}' dukkede ikke op i DOM'en inden for ${SECTION_SCROLL_MAX_RETRIES} forsøg.`,
      });
    },
    [cancelPendingScroll]
  );
};
