/**
 * Test setup file for vitest 4.x
 *
 * VIGTIGT: Med vitest 4.x og globals: true:
 * - Vi må IKKE importere describe/it/expect/vi fra 'vitest' i setup-filen
 * - Vi skal bruge globalThis for at tilgå disse funktioner
 * - jest-dom matchers skal udvides på den globale expect
 */
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRequire } from 'node:module';
import { setFallbackDocumentWriterFactory } from '../document/documentGenerationContext';

// Udvid den globale expect med jest-dom matchers
// Typesafe cast af globalThis.expect
const globalExpect = (globalThis as unknown as { expect: { extend: (m: object) => void } }).expect;
if (globalExpect?.extend) {
  globalExpect.extend(matchers);
}

/**
 * Global test guard: ingen rigtige PDF-/Word-filer på disk under test.
 *
 * Baggrund (det konkrete problem dette løser): jsPDF's Node-build implementerer
 * `doc.save(filnavn)` som `require('fs').writeFileSync(filnavn, buffer)` mod
 * den aktuelle arbejdsmappe (projektroden). Når en test når et reelt
 * `writer.save()` uden at have mocket `jspdf`, lander der derfor en ægte
 * PDF i projektroden. Det er sket gentagne gange og er uacceptabelt:
 * tests må aldrig skrive dokument-artefakter til disk.
 *
 * Værnet patcher `node:fs`-skrivefunktionerne (samme singleton-modul som
 * jsPDF's `require('fs')`) så ethvert forsøg på at skrive en `.pdf`/`.docx`
 * fejler hårdt med en forklarende fejl — uanset hvilken nuværende eller
 * fremtidig test der udløser det. Alle andre fs-skrivninger (fx
 * `.env.build-info.local`) går uændret igennem.
 *
 * Den naive form (kun mocke `jspdf` i hver enkelt test) er bevidst fravalgt:
 * den dækker ikke nye tests og kan brydes lydløst. Et globalt fail-closed
 * værn er det robuste valg.
 */
const isForbiddenDocumentArtifactPath = (target: unknown): boolean => {
  const asString =
    typeof target === 'string'
      ? target
      : target instanceof URL
        ? target.pathname
        : Buffer.isBuffer(target)
          ? target.toString('utf8')
          : null;
  if (asString === null) return false;
  return /\.(pdf|docx)$/i.test(asString);
};

const buildForbiddenWriteError = (target: unknown): Error =>
  new Error(
    `Test forsøgte at skrive en dokument-artefakt til disk (${String(target)}). ` +
      'Dette er forbudt under test — PDF/Word må aldrig skrives til filsystemet. ' +
      'Mock jspdf (vi.mock("jspdf", ...)) eller dokument-writeren i testen, ' +
      'eller assertér på de genererede bytes i hukommelsen.',
  );

// Vi patcher det muterbare CommonJS `fs`-modul — det er nøjagtigt samme objekt
// som jsPDF's Node-build henter med `require('fs')`, og dets metoder er
// skrivbare (modsat ESM-namespace-eksporterne fra `import 'node:fs'`, der er
// read-only getters og ikke kan redefineres).
const fsModule = createRequire(import.meta.url)('node:fs') as {
  writeFileSync: (...args: unknown[]) => unknown;
  writeFile: (...args: unknown[]) => unknown;
};

const originalWriteFileSync = fsModule.writeFileSync.bind(fsModule);
const originalWriteFile = fsModule.writeFile.bind(fsModule);

fsModule.writeFileSync = (...args: unknown[]): unknown => {
  if (isForbiddenDocumentArtifactPath(args[0])) {
    throw buildForbiddenWriteError(args[0]);
  }
  return originalWriteFileSync(...args);
};

fsModule.writeFile = (...args: unknown[]): unknown => {
  if (isForbiddenDocumentArtifactPath(args[0])) {
    // jsPDF's promise-/callback-sti: rapportér fejlen via callback hvis der er
    // en, ellers kast synkront. Begge stier forhindrer disk-skrivning.
    const maybeCallback = args[args.length - 1];
    const error = buildForbiddenWriteError(args[0]);
    if (typeof maybeCallback === 'function') {
      (maybeCallback as (err: Error) => void)(error);
      return undefined;
    }
    throw error;
  }
  return originalWriteFile(...args);
};

