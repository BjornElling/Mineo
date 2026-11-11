import './apps/mineo/mineoStorageNamespace';
import { bootstrapClientApp } from './apps/shared/bootstrapClientApp';
import { ensureLatestVersionBeforeRender } from './apps/mineo/serviceWorkerBootstrap';
import { setupPwaInstallPromptCapture } from './utils/pwaInstallPrompt';
import {
  hydratePendingPwaFileOpenRequest,
  setupPwaLaunchQueueConsumer,
} from './utils/pwaLaunchQueue';
import ErrorBoundary from './components/errors/ErrorBoundary';

/**
 * Programmet – AuthGate, input-runtimen og dermed feltkataloget med sats- og kapitaliseringstabellerne –
 * hentes som lazy chunks, ikke i entry-chunken. Entry'en skal kun bære det, opstartens opdateringstjek
 * behøver: står en ny version klar, skal venteskærmen frem og genindlæsningen ske uden først at hente og
 * evaluere den gamle versions fulde program. Service workeren precacher alle chunks, så det er fuldt
 * offline-sikkert. `preloadApp` starter hentningen parallelt med opdateringstjekket, så den normale
 * opstart ikke venter på de to i rækkefølge. Størrelsesbudgettet i `verify-build-artifacts.mjs` holder
 * grænsen.
 */
const loadApp = () => Promise.all([import('./auth/AuthGate'), import('./inputCore/react/productionInputRuntime')]);

void bootstrapClientApp({
  preloadApp: loadApp,
  renderApp: async () => {
    const [{ default: AuthGate }, { bootstrapProductionInputRuntime }] = await loadApp();
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
