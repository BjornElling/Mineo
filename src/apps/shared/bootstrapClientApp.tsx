import React from 'react';
import ReactDOM from 'react-dom/client';
import UnsupportedDevicePage from '../../components/system/UnsupportedDevicePage';
import { getPhysicalScreenWidth, isTouchLikeDevice } from '../../utils/clientDevice';
import { suppressPwaInstallPrompt } from '../../utils/pwaInstallPrompt';

const UNSUPPORTED_MAX_SCREEN_WIDTH_PX = 1366;

export type ClientAppBootstrapOptions = Readonly<{
  renderApp: () => React.ReactNode | Promise<React.ReactNode>;
  setupPwaFileOpenHandling?: () => Promise<void>;
  setupPwaInstallPromptCapture?: () => void;
  beforeDesktopRender?: () => Promise<void>;
  afterDesktopRenderSetup?: () => void;
  capturePwaInstallPrompt: boolean;
  enforceUnsupportedDeviceGate?: boolean;
}>;

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

const loadUnsupportedDeviceStyles = async (): Promise<void> => {
  try {
    await Promise.all([
      import('@fontsource/montserrat/latin-400.css'),
      import('@fontsource/montserrat/latin-500.css'),
    ]);

    if (typeof document === 'undefined' || !document.fonts) return;

    await Promise.all([
      document.fonts.load('400 12px Montserrat'),
      document.fonts.load('500 20px Montserrat'),
    ]);
  } catch {
    // Fontindlæsning må ikke blokere hard-stop-siden; browserens fallback-font er acceptabel.
  }
};

export const bootstrapClientApp = async (options: ClientAppBootstrapOptions): Promise<void> => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element "#root" was not found.');
  }

  const root = ReactDOM.createRoot(rootElement);
  const unsupportedDevice = (options.enforceUnsupportedDeviceGate ?? true) && isUnsupportedDevice();
  if (unsupportedDevice || !options.capturePwaInstallPrompt) {
    // Standalone app-varianter uden PWA suppresser altid browserens install-prompt
    // (kanonisk implementering i utils/pwaInstallPrompt).
    suppressPwaInstallPrompt();
  } else {
    options.setupPwaInstallPromptCapture?.();
  }

  if (unsupportedDevice) {
    await loadUnsupportedDeviceStyles();
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
