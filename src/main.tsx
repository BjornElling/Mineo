import { bootstrapClientApp } from './apps/shared/bootstrapClientApp';
import {
  ensureLatestServiceWorkerBeforeRender,
  setupServiceWorkerUpdateChecks,
} from './apps/mineo/serviceWorkerBootstrap';

void bootstrapClientApp({
  renderApp: async () => {
    const { default: AuthGate } = await import('./auth/AuthGate');
    return <AuthGate />;
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
  capturePwaInstallPrompt: true,
});
