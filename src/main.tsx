import './apps/mineo/mineoStorageNamespace';
import { bootstrapClientApp } from './apps/shared/bootstrapClientApp';
import { ensureLatestVersionBeforeRender } from './apps/mineo/serviceWorkerBootstrap';
import { setupPwaInstallPromptCapture } from './utils/pwaInstallPrompt';
import {
  hydratePendingPwaFileOpenRequest,
  setupPwaLaunchQueueConsumer,
} from './utils/pwaLaunchQueue';
import { bootstrapProductionInputRuntime } from './inputCore/react';
import ErrorBoundary from './components/errors/ErrorBoundary';

void bootstrapClientApp({
  renderApp: async () => {
    const { default: AuthGate } = await import('./auth/AuthGate');
    // Hydrér input-runtime FØR render (§3.10).
    // Kun bindingen bruges her: `MainLayout` henter selv `startup.notice` ved at gen-kalde den
    // IDEMPOTENTE bootstrap, og viser den som overlay ved mount.
    const { binding: inputRuntimeBinding } = bootstrapProductionInputRuntime();
    return (
      <ErrorBoundary>
        <AuthGate inputRuntimeBinding={inputRuntimeBinding} />
      </ErrorBoundary>
    );
  },
  loadAppStyles: () => import('./index.css'),
  setupPwaFileOpenHandling: async () => {
    // En launchQueue-request kan være leveret til den tidligere app-version lige før en
    // opdatering. Consumeren skal derfor være klar før hydrering, mens hydreringen bringer
    // den persisterede request med ind i den nye app-version før React monteres.
    setupPwaLaunchQueueConsumer();
    await hydratePendingPwaFileOpenRequest();
  },
  // En opdatering er enten helt gennemført her – før render – eller slet ikke sket. Der findes
  // bevidst ingen `afterDesktopRenderSetup`: en åben session skifter aldrig version.
  beforeDesktopRender: ensureLatestVersionBeforeRender,
  setupPwaInstallPromptCapture,
  capturePwaInstallPrompt: true,
});
