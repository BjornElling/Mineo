/**
 * Genopretter fra en Vite lazy-load-fejl, når en åben app-version peger på et asset, der blev
 * fjernet ved en ny deploy. Uden reload kan den gamle modulreference aldrig blive gyldig igen.
 *
 * Vite udsender `vite:preloadError` for både route-, renderer- og writer-chunks. Derfor ligger
 * håndteringen i den fælles bootstrap og ikke i den enkelte dokumentdefinition.
 */
import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import {
  readOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../../utils/safeSessionStorage';

let removePreloadErrorListener: (() => void) | null = null;

const getFailureSignature = (payload: unknown): string | null => {
  if (!(payload instanceof Error)) return null;
  return payload.message.trim() === '' ? null : payload.message;
};

/**
 * Installerer Vites ene globale recovery-hook.
 *
 * Den senest fejlede asset-signatur gemmes før reload. Kommer den samme fejl igen efter reload,
 * lader vi Vite-fejlen nå den normale fejlhåndtering i stedet for at skabe en reload-løkke. Kan
 * sessionStorage ikke kvittere for markøren, reloader vi heller ikke: uden den kvittering kan en
 * midlertidig netværksfejl blive til en uendelig løkke.
 */
export const setupVitePreloadRecovery = (): void => {
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined') return;
  if (removePreloadErrorListener !== null) return;

  const handlePreloadError = (event: VitePreloadErrorEvent): void => {
    const signature = getFailureSignature(event.payload);
    if (signature === null) return;

    if (readOptionalSessionStorageValue(UI_STORAGE_KEYS.vitePreloadRecovery) === signature) {
      return;
    }

    if (!writeOptionalSessionStorageValue(UI_STORAGE_KEYS.vitePreloadRecovery, signature)) {
      return;
    }

    event.preventDefault();
    window.location.reload();
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
};
