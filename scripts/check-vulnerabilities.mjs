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

/**
 * Advisories, som udgiveren har TRUKKET TILBAGE, men som npm-registrets audit-database endnu melder.
 *
 * Kun en tilbagetrukket advisory hører her – aldrig en ægte sårbarhed, der blot er ubelejlig. Hver post bærer
 * sin begrundelse og kilden, der kan efterprøves. Fjern posten, når `npm audit` ikke længere melder den; så
 * længe den står her, skrives det i loggen ved hver kørsel, hvor den faktisk blev sorteret fra.
 */
const WITHDRAWN_ADVISORIES = new Map([
  [
    'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
    'picomatch ReDoS (<= 4.0.7) – trukket tilbage af GitHub 2026-11-18 («Withdrawn Advisory»); ingen rettet '
      + 'version findes, så npm audit kan ikke løse den. Kilde: https://api.github.com/advisories/GHSA-fc5q-39xc-vjpf',
  ],
]);

/** De advisories, `npm audit --json` bygger sine fund på. Transitive poster peger kun på andre pakker. */
const collectAdvisories = (auditJson) => {
  const advisories = new Map();
  for (const vulnerability of Object.values(auditJson?.vulnerabilities ?? {})) {
    for (const via of vulnerability?.via ?? []) {
      if (typeof via === 'object' && via !== null && typeof via.url === 'string') {
        advisories.set(via.url, { url: via.url, severity: via.severity, title: via.title });
      }
    }
  }
  return [...advisories.values()];
};

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

/**
 * Afgør, om ET FUND kun består af tilbagetrukne advisories. Fail-closed: kan JSON-svaret ikke læses, eller
 * findes ingen advisory at pege på, er fundet stadig et fund.
 */
const classifyFinding = (jsonOutput) => {
  let parsed;
  try {
    parsed = JSON.parse(jsonOutput);
  } catch {
    return { onlyWithdrawn: false, ignored: [] };
  }
  const relevant = collectAdvisories(parsed)
    .filter((advisory) => (SEVERITY_RANK[advisory.severity] ?? SEVERITY_RANK.critical) >= SEVERITY_RANK[AUDIT_LEVEL]);
  const remaining = relevant.filter((advisory) => !WITHDRAWN_ADVISORIES.has(advisory.url));
  const ignored = relevant.filter((advisory) => WITHDRAWN_ADVISORIES.has(advisory.url));
  return { onlyWithdrawn: relevant.length > 0 && remaining.length === 0, ignored };
};

const runAuditJson = (repoRoot) => {
  const result = spawnSync('npm audit --json', { cwd: repoRoot, encoding: 'utf8', shell: true });
  return result.error === undefined ? (result.stdout ?? '') : '';
};

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

// `sleep` er injicerbar, så testene af gentagelsen ikke selv venter 10 s i en busy-loop og blokerer en worker.
const checkVulnerabilities = (
  repoRoot,
  { audit = runAudit, auditJson = runAuditJson, sleep: pause = sleep } = {},
) => {
  let last = { status: null, output: '' };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    last = audit(repoRoot);
    if (last.status === 0) return { outcome: 'clean', output: last.output };
    // Kunne kommandoen slet ikke startes, er der intet audit-svar at tolke – hverken et fund
    // eller et tavst register. Det er en fejl i miljøet, og den skal meldes som sig selv.
    if (last.spawnFailed === true) return { outcome: 'audit-unrunnable', output: last.output };
    if (!isRegistryFailure(last.output)) {
      const { onlyWithdrawn, ignored } = classifyFinding(auditJson(repoRoot));
      return onlyWithdrawn
        ? { outcome: 'clean-except-withdrawn', output: last.output, ignored }
        : { outcome: 'vulnerable', output: last.output };
    }
    if (attempt < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS.at(-1) ?? 0;
      console.warn(
        `check:vulnerabilities – npm-registret kunne ikke svare (forsøg ${attempt} af ${MAX_ATTEMPTS}); `
        + `prøver igen om ${Math.round(delay / 1000)} s.`,
      );
      pause(delay);
    }
  }
  return { outcome: 'registry-unavailable', output: last.output };
};

const getRepoRoot = () => {
  const repoFlagIndex = process.argv.indexOf('--repo');
  return repoFlagIndex === -1 ? defaultRepoRoot : resolve(process.argv[repoFlagIndex + 1] ?? '');
};

const main = () => {
  const { outcome, output, ignored } = checkVulnerabilities(getRepoRoot());

  if (outcome === 'clean-except-withdrawn') {
    console.warn(
      'check:vulnerabilities – npm audit melder kun advisories, som udgiveren har trukket tilbage:\n'
      + (ignored ?? []).map((advisory) => `  - ${advisory.url}: ${WITHDRAWN_ADVISORIES.get(advisory.url)}`).join('\n')
      + '\nGaten fortsætter. Fjern posten i WITHDRAWN_ADVISORIES, når npm audit ikke længere melder den.',
    );
    return;
  }

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

export { checkVulnerabilities, classifyFinding, isRegistryFailure };
