#!/usr/bin/env node
/**
 * Kontrollerer, at kontrakternes `**Senest verificeret mod kode:**`-stempel faktisk BETYDER noget.
 *
 * **Hullet, dette lukker.** `contractCoverageMatrix.test.ts` håndhæver feltet – men kun dets FORMAT: en
 * regex kræver `YYYY-MM-DD`, og intet mere. Datoens indhold kontrolleres ikke. En kontrakt kan derfor
 * bære et friskt stempel og en forældet beskrivelse, og hele suiten står grøn. `contract-topology-procedure.md`
 * kalder feltet det ene håndhævede krav i skabelonen, så stemplet bærer i praksis hele vægten af påstanden
 * «kontrakten er stadig sand» – uden at nogen kontrol kan se, om den er indfriet.
 *
 * **Det var ikke teoretisk.** Ved gennemgangen 2026-08-07 havde SEKS kontrakter et stempel, der lå FØR deres
 * egen seneste redigering: `amount-contract.md`, `app-shell-contract.md`, `auth-gate-contract.md`,
 * `error-contract.md`, `form-contract.md` og `periodisering-contract.md`. `auth-gate-contract.md` er det
 * tydeligste tilfælde: stemplet sagde 2026-07-28, mens filen selv blev ændret 2026-08-01. Nogen havde altså
 * redigeret kontraktens tekst uden at forny påstanden om, at teksten er sand – og feltets eneste kontrol
 * kunne per konstruktion ikke se det. Dertil delte 14 filer ét og samme bulk-stempel (2026-08-01), hvilket
 * er signaturen på en dato, der sættes som ritual frem for efter en reel verifikation.
 *
 * **Reglen.** Stemplet må ikke være ældre end den seneste commit, der ændrede kontraktfilen. Det er den
 * svageste regel, der fanger fejlen – og bevidst svagere end «stemplet skal være friskt»: en kontrakt, som
 * ingen har rørt i et halvt år, er ikke af den grund forældet, og en tidsbaseret udløbsdato ville producere
 * rød farve uden ny information og dermed lære læseren at rulle forbi.
 *
 * Reglen har en præcis betydning ved commit: ændrer man en kontrakt, opdaterer man dens stempel i SAMME
 * commit. Det er netop det øjeblik, hvor man har haft kontrakten og koden åben samtidig, og hvor påstanden
 * derfor kan bæres.
 *
 * **Hvorfor et script og ikke en vitest-test.** Kontrollen har brug for git-historik. Vitest-suiten skal kunne
 * køre på et træ uden `.git` (fx et udpakket arkiv), og en test, der stiltiende sprang over sit eget mål dér,
 * ville være grøn af tomhed. Som script kan fraværet af git rapporteres eksplicit som «ikke målt» i stedet
 * for at blive maskeret som «bestået».
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const contractsDir = join(repoRoot, 'src', 'contracts');

/** Skabelonen bruger en `YYYY-MM-DD`-placeholder, ikke en reel dato. */
const EXEMPT = new Set(['contract-template.md']);

const STAMP_PATTERN = /\*\*Senest verificeret mod kode:\*\*\s*(\d{4}-\d{2}-\d{2})/;
const STAGED_MODE = process.argv.slice(2).includes('--staged');

if (process.argv.slice(2).some((argument) => argument !== '--staged')) {
  console.error('check:contract-verification: ukendt argument. Kun --staged understøttes.');
  process.exit(1);
}

const contractFiles = () =>
  readdirSync(contractsDir)
    .filter((name) => name.endsWith('.md') && !EXEMPT.has(name))
    .sort();

const stagedContractPaths = () => execFileSync(
  'git',
  ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR', '--', 'src/contracts'],
  { cwd: repoRoot }
).toString('utf8')
  .split('\0')
  .filter((relativePath) => relativePath.endsWith('.md') && !EXEMPT.has(relativePath.slice('src/contracts/'.length)))
  .sort();

const readStagedContract = (relativePath) => execFileSync(
  'git',
  ['show', `:${relativePath}`],
  { cwd: repoRoot, encoding: 'utf8' }
);

