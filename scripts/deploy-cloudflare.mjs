#!/usr/bin/env node
/**
 * Udruller én Cloudflare-konfiguration med det låste `wrangler` fra package-lock.json og gentager
 * forsøget, når Cloudflares API svarer med en forbigående fejl.
 *
 * Baggrund: 2026-10-12 fejlede deploy-jobbet efter en grøn release-gate og grøn E2E-matrix, fordi
 * `POST .../assets-upload-session` svarede «504 Gateway Timeout» fra Cloudflares egen kant. Intet
 * var galt med artefaktet; en ny kørsel af samme job ville være gået igennem. `wrangler-action`
 * kan ikke gentage et forsøg, og den installerede samtidig en nyere wrangler end den låste.
 *
 * Kun forbigående udfald gentages (5xx, 429, netværksfejl, et svar der ikke er JSON). En ægte fejl –
 * forkert token, ugyldig konfiguration, manglende assets-mappe – fejler med det samme, så den ikke
 * gemmes bag ventetid. Udrulningen er idempotent: assets uploades efter indholdshash, så et forsøg,
 * der blev afbrudt halvvejs, efterlader intet, et nyt forsøg ikke selv retter.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [15_000, 45_000, 90_000];

/** Kendetegn på, at Cloudflares API ikke kunne svare – ikke på, at det afviste udrulningen. */
const TRANSIENT_FAILURE_PATTERNS = [
  /->\s*(?:429|500|502|503|504|520|521|522|523|524)\b/,
  /\b(?:429|500|502|503|504)\s+(?:Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Time-?out)/i,
  /Received a malformed response from the API/i,
  /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|ENETUNREACH|UND_ERR_[A-Z_]+/,
  /fetch failed|socket hang up/i,
];

const isTransientDeployFailure = (output) => TRANSIENT_FAILURE_PATTERNS.some((pattern) => pattern.test(output));

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

const runWrangler = (repoRoot, configFile) => {
  const result = spawnSync(
    process.execPath,
    [resolve(repoRoot, 'node_modules/wrangler/bin/wrangler.js'), 'deploy', '--config', configFile],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`,
  };
};

/**
 * @param {{ configFile: string, run?: (configFile: string) => { status: number | null, output: string },
 *   wait?: (milliseconds: number) => Promise<void>, log?: (message: string) => void }} options
 * @returns {Promise<{ ok: boolean, attempts: number }>}
 */
const deployWithRetry = async ({
  configFile,
  run = (file) => runWrangler(defaultRepoRoot, file),
  wait = sleep,
  log = (message) => console.error(message),
}) => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const { status, output } = run(configFile);
    if (status === 0) return { ok: true, attempts: attempt };

    if (!isTransientDeployFailure(output)) {
      log(`\nUdrulningen af ${configFile} fejlede uden tegn på en forbigående API-fejl; prøver ikke igen.\n`);
      return { ok: false, attempts: attempt };
    }
    if (attempt === MAX_ATTEMPTS) {
      log(`\nCloudflares API svarede stadig med en forbigående fejl efter ${MAX_ATTEMPTS} forsøg.\n`);
      return { ok: false, attempts: attempt };
    }

    const delay = RETRY_DELAYS_MS[attempt - 1];
    log(
      `\nForbigående fejl fra Cloudflares API ved forsøg ${attempt}/${MAX_ATTEMPTS}; `
      + `prøver igen om ${delay / 1000} s.\n`
    );
    await wait(delay);
  }
  return { ok: false, attempts: MAX_ATTEMPTS };
};

const isMain = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  const configFile = process.argv[2];
  if (configFile === undefined) {
    console.error('Brug: node scripts/deploy-cloudflare.mjs <wrangler-konfiguration>');
    process.exitCode = 1;
  } else {
    const { ok } = await deployWithRetry({ configFile });
    if (!ok) process.exitCode = 1;
  }
}

export { deployWithRetry, isTransientDeployFailure, MAX_ATTEMPTS };
