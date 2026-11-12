/**
 * Projektets runtime-krav og den fail-closed kontrol, som alle indgange deler.
 *
 * Sandheden er ÉN kilde: `package.json` → `engines`. Lagene, der håndhæver den:
 *
 * - `engine-strict=true` (`.npmrc`) afviser `npm install`/`npm ci` på forkert Node eller npm.
 * - `devEngines.runtime` (onFail `error`) får npm til at afvise `npm run`, `npm test`, `npm exec` og `npx`
 *   på forkert Node – også på et træ, der allerede er installeret.
 * - `assertSupportedNode()` herunder kaldes fra `vite.config.ts` og `playwright.config.ts`, så også indgange
 *   uden om npm (editorens Vitest-/Playwright-udvidelse, Vite-CLI'en startet direkte) stopper.
 * - `check:runtime` er gatens trin og kontrollerer desuden npm-versionen.
 *
 * En lavere lokal version accepteres aldrig, heller ikke som advarsel: rettelsen er at opgradere
 * installationen – se `upgradeInstructions`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { satisfiesRange } from './version-range.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Læs `engines` og `packageManager` fra den ENE kanoniske kilde. */
export const readRuntimeRequirements = () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const engines = pkg.engines;
  if (engines === undefined || typeof engines.node !== 'string' || typeof engines.npm !== 'string') {
    throw new Error('package.json → engines mangler node/npm. Kontrollen kan ikke måle mod en tom erklæring.');
  }
  const packageManagerVersion = /^npm@(\d+\.\d+\.\d+)$/.exec(pkg.packageManager ?? '')?.[1];
  if (packageManagerVersion === undefined) {
    throw new Error('package.json → packageManager skal være npm@X.Y.Z.');
  }
  return { node: engines.node, npm: engines.npm, packageManagerVersion };
};

/** Hvordan installationen bringes op på projektets niveau. Nedgradering af kravet er ikke en mulighed. */
export const upgradeInstructions = (requirements) =>
  [
    'Opgradér den lokale installation – kravet sænkes ikke:',
    '  Windows (installeret med winget/MSI):  winget upgrade --id OpenJS.NodeJS.LTS --exact',
    '  Med en version manager:                 nvm install / fnm install (læser .nvmrc)',
    `  Derefter npm:                           npm install --global npm@${requirements.packageManagerVersion}`,
    'Åbn en ny terminal (og genstart VS Code), så den nye version er den, der findes på PATH.',
  ].join('\n');

/** Stop processen hårdt, hvis den KØRENDE Node ligger uden for `engines.node`. */
export const assertSupportedNode = () => {
  const requirements = readRuntimeRequirements();
  if (satisfiesRange(process.versions.node, requirements.node)) return;
  throw new Error(
    `Mineo kræver Node ${requirements.node}, men kører på Node ${process.versions.node} (${process.execPath}).\n\n`
      + upgradeInstructions(requirements)
  );
};