const today = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Datoen for den seneste commit, der ændrede filen – i commit-datoens egen tidszone, så en dag ikke
 * forskydes af, hvor kontrollen tilfældigvis kører.
 */
const lastCommitDate = (relativePath) => {
  const output = execFileSync(
    'git',
    ['log', '-1', '--format=%ad', '--date=format:%Y-%m-%d', '--', relativePath],
    { cwd: repoRoot, encoding: 'utf8' }
  ).trim();
  return output === '' ? null : output;
};

const hasGitHistory = () => {
  if (!existsSync(join(repoRoot, '.git'))) return false;
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const collectStagedProblems = () => {
  const expectedStamp = today();
  const problems = [];

  for (const relativePath of stagedContractPaths()) {
    const match = readStagedContract(relativePath).match(STAMP_PATTERN);
    if (match === null) {
      problems.push(`${relativePath}: mangler et "**Senest verificeret mod kode:** YYYY-MM-DD"-felt.`);
      continue;
    }

    if (match[1] !== expectedStamp) {
      problems.push(
        `${relativePath}: stemplet er ${match[1]}, men en ændret kontrakt skal verificeres og stemples ${expectedStamp} før commit.`
      );
    }
  }

  return problems;
};

const collectHistoricalProblems = () => {
  const problems = [];
  const files = contractFiles();

  if (files.length === 0) {
    console.error('check:contract-verification: fandt ingen kontraktfiler – kontrollen ville være tom.');
    process.exit(1);
  }

  for (const fileName of files) {
    const relativePath = `src/contracts/${fileName}`;
    const content = readFileSync(join(contractsDir, fileName), 'utf8');
    const match = content.match(STAMP_PATTERN);

    if (match === null) {
      // Formatkravet ejes af `contractCoverageMatrix.test.ts`; her rapporteres det kun, fordi
      // staleness-reglen ikke kan vurderes uden et stempel.
      problems.push(`${relativePath}: mangler et "**Senest verificeret mod kode:** YYYY-MM-DD"-felt.`);
      continue;
    }

    const stamped = match[1];
    const edited = lastCommitDate(relativePath);
    // En ucommittet ny kontrakt har ingen historik endnu; den kan først måles ved næste commit.
    if (edited === null) continue;

    if (stamped < edited) {
      problems.push(
        `${relativePath}: stemplet er ${stamped}, men filen blev senest ændret ${edited}.\n`
          + '    Kontrakten er redigeret, uden at påstanden "verificeret mod kode" blev fornyet.\n'
          + '    Verificér afsnittet mod koden og sæt stemplet til redigeringsdatoen i SAMME commit.'
      );
    }
  }

  return problems;
};

const main = () => {
  if (!hasGitHistory()) {
    // Eksplicit «ikke målt» frem for et tavst grønt udfald: uden historik kan kontrollen ikke svare,
    // og et grønt svar ville da bære en påstand, ingen har efterprøvet.
    console.error('check:contract-verification: ingen git-historik tilgængelig – kontrollen kunne IKKE køres.');
    process.exit(1);
  }

  const problems = STAGED_MODE ? collectStagedProblems() : collectHistoricalProblems();

  if (problems.length > 0) {
    const context = STAGED_MODE ? 'staged kontrakt(er) med et ikke-opdateret verifikationsstempel' : 'kontrakt(er) med et forældet verifikationsstempel';
    console.error(`check:contract-verification: ${problems.length} ${context}:\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      '\nStemplet er skabelonens ENESTE håndhævede felt og bærer derfor hele påstanden om, at kontrakten\n'
        + 'stadig er sand. Et stempel, der er ældre end teksten, er en påstand, ingen har indfriet.'
    );
    process.exit(1);
  }

  if (STAGED_MODE) {
    console.log('check:contract-verification: alle ændrede kontrakter er stemplet med dagens dato.');
    return;
  }

  console.log(`check:contract-verification: ${contractFiles().length} kontrakter har et stempel, der ikke er ældre end deres seneste ændring.`);
};

main();
