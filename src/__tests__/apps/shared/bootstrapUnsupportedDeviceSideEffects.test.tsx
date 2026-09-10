// @vitest-environment jsdom
import React from 'react';
import { bootstrapClientApp } from '../../../apps/shared/bootstrapClientApp';

const {
  createRootMock,
  rootRenderMock,
  suppressPwaInstallPromptMock,
  setupVitePreloadRecoveryMock,
} = vi.hoisted(() => ({
  createRootMock: vi.fn(),
  rootRenderMock: vi.fn(),
  suppressPwaInstallPromptMock: vi.fn(),
  setupVitePreloadRecoveryMock: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: createRootMock,
  },
  createRoot: createRootMock,
}));

vi.mock('../../../utils/pwaInstallPrompt', () => ({
  suppressPwaInstallPrompt: suppressPwaInstallPromptMock,
}));

vi.mock('../../../apps/shared/vitePreloadRecovery', () => ({
  setupVitePreloadRecovery: setupVitePreloadRecoveryMock,
}));

const createMediaQueryList = (matches: boolean): MediaQueryList => ({
  matches,
  media: '',
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

const configureUnsupportedTouchDevice = (): void => {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 5,
  });
  Object.defineProperty(window.screen, 'width', {
    configurable: true,
    value: 390,
  });
  window.matchMedia = vi.fn((query: string) => {
    return createMediaQueryList(query === '(pointer: coarse)' || query === '(hover: none)');
  });
};

describe('bootstrapClientApp unsupported-device gate', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    createRootMock.mockReset();
    rootRenderMock.mockReset();
    suppressPwaInstallPromptMock.mockReset();
    setupVitePreloadRecoveryMock.mockReset();
    createRootMock.mockReturnValue({
      render: rootRenderMock,
      unmount: vi.fn(),
    });
    configureUnsupportedTouchDevice();
  });

  it('springer appens desktop-sideeffekter over og viser kun hard-stop', async () => {
    const renderApp = vi.fn(() => <div>App</div>);
    const loadAppStyles = vi.fn(async () => undefined);
    const setupPwaFileOpenHandling = vi.fn(async () => undefined);
    const setupPwaInstallPromptCapture = vi.fn();
    const beforeDesktopRender = vi.fn(async () => undefined);
    const afterDesktopRenderSetup = vi.fn();

    await bootstrapClientApp({
      renderApp,
      loadAppStyles,
      setupPwaFileOpenHandling,
      setupPwaInstallPromptCapture,
      beforeDesktopRender,
      afterDesktopRenderSetup,
      capturePwaInstallPrompt: true,
    });

    expect(setupVitePreloadRecoveryMock).toHaveBeenCalledOnce();
    expect(suppressPwaInstallPromptMock).toHaveBeenCalledOnce();
    expect(renderApp).not.toHaveBeenCalled();
    expect(loadAppStyles).not.toHaveBeenCalled();
    expect(setupPwaFileOpenHandling).not.toHaveBeenCalled();
    expect(setupPwaInstallPromptCapture).not.toHaveBeenCalled();
    expect(beforeDesktopRender).not.toHaveBeenCalled();
    expect(afterDesktopRenderSetup).not.toHaveBeenCalled();
    expect(rootRenderMock).toHaveBeenCalledOnce();
  });
});
