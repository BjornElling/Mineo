export const waitForAnimationFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

export const focusElementWithoutScroll = (element: HTMLElement): void => {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
};

export const restoreFocusIfPossible = (element: HTMLElement | null): void => {
  if (!element?.isConnected || element.matches(':disabled')) return;
  focusElementWithoutScroll(element);
};
