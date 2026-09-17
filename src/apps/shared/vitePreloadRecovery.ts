/**
 * Håndterer den sidste restkategori af Vite lazy-load-fejl. Den normale deploybeskyttelse er
 * service-workerens versionscache; denne vej må derfor aldrig selv genindlæse og risikere en
 * åben editors draft. Mineo-shellen gør i stedet den nødvendige genindlæsning synlig og passerer
 * den gennem CriticalActionCoordinator.
 *
 * Vite udsender `vite:preloadError` for både route-, renderer- og writer-chunks. Derfor ligger
 * håndteringen i den fælles bootstrap og ikke i den enkelte dokumentdefinition.
 *
 * **`preventDefault()` er ikke en universel undertrykkelse.** Vites hjælper er formet sådan:
 *
 * ```js
 * return promise.then((res) => {
 *   for (const item of res || []) if (item.status === 'rejected') handlePreloadError(item.reason);
 *   return baseModule().catch(handlePreloadError);
 * });
 * ```
 *
 * `handlePreloadError` kaster kun videre, når eventet IKKE er defaultPrevented. De to kaldesteder
 * har derfor hver sin konsekvens af en undertrykkelse:
 *
 *  1. **Fejlet CSS-preload** (`Unable to preload CSS for …`): løkken fortsætter, og `baseModule()`
 *     henter modulet alligevel. Undertrykkelsen redder her en fungerende session – kun
 *     stylesheetet mangler. Den beholdes.
 *  2. **Fejlet modulhentning**: `.catch(handlePreloadError)` returnerer `undefined`, så
 *     `await import(...)` RESOLVER med `undefined`. Hvert kaldested rammer da en TypeError ved
 *     destructuring («Cannot destructure property …»), som bliver rapporteret som en uforståelig
 *     systemfejl – præcis dét, denne linje findes for at undgå
 *     (`app-shell-contract.md` §Kendte Undtagelser 4). Fejlen skal derfor kastes videre. Den
 *     markeres i `lazyChunkFailure`, så kaldestedet kan kende den igen på IDENTITET frem for på en
 *     browserspecifik fejltekst.
 */
import { markLazyChunkFailure } from '../../utils/lazyChunkFailure';

let removePreloadErrorListener: (() => void) | null = null;
let recoveryPending = false;
const recoveryListeners = new Set<() => void>();

const publishRecoveryPending = (nextValue: boolean): void => {
  if (recoveryPending === nextValue) return;
  recoveryPending = nextValue;
  for (const listener of recoveryListeners) listener();
};

export const isVitePreloadRecoveryPending = (): boolean => recoveryPending;

export const subscribeVitePreloadRecovery = (listener: () => void): (() => void) => {
  recoveryListeners.add(listener);
  return () => recoveryListeners.delete(listener);
};

/** Genindlæser kun efter shellens eksplicitte, input-sikrede brugerhandling. */
export const reloadAfterVitePreloadRecovery = (): boolean => {
  if (!recoveryPending || typeof window === 'undefined') return false;
  publishRecoveryPending(false);
  window.location.reload();
  return true;
};

/**
 * Vites egen ordlyd for en fejlet CSS-preload. Den er det ENESTE signal, der adskiller de to
 * kaldesteder i hjælperen fra hinanden. Ændrer Vite teksten, falder vi tilbage til den strenge vej
 * (fejlen kastes videre) – fail-safe frem for en tavs `undefined`-resolution.
 */
const CSS_PRELOAD_FAILURE_PREFIX = 'Unable to preload CSS for';

const getFailureError = (payload: unknown): Error | null => {
  if (!(payload instanceof Error)) return null;
  return payload.message.trim() === '' ? null : payload;
};

/**
 * Installerer Vites ene globale recovery-hook.
 *
 * Et Vite-signal offentliggøres som en ventende, sikker recovery. Det er bevidst ikke en automatisk
 * reload: sessionStorage indeholder afsluttet input, men en åben editor har stadig en draft, som kun
 * den kritiske handlingsbarriere kan settle eller afvise korrekt.
 *
 * Selve fejlen undertrykkes kun for CSS-preloads – se modulkommentaren for hvorfor en generel
 * undertrykkelse gør det modsatte af det tilsigtede.
 */
export const setupVitePreloadRecovery = (): void => {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined') return;
  if (removePreloadErrorListener !== null) return;

  const handlePreloadError = (event: VitePreloadErrorEvent): void => {
    const failure = getFailureError(event.payload);
    if (failure === null) return;
    publishRecoveryPending(true);

    if (failure.message.startsWith(CSS_PRELOAD_FAILURE_PREFIX)) {
      event.preventDefault();
      return;
    }

    // Ingen `preventDefault()`: Vite kaster den SAMME instans videre, så kaldestedet får en ægte
    // afvisning i stedet for et `undefined`-modul. Markeringen sker her, mens identiteten er kendt.
    markLazyChunkFailure(failure);
  };

  window.addEventListener('vite:preloadError', handlePreloadError);
  removePreloadErrorListener = () => {
    window.removeEventListener('vite:preloadError', handlePreloadError);
    removePreloadErrorListener = null;
  };
};

/** Kun test-infrastruktur må afmontere den globale browser-listener. */
export const __resetVitePreloadRecoveryForTests = (): void => {
  removePreloadErrorListener?.();
  recoveryPending = false;
  recoveryListeners.clear();
};
