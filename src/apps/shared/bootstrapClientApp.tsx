import React from 'react';
import ReactDOM from 'react-dom/client';

const UNSUPPORTED_MAX_SCREEN_WIDTH_PX = 1366;
let installPromptSuppressionRegistered = false;

export type ClientAppBootstrapOptions = Readonly<{
  renderApp: () => React.ReactNode | Promise<React.ReactNode>;
  setupPwaFileOpenHandling?: () => Promise<void>;
  setupPwaInstallPromptCapture?: () => void;
  beforeDesktopRender?: () => Promise<void>;
  afterDesktopRenderSetup?: () => void;
  capturePwaInstallPrompt: boolean;
  enforceUnsupportedDeviceGate?: boolean;
}>;

const isTouchLikeDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0;
  if (typeof window.matchMedia !== 'function') {
    return touchPoints > 0;
  }
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  return touchPoints > 0 && (coarsePointer || noHover);
};

const getPhysicalScreenWidth = (): number | null => {
  if (typeof window === 'undefined') return null;
  const screenWidth = window.screen?.width;
  if (typeof screenWidth === 'number' && Number.isFinite(screenWidth) && screenWidth > 0) {
    return screenWidth;
  }
  return null;
};

const isUnsupportedDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (!isTouchLikeDevice()) return false;
  const physicalScreenWidth = getPhysicalScreenWidth();
  if (physicalScreenWidth === null) return true;
  return physicalScreenWidth <= UNSUPPORTED_MAX_SCREEN_WIDTH_PX;
};

const loadDesktopStyles = async (): Promise<void> => {
  await Promise.all([
    import('@fontsource/montserrat/latin-400.css'),
    import('@fontsource/montserrat/latin-500.css'),
    import('@fontsource/montserrat/latin-600.css'),
    import('@fontsource/montserrat/latin-700.css'),
    import('../../index.css'),
  ]);
};

const suppressBrowserInstallPrompt = (): void => {
  if (typeof window === 'undefined') return;
  if (installPromptSuppressionRegistered) return;
  installPromptSuppressionRegistered = true;
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
  });
};

export const bootstrapClientApp = async (options: ClientAppBootstrapOptions): Promise<void> => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element "#root" was not found.');
  }

  const root = ReactDOM.createRoot(rootElement);
  const unsupportedDevice = (options.enforceUnsupportedDeviceGate ?? true) && isUnsupportedDevice();
  if (unsupportedDevice || !options.capturePwaInstallPrompt) {
    // Standalone app-varianter uden PWA suppresser altid browserens install-prompt.
    suppressBrowserInstallPrompt();
  } else {
    options.setupPwaInstallPromptCapture?.();
  }

  if (unsupportedDevice) {
    const { default: UnsupportedDevicePage } = await import('../../components/pages/UnsupportedDevicePage');
    root.render(
      <React.StrictMode>
        <UnsupportedDevicePage />
      </React.StrictMode>
    );
    return;
  }

  const desktopStylesPromise = loadDesktopStyles();

  await options.setupPwaFileOpenHandling?.();
  await options.beforeDesktopRender?.();
  options.afterDesktopRenderSetup?.();

  await desktopStylesPromise;
  const app = await options.renderApp();
  root.render(
    <React.StrictMode>
      {app}
    </React.StrictMode>
  );
};
