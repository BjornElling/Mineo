// @vitest-environment jsdom

import React from 'react';
import { bootstrapClientApp } from '../../../apps/shared/bootstrapClientApp';

const {
  createRootMock,
  rootRenderMock,
  setupVitePreloadRecoveryMock,
} = vi.hoisted(() => ({
  createRootMock: vi.fn(),
  rootRenderMock: vi.fn(),
  setupVitePreloadRecoveryMock: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: createRootMock,
  },
  createRoot: createRootMock,
}));

vi.mock('../../../apps/shared/vitePreloadRecovery', () => ({
  setupVitePreloadRecovery: setupVitePreloadRecoveryMock,
}));

const configureSupportedDesktop = (): void => {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 0,
  });
  Object.defineProperty(window.screen, 'width', {
    configurable: true,
    value: 1920,
  });
  Object.defineProperty(window.screen, 'height', {
    configurable: true,
    value: 1080,
  });
  window.matchMedia = vi.fn(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('bootstrapClientApp – understøttet desktop-ordre', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    configureSupportedDesktop();
    createRootMock.mockReset();
    rootRenderMock.mockReset();
    setupVitePreloadRecoveryMock.mockReset();
    createRootMock.mockReturnValue({
      render: rootRenderMock,
      unmount: vi.fn(),
    });
  });

  it('afslutter bootstrap i den observerbare sideeffekt-rækkefølge', async () => {
    const events: string[] = [];
    setupVitePreloadRecoveryMock.mockImplementation(() => {
      events.push('preload-recovery');
    });
    const setupPwaInstallPromptCapture = vi.fn(() => {
      events.push('install-capture');
    });
    const setupPwaFileOpenHandling = vi.fn(async () => {
      events.push('file-open');
    });
    const beforeDesktopRender = vi.fn(async () => {
      events.push('before-render');
    });
    const loadAppStyles = vi.fn(async () => {
      events.push('app-styles');
    });
    const renderApp = vi.fn(() => {
      events.push('render-app');
      return <div>App</div>;
    });
    const afterDesktopRenderSetup = vi.fn(() => {
      events.push('after-render');
    });
    rootRenderMock.mockImplementation(() => {
      events.push('root-render');
    });

    await bootstrapClientApp({
      renderApp,
      loadAppStyles,
      setupPwaFileOpenHandling,
      setupPwaInstallPromptCapture,
      beforeDesktopRender,
      afterDesktopRenderSetup,
      capturePwaInstallPrompt: true,
    });

    expect(events).toEqual([
      'preload-recovery',
      'install-capture',
      'app-styles',
      'file-open',
      'before-render',
      'render-app',
      'root-render',
      'after-render',
    ]);
    expect(renderApp).toHaveBeenCalledOnce();
    expect(rootRenderMock).toHaveBeenCalledOnce();
  });
});
