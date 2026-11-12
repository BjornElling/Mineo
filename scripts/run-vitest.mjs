#!/usr/bin/env node
/**
 * Starter Vitest fra projektroden med STORT drevbogstav på Windows.
 *
 * **Fejlen, dette lukker.** Git Bash og VS Codes terminal giver ofte Node arbejdsmappen `c:\…`. Vitest-CLI'en
 * indlæses da under `c:`-stier, mens testfilernes `import 'vitest'` løses af Vite til `C:/…`. Node ser to
 * forskellige moduler, og der findes to mock-registre: den globale `vi`, som `clearMocks` rydder før hver
 * test, og den importerede, som testene bruger. Mock-kald lækkede derfor mellem tests, og tre testfiler
 * fejlede lokalt, mens de bestod i CI og fra PowerShell. Arbejdsmappen kan ikke rettes inde fra
 * konfigurationen, fordi CLI'en allerede er indlæst, når den læses – derfor en launcher.
 *
 * `src/test/setup.ts` fejler eksplicit, hvis Vitest alligevel startes med dubleret modulgraf.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const normalizeDrive = (value) => value.replace(/^[a-z](?=:)/, (drive) => drive.toUpperCase());

const projectRoot = normalizeDrive(join(dirname(fileURLToPath(import.meta.url)), '..'));
const vitestCli = normalizeDrive(
  join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs'),
);

const result = spawnSync(process.execPath, [vitestCli, ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
