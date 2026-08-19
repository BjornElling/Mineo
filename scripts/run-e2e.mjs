import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';

/**
 * Ét indgangspunkt for E2E-suiten.
 *
 * Findes som script frem for som en kæde i `package.json`, fordi opstarten har to trin, der SKAL
 * ske før Playwright, og fordi den fulde matrix vælges med en miljøvariabel: `VAR=1 kommando` er
 * bash-syntaks og virker ikke, når npm kører scripts gennem cmd.exe på Windows.
 *
 * Trinene før kørslen:
 *  1. `check-e2e-lane-tags.mjs` – et fejlstavet bane-tag betyder tavst «kører ingen steder ekstra».
 *  2. `free-e2e-port.mjs` – en afbrudt kørsel efterlader buildserveren på porten, og uden
 *     oprydning fejler den næste kørsel øjeblikkeligt med «port already used».
 *
 * Ukendte argumenter sendes videre til Playwright, så `npm run test:e2e -- --project=firefox-desktop`
 * og `-- e2e/mineo-smoke.spec.ts` virker som før.
 */

const argv = process.argv.slice(2);
const runFullMatrix = argv.includes('--full');
const playwrightArgs = argv.filter((argument) => argument !== '--full');

const runStep = (command, args, env = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...env },
  });
  if (result.error !== undefined) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
};

runStep(process.execPath, ['scripts/check-e2e-lane-tags.mjs']);
runStep(process.execPath, ['scripts/free-e2e-port.mjs']);

if (runFullMatrix) {
  console.log('Kører HELE browser- og viewportmatrixen. Det tager markant længere tid end banerne.');
}

// Playwrights egen CLI køres direkte med Node frem for gennem `npx`. På Windows er `npx` en
// .cmd-fil, og Node nægter siden 20.x at starte den uden `shell: true` – og en shell ville til
// gengæld gøre videresendte argumenter afhængige af cmd.exe's citationsregler.
const playwrightCli = createRequire(import.meta.url).resolve('@playwright/test/cli');

runStep(
  process.execPath,
  [playwrightCli, 'test', ...playwrightArgs],
  runFullMatrix ? { PLAYWRIGHT_FULL_MATRIX: '1' } : {},
);
