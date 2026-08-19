/**
 * `docs/implementation/` må kun rumme planer for arbejde, der IKKE er udført.
 *
 * **Hvorfor værnet findes.** Mappens regel står i dens `README.md`, men en regel, ingen kontrol måler, er
 * en hensigt. Begge fejlretninger er sket i praksis:
 *
 *   - En plan blev **slettet, mens den var uindfriet**: dokumentationsoprydningen `83b1de11` (2026-07-31)
 *     fjernede hele mappen, fordi den var fuld af planer for afsluttet arbejde. `autofill-suggest.md`,
 *     hvis arbejde aldrig var begyndt, gik med i faldet og måtte gendannes 2026-08-14.
 *   - En plan blev **liggende, længe efter den var indfriet**: `docs/plan-opdateringsmodel.md` stod med
 *     `Status: IMPLEMENTERET` og duplikerede `app-shell-contract.md` §2.7–2.8, indtil den blev opdaget
 *     ved en tilfældig gennemgang.
 *
 * Statuslinjen er det ene signal, der adskiller de to tilstande, og den er derfor håndhævet her. En plan,
 * der erklærer sig implementeret, er udtjent: dens varige indhold hører i en kontrakt eller i
 * `docs/architecture/`, og filen skal slettes.
 *
 * **Hvad værnet IKKE kan.** Reglen om, at planer ikke må ligge løst i `docs/`-roden, måles på filnavnet
 * (`plan-*.md`). En plan, der navngives uden præfikset, slipper igennem. Det er bevidst det svageste
 * kriterium, der fanger den fejl, vi faktisk har set (`plan-opdateringsmodel.md`, `plan-ui-skalering.md`),
 * frem for en prosaparser, der skulle gætte et dokuments genre – og repoet har allerede lært, at dansk
 * prosa bryder markørbaserede værn.
 *
 * Mappen kan legitimt være tom, når alt planlagt arbejde er udført og absorberet. Derfor hævder de
 * fixture-baserede tests reglen uafhængigt af mappens indhold: mønsteret bevises levende, også når der
 * ikke er nogen plan at måle på.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(process.cwd());
const planDirectory = join(repoRoot, 'docs', 'implementation');
const docsRoot = join(repoRoot, 'docs');

/** Statuslinjen skal stå tæt på titlen, hvor den læses – ikke begravet i et afsnit langt nede. */
const STATUS_SEARCH_LINES = 10;
const OPEN_STATUS_PATTERN = /^Status: \*\*(PLANLAGT|UDSKUDT)\*\*/m;
const CLOSED_STATUS_PATTERN = /^Status: \*\*IMPLEMENTERET\*\*/m;

const planFileNames = (): readonly string[] =>
  readdirSync(planDirectory)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();

const leadingLines = (content: string): string =>
  content.split(/\r?\n/).slice(0, STATUS_SEARCH_LINES).join('\n');

const readPlan = (fileName: string): string => readFileSync(join(planDirectory, fileName), 'utf8');

describe('docs/implementation-mappen', () => {
  it('har en README, der bærer mappens regel', () => {
    expect(readdirSync(planDirectory)).toContain('README.md');
  });

  it('giver hver plan en åben statuslinje tæt på titlen', () => {
    const withoutOpenStatus = planFileNames().filter(
      (fileName) => !OPEN_STATUS_PATTERN.test(leadingLines(readPlan(fileName)))
    );

    expect(
      withoutOpenStatus,
      'En plan i docs/implementation/ skal bære «Status: **PLANLAGT**» eller «Status: **UDSKUDT**» '
        + `inden for de første ${STATUS_SEARCH_LINES} linjer – ellers kan en oprydning ikke se, om `
        + 'arbejdet er udført. Er planen indfriet, skal dens varige indhold absorberes i en kontrakt '
        + 'eller docs/architecture/, og filen slettes.'
    ).toEqual([]);
  });

  it('rummer ingen plan, der erklærer sig implementeret', () => {
    const implemented = planFileNames().filter((fileName) =>
      CLOSED_STATUS_PATTERN.test(readPlan(fileName))
    );

    expect(
      implemented,
      'En implementeret plan er udtjent og må ikke blive liggende: flyt invarianter, forkastede '
        + 'alternativer og bevidste konsekvenser til den relevante kontrakt i src/contracts/ eller til '
        + 'docs/architecture/, og slet planfilen.'
    ).toEqual([]);
  });

  it('har ingen plan liggende løst i docs-roden', () => {
    const loosePlans = readdirSync(docsRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^plan-.*\.md$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();

    expect(
      loosePlans,
      'Implementeringsplaner hører i docs/implementation/, hvor statuskravet håndhæves. '
        + 'docs/-roden er til stående dokumenter (arbejdsliste, faste arbejdsinstrukser).'
    ).toEqual([]);
  });
});

/**
 * Selv-test af mønsteret: uden den ville de tre kontroller ovenfor være grønne, hvis regexerne holdt op
 * med at matche noget som helst – netop den «grøn af tomhed», mappen selv er et eksempel på.
 */
describe('statusmønsteret', () => {
  it('afviser en plan uden statuslinje', () => {
    const plan = '# Implementeringsplan: noget\n\nEn plan uden status.\n';
    expect(OPEN_STATUS_PATTERN.test(leadingLines(plan))).toBe(false);
  });

  it('afviser en statuslinje, der står for langt nede', () => {
    const plan = `# Titel\n${'\n'.repeat(STATUS_SEARCH_LINES + 2)}Status: **PLANLAGT**\n`;
    expect(OPEN_STATUS_PATTERN.test(leadingLines(plan))).toBe(false);
    expect(OPEN_STATUS_PATTERN.test(plan)).toBe(true);
  });

  it('genkender begge åbne statusværdier og fanger den implementerede', () => {
    expect(OPEN_STATUS_PATTERN.test('Status: **PLANLAGT** 2026-08-14. Brugerbeslutning foreligger.')).toBe(true);
    expect(OPEN_STATUS_PATTERN.test('Status: **UDSKUDT** – afventer satsdata.')).toBe(true);
    expect(CLOSED_STATUS_PATTERN.test('Status: **IMPLEMENTERET** 2026-08-12, efter review.')).toBe(true);
    expect(OPEN_STATUS_PATTERN.test('Status: **IMPLEMENTERET** 2026-08-12, efter review.')).toBe(false);
  });
});
