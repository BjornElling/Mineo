/**
 * Fælles opstart for agentværktøjerne i `.agents/tools`.
 *
 * Kommandonavnet slås op i pakkens egen `bin`, så en omdøbt indgangsfil i en ny udgave af
 * værktøjet ikke stille brækker launcheren; den fejler i stedet med en læsbar besked.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

/**
 * @param {string} packageName Pakken der leverer værktøjet, fx `@playwright/cli`.
 * @param {string} commandName Kommandoen i pakkens `bin`-kort, fx `playwright-cli`.
 */
export async function launchAgentTool(packageName, commandName) {
  let manifestPath;
  try {
    manifestPath = require.resolve(`${packageName}/package.json`);
  } catch {
    process.stderr.write(
      `${packageName} er ikke installeret i .agents/tools. Kør \`npm run tools:install\` fra repo-roden.\n`
    );
    process.exitCode = 1;
    return;
  }

  const binaries = require(manifestPath).bin;
  const entry = typeof binaries === 'string' ? binaries : binaries?.[commandName];
  if (typeof entry !== 'string') {
    process.stderr.write(`${packageName} deklarerer ingen kommando ved navn ${commandName}.\n`);
    process.exitCode = 1;
    return;
  }

  await import(pathToFileURL(join(dirname(manifestPath), entry)).href);
}
