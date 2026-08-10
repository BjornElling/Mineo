/**
 * Globalt Vitest-setup.
 *
 * Standardmiljøet er Node for at undgå jsdom-pris i rene domæne-/utility-tests.
 * DOM-setup'et nedenfor aktiveres derfor kun for testfiler, der selv vælger
 * `// @vitest-environment jsdom`.
 */
import { createRequire } from 'node:module';

/**
 * Global test guard: ingen rigtige PDF-/Word-filer på disk under test.
 *
 * Baggrund: jsPDF's Node-build implementerer `doc.save(filnavn)` som en
 * filsystemsskrivning mod projektroden. Hvis en test når et reelt writer-save
 * uden mock, må den fejle hårdt i stedet for at efterlade artefakter.
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
      'Dette er forbudt under test - PDF/Word må aldrig skrives til filsystemet. ' +
      'Mock jspdf (vi.mock("jspdf", ...)) eller dokument-writeren i testen, ' +
      'eller assertér på de genererede bytes i hukommelsen.',
  );

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

const resetGlobalTestState = (): void => {
  (globalThis as { vi?: { useRealTimers: () => void } }).vi?.useRealTimers();
};

const hasDomEnvironment =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof HTMLElement !== 'undefined';

if (hasDomEnvironment) {
  const [matchers, { cleanup, act, configure }, { default: userEvent }] = await Promise.all([
    import('@testing-library/jest-dom/matchers'),
    import('@testing-library/react'),
    import('@testing-library/user-event'),
  ]);

  /**
   * `waitFor`/`findBy*` har deres EGEN timeout på 1 sekund, som `testTimeout` i `vite.config.ts` ikke
   * styrer. Den grænse blev derfor ved med at ramme, selv efter testTimeout var hævet til 15 s af præcis
   * samme grund: under coverage-instrumentering tager en integrationsfil 11–25 s, og et asynkront
   * dokument-download-flow overskrider da 1 sekund, selv om intet hænger.
   *
   * Symptomet var falske, VANDRENDE fejl i coverage-gaten — «expected vi.fn() to be called 1 times, but
   * got 0 times» i skiftende integrationsfiler fra kørsel til kørsel, mens den samme kommando kunne stå
   * grøn minuttet efter. Grænsen sættes centralt frem for pr. kaldsted, så den følger den begrundelse,
   * der allerede er skrevet ned for `testTimeout`, og ikke skal gentages i hver ny test.
   *
   * Den bevarer ægte fejl: et flow, der aldrig fuldfører, fejler stadig — blot på testTimeout.
   */
  configure({ asyncUtilTimeout: 5_000 });

  const globalExpect = (globalThis as unknown as { expect?: { extend: (m: object) => void } }).expect;
  globalExpect?.extend(matchers);

  const forbiddenLocalStorage: Storage = {
    getItem(): string | null {
      throw new Error('Direct access to window.localStorage is forbidden. Use safeLocalStorage.');
    },
    setItem(): void {
      throw new Error('Direct access to window.localStorage is forbidden. Use safeLocalStorage.');
    },
    removeItem(): void {
      throw new Error('Direct access to window.localStorage is forbidden. Use safeLocalStorage.');
    },
    clear(): void {
      throw new Error('Direct access to window.localStorage is forbidden. Use safeLocalStorage.');
    },
    key(): string | null {
      throw new Error('Direct access to window.localStorage is forbidden. Use safeLocalStorage.');
    },
    get length(): number {
      throw new Error('Direct access to window.localStorage is forbidden. Use safeLocalStorage.');
    },
  };

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: forbiddenLocalStorage,
  });

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
      // Den hurtige MessageChannel-baserede rAF kører uden for Reacts normale test-act-vindue.
      // Tabelkomponenter bruger rAF til fokus- og editor-sync, så callbacken skal act-wrappes
      // ved selve test-scheduleren frem for at hver test skal kende den interne frame.
      act(() => {
        callback(performance.now());
      });
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
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: fastRaf,
    });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: fastCancelRaf,
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: fastRaf,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: fastCancelRaf,
    });

    // setup-filen køres for hver jsdom-testfil. Portene skal lukkes igen, så
    // hundredvis af testfiler ikke efterlader aktive MessageChannel-ressourcer.
    (globalThis as { afterAll?: (fn: () => void) => void }).afterAll?.(() => {
      channel.port1.close();
      channel.port2.close();
    });
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
    value: function getContext(_contextId: string, _options?: unknown) {
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

  const mutableUserEvent = userEvent as typeof userEvent & {
    setup: (...args: Parameters<typeof userEvent.setup>) => ReturnType<typeof userEvent.setup>;
    __mineoOriginalSetup?: typeof userEvent.setup;
    __mineoSetupPatched?: true;
  };

  // Vitest genbruger afhængighedsmoduler mellem testfiler i samme worker. Uden
  // vagten bliver setup-wrapperen lagt oven på den forrige for hver jsdom-fil.
  if (!mutableUserEvent.__mineoSetupPatched) {
    mutableUserEvent.__mineoOriginalSetup = userEvent.setup.bind(userEvent);
    const originalUserEventSetup = mutableUserEvent.__mineoOriginalSetup;

    mutableUserEvent.setup = ((...args: Parameters<typeof originalUserEventSetup>) => {
      const options = args[0] ?? {};
      const api = originalUserEventSetup({ pointerEventsCheck: 0, delay: null, ...options });
      const mutableApi = api as typeof api & {
        paste: (
          targetOrClipboardData?: Element | DataTransfer | string,
          clipboardData?: DataTransfer | string,
        ) => Promise<void>;
      };

      mutableApi.paste = (async (...pasteArgs: Parameters<typeof mutableApi.paste>) => {
        const firstArg = pasteArgs[0];
        const secondArg = pasteArgs[1];
        const hasExplicitTarget = firstArg instanceof Element;
        const target = hasExplicitTarget
          ? firstArg
          : document.activeElement instanceof Element
            ? document.activeElement
            : null;
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
    mutableUserEvent.__mineoSetupPatched = true;
  }

  (globalThis as { afterEach?: (fn: () => void) => void }).afterEach?.(() => {
    resetGlobalTestState();
    cleanup();
  });
} else {
  (globalThis as { afterEach?: (fn: () => void) => void }).afterEach?.(resetGlobalTestState);
}
