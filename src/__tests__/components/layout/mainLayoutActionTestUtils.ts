import { act, screen } from '@testing-library/react';

const waitForTestFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

export const flushMainLayoutAsyncAction = async (): Promise<void> => {
  // MainLayouts save/load-handlinger venter på commit-flush: microtask + to rAF-frames.
  // Når testen kun act-wrapper DOM-eventet, fortsætter handlerens Promise-kæde uden for act
  // og React advarer. PWA-eventhandleren starter desuden load-promisen fire-and-forget, så
  // vi dræner microtasks efter frames, hvor load/apply-dialog state sættes.
  await Promise.resolve();
  await waitForTestFrame();
  await waitForTestFrame();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

export const clickMainLayoutAction = async (label: string): Promise<void> => {
  await act(async () => {
    screen.getByText(label).click();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await flushMainLayoutAsyncAction();
    }
  });
};

export const dispatchPwaFileOpen = async (): Promise<void> => {
  await act(async () => {
    window.dispatchEvent(new CustomEvent('mineo:pwa-file-open'));
    await flushMainLayoutAsyncAction();
  });
};
