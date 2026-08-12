/**
 * Håndterer den sidste restkategori af Vite lazy-load-fejl. Den normale deploybeskyttelse er
 * service-workerens versionscache; denne vej må derfor aldrig selv genindlæse og risikere en
 * åben editors draft. Mineo-shellen gør i stedet den nødvendige genindlæsning synlig og passerer
 * den gennem CriticalActionCoordinator.
 *
 * Vite udsender `vite:preloadError` for både route-, renderer- og writer-chunks. Derfor ligger
 * håndteringen i den fælles bootstrap og ikke i den enkelte dokumentdefinition.
 */
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

const getFailureSignature = (payload: unknown): string | null => {
  if (!(payload instanceof Error)) return null;
  return payload.message.trim() === '' ? null : payload.message;
};

/**
 * Installerer Vites ene globale recovery-hook.
 *
 * Et Vite-signal undertrykkes og offentliggøres som en ventende, sikker recovery. Det er bevidst
 * ikke en automatisk reload: sessionStorage indeholder afsluttet input, men en åben editor har
 * stadig en draft, som kun den kritiske handlingsbarriere kan settle eller afvise korrekt.
 */
export const setupVitePreloadRecovery = (): void => {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined') return;
  if (removePreloadErrorListener !== null) return;

  const handlePreloadError = (event: VitePreloadErrorEvent): void => {
    if (getFailureSignature(event.payload) === null) return;
    event.preventDefault();
    publishRecoveryPending(true);
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
