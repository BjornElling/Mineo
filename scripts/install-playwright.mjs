#!/usr/bin/env node
/**
 * Installerer den låste Playwright-browser med systempakker. CI-kørsel #340 stoppede ved
 * «Temporary failure resolving» fra apt; genforsøg hjælper ved udfald i runnerens netværk.
 * Installationen må aldrig springes over: efter sidste forsøg er gaten stadig rød.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RETRY_DELAYS_MS = [15_000, 45_000];
const BROWSERS = ['chromium', 'firefox', 'webkit'];

const isTransientInstallFailure = (output) => [
  /Temporary failure resolving|Temporary failure in name resolution/i,
  /\b(?:EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET|ENETUNREACH)\b/,
  /Connection timed out|Connection reset by peer|socket hang up/i,
  /\b(?:429|500|502|503|504)\s+(?:Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Time-?out)/i,
].some((pattern) => pattern.test(output));

const runInstaller = (browser) => new Promise((resolveRun) => {
  // Direkte Node-kald undgår både npx-downloads og Windows-shellens argumentfortolkning.
  const child = spawn(process.execPath, [resolve(repoRoot, 'node_modules/playwright/cli.js'),
    'install', '--with-deps', browser], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const forward = (stream) => (chunk) => {
    stream.write(chunk);
    // Fejlårsagen står sidst i installationsloggen; hele loggen streames stadig til CI.
    output = (output + chunk.toString()).slice(-128 * 1024);
  };
  child.stdout.on('data', forward(process.stdout));
  child.stderr.on('data', forward(process.stderr));
  child.on('error', (error) => resolveRun({ status: null, output: error.message }));
  child.on('close', (status) => resolveRun({ status, output }));
});

/** Genforsøg gælder kun kendte netværksfejl; ukendte installationsfejl stopper straks. */
const installWithRetry = async ({ browser, run = runInstaller, wait = sleep, log = console.error }) => {
  if (!BROWSERS.includes(browser)) throw new Error('Vælg chromium, firefox eller webkit.');
  for (let attempt = 1; ; attempt += 1) {
    const { status, output } = await run(browser);
    if (status === 0) return { ok: true, attempts: attempt };
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (status === null || delay === undefined || !isTransientInstallFailure(output)) {
      log(`Playwright-installationen fejlede efter ${attempt} forsøg; browserkontrollen kan ikke fortsætte.`);
      return { ok: false, attempts: attempt };
    }
    log(`Netværksfejl under Playwright-installation; prøver igen om ${delay / 1000} s.`);
    await wait(delay);
  }
};

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const { ok } = await installWithRetry({ browser: process.argv[2] });
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export { installWithRetry, isTransientInstallFailure };
