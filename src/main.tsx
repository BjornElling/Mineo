import { bootstrapClientApp } from './apps/shared/bootstrapClientApp';
import {
  ensureLatestServiceWorkerBeforeRender,
  setupServiceWorkerUpdateChecks,
} from './apps/mineo/serviceWorkerBootstrap';
import { setupPwaInstallPromptCapture } from './utils/pwaInstallPrompt';
import { bootstrapProductionInputRuntime } from './inputCore/react';

void bootstrapClientApp({
  renderApp: async () => {
    const { default: AuthGate } = await import('./auth/AuthGate');
    // Hydrér input-runtime FØR render (§3.10).
    // Kun bindingen bruges her: `MainLayout` henter selv `startup.notice` ved at gen-kalde den
    // IDEMPOTENTE bootstrap, og viser den som overlay ved mount.
    const { binding: inputRuntimeBinding } = bootstrapProductionInputRuntime();
    return <AuthGate inputRuntimeBinding={inputRuntimeBinding} />;
  },
  beforeDesktopRender: ensureLatestServiceWorkerBeforeRender,
  afterDesktopRenderSetup: setupServiceWorkerUpdateChecks,
  setupPwaInstallPromptCapture,
  capturePwaInstallPrompt: true,
});
