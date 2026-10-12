// @ts-expect-error – deploy-scriptet er et .mjs-script uden typedeklarationer.
import { deployWithRetry, isTransientDeployFailure, MAX_ATTEMPTS } from '../../../scripts/deploy-cloudflare.mjs';

/**
 * Deploy-scriptet gentager en udrulning, når Cloudflares API ikke kunne svare, og ellers ikke.
 * Grænsen er hele pointen: en forbigående 504 må ikke vælte en udrulning efter en grøn release-gate,
 * men et ugyldigt token eller en forkert konfiguration må heller ikke gemmes bag minutters ventetid.
 */

type RunResult = { status: number | null; output: string };

/** Ordlyden fra den udrulning, der fejlede 2026-10-12. */
const CLOUDFLARE_504 = [
  '✘ [ERROR] Received a malformed response from the API',
  '  <!DOCTYPE html>',
  '  POST /accounts/***/workers/scripts/mineo/assets-upload-session -> 504 Gateway Timeout',
].join('\n');

/** En ægte afvisning: API'et svarede, og svaret var nej. */
const AUTHENTICATION_ERROR = [
  '✘ [ERROR] A request to the Cloudflare API (/accounts/***/workers/services/mineo) failed.',
  '  Authentication error [code: 10000]',
].join('\n');

const runSequence = (results: readonly RunResult[]) => {
  let index = 0;
  const calls: string[] = [];
  return {
    calls,
    run: (configFile: string): RunResult => {
      calls.push(configFile);
      const result = results[Math.min(index, results.length - 1)];
      index += 1;
      return result;
    },
  };
};

const deploy = (results: readonly RunResult[]) => {
  const sequence = runSequence(results);
  const waits: number[] = [];
  const promise = deployWithRetry({
    configFile: 'wrangler.mineo.json',
    run: sequence.run,
    wait: async (milliseconds: number) => {
      waits.push(milliseconds);
    },
    log: () => undefined,
  }) as Promise<{ ok: boolean; attempts: number }>;
  return { promise, calls: sequence.calls, waits };
};

describe('deploy-cloudflare: genforsøg kun ved forbigående API-fejl', () => {
  it('genkender den faktiske 504 fra Cloudflare som forbigående', () => {
    expect(isTransientDeployFailure(CLOUDFLARE_504)).toBe(true);
    expect(isTransientDeployFailure('Error: fetch failed\n  cause: ECONNRESET')).toBe(true);
  });

  it('genkender ikke en ægte afvisning som forbigående', () => {
    expect(isTransientDeployFailure(AUTHENTICATION_ERROR)).toBe(false);
    expect(isTransientDeployFailure('✘ [ERROR] The directory specified by the "assets.directory" field does not exist')).toBe(false);
  });

  it('udruller ét forsøg, når det lykkes første gang', async () => {
    const { promise, calls, waits } = deploy([{ status: 0, output: 'Deployed mineo' }]);
    await expect(promise).resolves.toEqual({ ok: true, attempts: 1 });
    expect(calls).toEqual(['wrangler.mineo.json']);
    expect(waits).toEqual([]);
  });

  it('prøver igen efter en 504 og lykkes', async () => {
    const { promise, waits } = deploy([
      { status: 1, output: CLOUDFLARE_504 },
      { status: 0, output: 'Deployed mineo' },
    ]);
    await expect(promise).resolves.toEqual({ ok: true, attempts: 2 });
    expect(waits).toHaveLength(1);
  });

  it('fejler med det samme på en ægte afvisning', async () => {
    const { promise, calls, waits } = deploy([{ status: 1, output: AUTHENTICATION_ERROR }]);
    await expect(promise).resolves.toEqual({ ok: false, attempts: 1 });
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it('giver op efter det sidste forsøg, når API-et bliver ved med at fejle', async () => {
    const { promise, calls, waits } = deploy([{ status: 1, output: CLOUDFLARE_504 }]);
    await expect(promise).resolves.toEqual({ ok: false, attempts: MAX_ATTEMPTS });
    expect(calls).toHaveLength(MAX_ATTEMPTS);
    expect(waits).toHaveLength(MAX_ATTEMPTS - 1);
  });
});
