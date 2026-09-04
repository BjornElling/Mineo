#!/usr/bin/env node
/**
 * Kører `npm audit` mod det låste afhængighedstræ og fejler, hvis der findes sårbarheder
 * på niveau moderate eller derover.
 *
 * Baggrund: `npm audit` slår advisories op over netværket hos npm-registret, og registret
 * svarer med jævne mellemrum 503. Kaldt direkte i release-gaten kan kommandoen derfor vælte
 * hele `verify:release:core` uden at der er noget galt med projektet – præcis det skete
 * 2026-09-04, hvor «503 Service Unavailable ... /security/advisories/bulk» stoppede kørslen
 * i det allerførste trin.
 *
 * Kontrollen skelner derfor mellem to udfald, som `npm audit`s exitkode blander sammen:
 *   1. Registret svarede, og der ER sårbarheder → gaten fejler (det er kontrollens formål).
 *   2. Registret svarede ikke (503/timeout/DNS) → gaten fortsætter med en advarsel, efter
 *      at forsøget er gentaget nogle gange med voksende ventetid.
 *
 * Udfald 2 er bevidst ikke en fejl: en utilgængelig tredjepartstjeneste er ikke et udsagn om
 * koden, og et rødt træ dér lærer ingen noget. Advarslen står i loggen, så en kørsel uden
 * gennemført opslag kan ses som netop det.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Laveste alvorlighed der skal vælte gaten. Samme niveau som det tidligere direkte kald. */
const AUDIT_LEVEL = 'moderate';

/** Antal forsøg i alt, og ventetiden mellem dem. Kort nok til ikke at hænge en CI-kørsel. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [2_000, 8_000];

/**
 * Kendetegn på at svaret kom fra et registret, der ikke kunne svare – ikke fra et opslag,
 * der fandt sårbarheder. `npm audit` udskriver dem på stderr og bruger samme exitkode 1 som
 * ved fund, så teksten er det eneste, der adskiller de to.
 */
const REGISTRY_FAILURE_PATTERNS = [
  /audit endpoint returned an error/i,
  /\b(?:429|500|502|503|504)\b/,
  /service unavailable/i,
  /internal server error/i,
  /gateway time-?out/i,
  /bad gateway/i,
  /too many requests/i,
  /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|ENETUNREACH|UNABLE_TO_(?:GET_ISSUER_CERT|VERIFY_LEAF_SIGNATURE)/,
  /network|socket hang up|request to .* failed/i,
];

const isRegistryFailure = (output) => REGISTRY_FAILURE_PATTERNS.some((pattern) => pattern.test(output));

const sleep = (milliseconds) => {
  // Synkron pause: kontrollen er et enkelt sekventielt trin i gaten, så der er intet at vente på imens.
  const until = Date.now() + milliseconds;
  while (Date.now() < until) {
    // Atomics.wait kræver en delt buffer; en simpel løkke er nok til de få sekunder her.
  }
};

const runAudit = (repoRoot) => {
  // På Windows er `npm` en batch-fil, som Node nægter at spawne uden shell (EINVAL), mens
  // `shell: true` med et args-ARRAY konkatenerer argumenterne uescapet (DEP0190). Begge undgås
  // ved at give shellen én færdig kommandostreng: der er ingen dynamiske argumenter at escape,
  // da niveauet er en konstant her i filen.
  const result = spawnSync(`npm audit --audit-level=${AUDIT_LEVEL}`, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: true,
  });
  // En spawn-fejl er ikke et audit-svar. Blev den behandlet som stderr, ville «EINVAL» ryge
  // gennem mønstrene nedenfor og blive meldt som et sårbarhedsfund – en fejl der ikke findes.
  if (result.error !== undefined) {
    return { status: null, spawnFailed: true, output: String(result.error.message ?? result.error) };
  }
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
};

const checkVulnerabilities = (repoRoot, { audit = runAudit } = {}) => {
  let last = { status: null, output: '' };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    last = audit(repoRoot);
    if (last.status === 0) return { outcome: 'clean', output: last.output };
    // Kunne kommandoen slet ikke startes, er der intet audit-svar at tolke – hverken et fund
    // eller et tavst register. Det er en fejl i miljøet, og den skal meldes som sig selv.
    if (last.spawnFailed === true) return { outcome: 'audit-unrunnable', output: last.output };
    if (!isRegistryFailure(last.output)) return { outcome: 'vulnerable', output: last.output };
    if (attempt < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1) ?? 0;
      console.warn(
        `check:vulnerabilities – npm-registret kunne ikke svare (forsøg ${attempt} af ${MAX_ATTEMPTS}); `
        + `prøver igen om ${Math.round(delay / 1000)} s.`,
      );
      sleep(delay);
    }
  }
  return { outcome: 'registry-unavailable', output: last.output };
};

const getRepoRoot = () => {
  const repoFlagIndex = process.argv.indexOf('--repo');
  return repoFlagIndex === -1 ? defaultRepoRoot : resolve(process.argv[repoFlagIndex + 1] ?? '');
};

const main = () => {
  const { outcome, output } = checkVulnerabilities(getRepoRoot());

  if (outcome === 'vulnerable') {
    console.error(output.trimEnd());
    console.error(
      `\nnpm audit fandt sårbarheder på niveau ${AUDIT_LEVEL} eller derover.`
      + '\nRet dem med `npm audit fix`, eller hæv den pinnede version af den ramte pakke.\n',
    );
    process.exitCode = 1;
    return;
  }

  if (outcome === 'audit-unrunnable') {
    console.error(output.trimEnd());
    console.error(
      '\ncheck:vulnerabilities – `npm audit` kunne slet ikke startes, så der findes intet svar at tolke.'
      + '\nDet er en fejl i miljøet, ikke i afhængighedstræet; kontrollér at npm er på PATH.\n',
    );
    process.exitCode = 1;
    return;
  }

  if (outcome === 'registry-unavailable') {
    console.warn(output.trimEnd());
    console.warn(
      `\ncheck:vulnerabilities – npm-registret svarede ikke efter ${MAX_ATTEMPTS} forsøg, så `
      + 'sårbarhederne er IKKE kontrolleret i denne kørsel.'
      + '\nDet er en utilgængelig tredjepartstjeneste, ikke et fund i projektet; gaten fortsætter.\n',
    );
    return;
  }

  console.log(`check:vulnerabilities – npm audit fandt ingen sårbarheder på niveau ${AUDIT_LEVEL} eller derover.`);
};

const isMain = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`\nKontrollen af sårbarheder kunne ikke gennemføres: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

export { checkVulnerabilities, isRegistryFailure };
