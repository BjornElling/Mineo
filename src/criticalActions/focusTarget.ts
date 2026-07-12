import type { CriticalActionFocusTarget } from './criticalActionCoordinator';

export const createElementFocusTarget = (getElement: () => HTMLElement | null): CriticalActionFocusTarget => ({
  focus: () => {
    const element = getElement();
    if (!element?.isConnected || element.matches(':disabled')) return;
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  },
});
