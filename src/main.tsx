import { bootstrapClientApp } from './apps/shared/bootstrapClientApp';
import {
  ensureLatestServiceWorkerBeforeRender,
  setupServiceWorkerUpdateChecks,
} from './apps/mineo/serviceWorkerBootstrap';
import { setupPwaInstallPromptCapture } from './utils/pwaInstallPrompt';
import { initializePersistenceRuntime } from './persistence/persistenceRuntime';

void bootstrapClientApp({
  renderApp: async () => {
    const { default: AuthGate } = await import('./auth/AuthGate');
    const persistenceRuntime = initializePersistenceRuntime();
    return <AuthGate persistenceRuntime={persistenceRuntime} />;
  },
  setupPwaFileOpenHandling: async () => {
    const {
      hydratePendingPwaFileOpenRequest,
      setupPwaLaunchQueueConsumer,
    } = await import('./utils/pwaLaunchQueue');

    setupPwaLaunchQueueConsumer();
    await hydratePendingPwaFileOpenRequest();
  },
  beforeDesktopRender: ensureLatestServiceWorkerBeforeRender,
  afterDesktopRenderSetup: setupServiceWorkerUpdateChecks,
  setupPwaInstallPromptCapture,
  capturePwaInstallPrompt: true,
});
