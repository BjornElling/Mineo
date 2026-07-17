import { bootstrapClientApp } from './apps/shared/bootstrapClientApp';
import {
  ensureLatestServiceWorkerBeforeRender,
  setupServiceWorkerUpdateChecks,
} from './apps/mineo/serviceWorkerBootstrap';
import { setupPwaInstallPromptCapture } from './utils/pwaInstallPrompt';
import { initializePersistenceRuntime } from './persistence/persistenceRuntime';
import { bootstrapProductionInputRuntime } from './inputCore/react';

void bootstrapClientApp({
  renderApp: async () => {
    const { default: AuthGate } = await import('./auth/AuthGate');
    const persistenceRuntime = initializePersistenceRuntime();
    // Hydrér greenfield-inputruntime FØR render (§3.10). Startup-notice (korruption/utilgængeligt lager, §1.12)
    // wires ind i systemfejl-/noticeoverfladen i Fase 4; bindingen distribueres allerede nu til React-træet.
    const { binding: inputRuntimeBinding } = bootstrapProductionInputRuntime();
    return <AuthGate persistenceRuntime={persistenceRuntime} inputRuntimeBinding={inputRuntimeBinding} />;
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
