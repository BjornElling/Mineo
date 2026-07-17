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
    // Hydrér greenfield-inputruntime FØR render (§3.10). Startup-notice wires i Fase 4 sammen med den nye
    // systemnotice-port; ingen legacy-provider monteres som midlertidig fallback.
    const { binding: inputRuntimeBinding } = bootstrapProductionInputRuntime();
    return <AuthGate inputRuntimeBinding={inputRuntimeBinding} />;
  },
  beforeDesktopRender: ensureLatestServiceWorkerBeforeRender,
  afterDesktopRenderSetup: setupServiceWorkerUpdateChecks,
  setupPwaInstallPromptCapture,
  capturePwaInstallPrompt: true,
});
