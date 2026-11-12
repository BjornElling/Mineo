import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// @ts-expect-error – installationsscriptet er et .mjs-script uden typedeklarationer.
import { installWithRetry, isTransientInstallFailure } from '../../../scripts/install-playwright.mjs';

type RunResult = { status: number | null; output: string };
const DNS_FAILURE = "E: Failed to fetch https://security.ubuntu.com/ubuntu/pool/fonts.deb  Temporary failure resolving 'security.ubuntu.com'\nFailed to install browsers\nError: Installation process exited with code: 100";

const install = (results: readonly RunResult[], browser = 'chromium') => {
  let index = 0;
  const run = vi.fn(async (): Promise<RunResult> => results[Math.min(index++, results.length - 1)]);
  const wait = vi.fn(async (_milliseconds: number) => undefined);
  const promise = installWithRetry({ browser, run, wait, log: () => undefined });
  return { promise, run, wait };
};

describe('install-playwright', () => {
  it.each(['chromium', 'firefox', 'webkit'])('installerer %s uden ventetid ved succes', async (browser) => {
    const { promise, run, wait } = install([{ status: 0, output: '' }], browser);
    await expect(promise).resolves.toEqual({ ok: true, attempts: 1 });
    expect(run).toHaveBeenCalledExactlyOnceWith(browser);
    expect(wait).not.toHaveBeenCalled();
  });

  it('genopretter installationen efter DNS-fejlen fra kørsel #340', async () => {
    const { promise, wait } = install([
      { status: 1, output: DNS_FAILURE }, { status: 0, output: '' },
    ]);
    await expect(promise).resolves.toEqual({ ok: true, attempts: 2 });
    expect(wait.mock.calls).toEqual([[15_000]]);
  });

  it('stopper gaten efter tre mislykkede netværksforsøg', async () => {
    const { promise, run, wait } = install([{ status: 1, output: DNS_FAILURE }]);
    await expect(promise).resolves.toEqual({ ok: false, attempts: 3 });
    expect(run).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[15_000], [45_000]]);
  });

  it.each([
    'E: Unable to locate package fonts-freefont-ttf',
    'E: Could not get lock /var/lib/dpkg/lock-frontend',
    'Error: Installation process exited with code: 100',
    'Error: ENOSPC: no space left on device',
    'Error: certificate has expired',
  ])('stopper straks ved installationsfejlen %s', async (output) => {
    const { promise, wait } = install([{ status: 1, output }]);
    await expect(promise).resolves.toEqual({ ok: false, attempts: 1 });
    expect(wait).not.toHaveBeenCalled();
  });

  it('stopper hvis en netværksfejl efterfølges af en anden installationsfejl', async () => {
    const { promise, wait } = install([
      { status: 1, output: DNS_FAILURE }, { status: 1, output: 'E: Unable to locate package' },
    ]);
    await expect(promise).resolves.toEqual({ ok: false, attempts: 2 });
    expect(wait.mock.calls).toEqual([[15_000]]);
  });

  it('gentager ikke en proces, der ikke kunne startes eller blev afbrudt', async () => {
    const { promise, wait } = install([{ status: null, output: 'spawn EAI_AGAIN' }]);
    await expect(promise).resolves.toEqual({ ok: false, attempts: 1 });
    expect(wait).not.toHaveBeenCalled();
  });

  it('afviser ukendte browsernavne før installation', async () => {
    const { promise, run } = install([{ status: 0, output: '' }], '--help');
    await expect(promise).rejects.toThrow('Vælg chromium, firefox eller webkit.');
    expect(run).not.toHaveBeenCalled();
  });

  it.each(['Error: getaddrinfo EAI_AGAIN', '503 Service Unavailable', 'Error: ECONNRESET'])(
    'genkender netværksfejlen %s', (output) => {
      expect(isTransientInstallFailure(output)).toBe(true);
    },
  );

  it('kobler begge aktive CI-installationer til genforsøg', () => {
    const workflow = readFileSync(resolve(__dirname, '../../../.github/workflows/ci.yml'), 'utf8');
    const commands = workflow.split('\n').filter((line) => /^\s+run: .*install-playwright\.mjs/.test(line));
    expect(commands.map((line) => line.trim())).toEqual([
      'run: node scripts/install-playwright.mjs chromium',
      'run: node scripts/install-playwright.mjs ${{ matrix.browser }}',
    ]);
    expect(workflow).not.toMatch(/^\s+run: .*playwright install/m);
  });
});