/**
 * Global test guard:
 * Direct access to window.localStorage is forbidden in tests.
 * All production code must go through safeLocalStorage.
 */

const forbiddenLocalStorage: Storage = {
  getItem(): string | null {
    throw new Error(
      'Direct access to window.localStorage is forbidden. Use safeLocalStorage.',
    );
  },
  setItem(): void {
    throw new Error(
      'Direct access to window.localStorage is forbidden. Use safeLocalStorage.',
    );
  },
  removeItem(): void {
    throw new Error(
      'Direct access to window.localStorage is forbidden. Use safeLocalStorage.',
    );
  },
  clear(): void {
    throw new Error(
      'Direct access to window.localStorage is forbidden. Use safeLocalStorage.',
    );
  },
  key(): string | null {
    throw new Error(
      'Direct access to window.localStorage is forbidden. Use safeLocalStorage.',
    );
  },
  get length(): number {
    throw new Error(
      'Direct access to window.localStorage is forbidden. Use safeLocalStorage.',
    );
  },
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: forbiddenLocalStorage,
});

/**
 * Test-fart: jsdom's requestAnimationFrame fyrer callbacks med ~16 ms forsinkelse (efterligner 60 fps).
 * Det er irrelevant for tests — vi venter aldrig på reel frame-timing, kun på at en frame passerer.
 * Flere kode-stier venter sekventielt på mange frames (fx save-blokeret-fokus' vent-på-mount-løkke på
 * op til 30 frames), hvilket akkumulerer hundredvis af millisekunder ren ventetid pr. test uden at teste
 * noget. Vi erstatter rAF med en near-immediate macrotask (setTimeout 0): samme macrotask-semantik og
 * rækkefølge som før (så act()/effekt-flushing er upåvirket), blot uden den kunstige 16 ms-forsinkelse.
 *
 * BEMÆRK: stadig en macrotask (ikke microtask), så selv-planlæggende rAF-animationsløkker (scrollWithRetry,
 * historyTargetRestore m.fl.) ikke kan sulte event-loopet eller udtømme deres retry-budget før React
 * committer. Vi bruger MessageChannel (samme mekanisme som Reacts egen scheduler) frem for setTimeout(0):
 * det er en ægte macrotask uden timer-subsystemets ~1 ms-clamp og pr.-turn-overhead, hvilket reducerer
 * akkumuleret ventetid markant i frame-tunge stier. Fake timers (vi.useFakeTimers) overtager bindingen.
 */
{
  const rafCallbacks = new Map<number, FrameRequestCallback>();
  let rafHandle = 0;
  const pending: number[] = [];
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    const handle = pending.shift();
    if (handle === undefined) return;
    const callback = rafCallbacks.get(handle);
    if (!callback || !rafCallbacks.delete(handle)) return;
    callback(performance.now());
  };
  const fastRaf = (callback: FrameRequestCallback): number => {
    rafHandle += 1;
    const handle = rafHandle;
    rafCallbacks.set(handle, callback);
    pending.push(handle);
    channel.port2.postMessage(null);
    return handle;
  };
  const fastCancelRaf = (handle: number): void => {
    rafCallbacks.delete(handle);
  };
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, writable: true, value: fastRaf });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, writable: true, value: fastCancelRaf });
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, writable: true, value: fastRaf });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, writable: true, value: fastCancelRaf });
}

if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = function scrollTo(options?: number | ScrollToOptions, y?: number): void {
    if (typeof options === 'number') {
      this.scrollLeft = options;
      if (typeof y === 'number') this.scrollTop = y;
      return;
    }
    if (options && typeof options === 'object') {
      if (typeof options.left === 'number') this.scrollLeft = options.left;
      if (typeof options.top === 'number') this.scrollTop = options.top;
    }
  };
}

Object.defineProperty(window, 'DataTransfer', {
  configurable: true,
  value: undefined,
});
Object.defineProperty(globalThis, 'DataTransfer', {
  configurable: true,
  value: undefined,
});

Object.defineProperty(window, 'ClipboardEvent', {
  configurable: true,
  value: undefined,
});
Object.defineProperty(globalThis, 'ClipboardEvent', {
  configurable: true,
  value: undefined,
});

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: function getContext(
    _contextId: string,
    _options?: unknown
  ) {
    return null;
  },
});

