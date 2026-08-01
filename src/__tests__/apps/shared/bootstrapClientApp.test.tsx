// @vitest-environment jsdom
import React from 'react';
import { bootstrapClientApp } from '../../../apps/shared/bootstrapClientApp';

const { createRootMock, rootRenderMock } = vi.hoisted(() => ({
  createRootMock: vi.fn(),
  rootRenderMock: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: createRootMock,
  },
  createRoot: createRootMock,
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

describe('bootstrapClientApp', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    rootRenderMock.mockReset();
    createRootMock.mockReset();
    createRootMock.mockReturnValue({
      render: rootRenderMock,
      unmount: vi.fn(),
    });
    configureUnsupportedTouchDevice();
  });

  it('bruger unsupported-device hard stop som standard på touch/mobil', async () => {
    const renderApp = vi.fn(() => <div>App</div>);

    await bootstrapClientApp({
      renderApp,
      loadAppStyles: async () => undefined,
      capturePwaInstallPrompt: false,
    });

    expect(renderApp).not.toHaveBeenCalled();
    expect(rootRenderMock).toHaveBeenCalledOnce();
  });

  it('kan fravælge unsupported-device gaten for standalone-apps', async () => {
    const renderApp = vi.fn(() => <div>Standalone procesrente</div>);

    await bootstrapClientApp({
      renderApp,
      loadAppStyles: async () => undefined,
      capturePwaInstallPrompt: false,
      enforceUnsupportedDeviceGate: false,
    });

    expect(renderApp).toHaveBeenCalledOnce();
    expect(rootRenderMock).toHaveBeenCalledOnce();
  });

  it('klassificerer touch-enheder stabilt ud fra kortsiden i landskab', async () => {
    Object.defineProperty(window.screen, 'width', { configurable: true, value: 1440 });
    Object.defineProperty(window.screen, 'height', { configurable: true, value: 900 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    const renderApp = vi.fn(() => <div>App</div>);

    await bootstrapClientApp({
      renderApp,
      loadAppStyles: async () => undefined,
      capturePwaInstallPrompt: false,
    });

    expect(renderApp).not.toHaveBeenCalled();
  });

  it('viser en deterministisk fallback når opstarten fejler', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await bootstrapClientApp({
      renderApp: () => <div>App</div>,
      loadAppStyles: async () => Promise.reject(new Error('CSS-fejl')),
      capturePwaInstallPrompt: false,
      enforceUnsupportedDeviceGate: false,
    });

    expect(rootRenderMock).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith('Appens opstart fejlede.', expect.any(Error));
  });
});
