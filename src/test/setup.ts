/**
 * Test setup file for vitest 4.x
 *
 * VIGTIGT: Med vitest 4.x og globals: true:
 * - Vi må IKKE importere describe/it/expect/vi fra 'vitest' i setup-filen
 * - Vi skal bruge globalThis for at tilgå disse funktioner
 * - jest-dom matchers skal udvides på den globale expect
 */
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

// Udvid den globale expect med jest-dom matchers
// Typesafe cast af globalThis.expect
const globalExpect = (globalThis as unknown as { expect: { extend: (m: object) => void } }).expect;
if (globalExpect?.extend) {
  globalExpect.extend(matchers);
}

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
  cleanup();
});