const clipboardStore = { text: '' };

Object.defineProperty(window.Event.prototype, 'clipboardData', {
  configurable: true,
  get() {
    if ((this as Event).type !== 'paste') return undefined;
    return {
      getData: (type: string) => {
        if (type === 'text' || type === 'text/plain') return clipboardStore.text;
        return '';
      },
    };
  },
});

const isDataTransfer = (value: unknown): value is DataTransfer => {
  return typeof value === 'object' && value !== null && typeof (value as DataTransfer).getData === 'function';
};

const readClipboardArg = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (isDataTransfer(value)) {
    return value.getData('text') || value.getData('text/plain') || '';
  }
  return '';
};

const originalUserEventSetup = userEvent.setup.bind(userEvent);
const mutableUserEvent = userEvent as typeof userEvent & {
  setup: (...args: Parameters<typeof originalUserEventSetup>) => ReturnType<typeof originalUserEventSetup>;
};

mutableUserEvent.setup = ((...args: Parameters<typeof originalUserEventSetup>) => {
  // Pointer-events check er en user-event diagnose, ikke app-adfærd. Den er dyr i MUI-træer,
  // så test-defaulten slår den fra; tests kan stadig vælge en anden værdi eksplicit.
  //
  // delay: null fjerner user-events default inter-keystroke-ventetid (real-timer setTimeout
  // mellem hvert simuleret tastetryk). Ingen test her hænger på reel keystroke-timing
  // (ingen input-debounce; rAF/timeout-baseret fokus flushes stadig via act), så defaulten
  // er null for fart. Tests kan stadig sætte en eksplicit delay via options.
  const options = args[0] ?? {};
  const api = originalUserEventSetup({ pointerEventsCheck: 0, delay: null, ...options });
  const mutableApi = api as typeof api & {
    paste: (targetOrClipboardData?: Element | DataTransfer | string, clipboardData?: DataTransfer | string) => Promise<void>;
  };

  mutableApi.paste = (async (...pasteArgs: Parameters<typeof mutableApi.paste>) => {
    const firstArg = pasteArgs[0];
    const secondArg = pasteArgs[1];
    const hasExplicitTarget = firstArg instanceof Element;
    const target = hasExplicitTarget
      ? firstArg
      : (document.activeElement instanceof Element ? document.activeElement : null);
    const text = hasExplicitTarget ? readClipboardArg(secondArg) : readClipboardArg(firstArg);

    if (!target) return;
    clipboardStore.text = text;

    await act(async () => {
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        configurable: true,
        get: () => ({
          getData: (type: string) => (type === 'text' || type === 'text/plain' ? text : ''),
        }),
      });
      target.dispatchEvent(pasteEvent);

      if (pasteEvent.defaultPrevented) return;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

      const start = typeof target.selectionStart === 'number' ? target.selectionStart : target.value.length;
      const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : start;
      const next = target.value.slice(0, start) + text + target.value.slice(end);
      target.value = next;

      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      Object.defineProperty(inputEvent, 'data', { configurable: true, value: text });
      Object.defineProperty(inputEvent, 'inputType', { configurable: true, value: 'insertFromPaste' });
      target.dispatchEvent(inputEvent);
    });
  }) as typeof mutableApi.paste;

  return mutableApi;
}) as typeof mutableUserEvent.setup;

/**
 * Cleanup after each test.
 *
 * BEMÆRK: Med vitest 4.x kan vi ikke importere fra 'vitest' i setup.ts
 * uden at få "runner not found" fejl. Derfor importeres afterEach/vi
 * dynamisk via globalThis når de er tilgængelige.
 *
 * @testing-library/react's cleanup() kaldes automatisk i testfilerne
 * via afterEach hook.
 */
(globalThis as { afterEach?: (fn: () => void) => void }).afterEach?.(() => {
  (globalThis as { vi?: { useRealTimers: () => void } }).vi?.useRealTimers();
  // Nulstil writer-fallbacken mellem tests, så en fil der har registreret PDF-kanalens
  // fabrik (mod sin egen jsPDF-mock) ikke lækker en stale fabrik ind i en senere fil med
  // en anden mock. Hver generator-direkte test registrerer selv fallbacken i beforeAll.
  setFallbackDocumentWriterFactory(null);
  cleanup();
});
