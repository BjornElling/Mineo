/**
 * Aktive testnavne beskriver INVARIANTEN, ikke omlægningen.
 *
 * Testoutput er dokumentation. Et navn som `describe('Årsløn (greenfield) – migreret side …')` fortæller
 * en læser om en REJSE, der er afsluttet, i stedet for om den regel, testen beskytter – og den værste
 * konsekvens er ikke kosmetisk: det bliver umuligt at se, om en test beskytter slutproduktet eller en
 * afløst mekanisme, og dermed om den kan slettes.
 *
 * Sweepen bag denne regel fandt 41 aktive deklarationer med migrationssprog. 26 blev omskrevet til
 * invariantnavne; de resterende er ægte undtagelser, som er navngivet eksplicit nedenfor med hver sin
 * begrundelse. Værnet gør listen til en LUKKET mængde: en ny test med migrationssprog fejler her, og en
 * undtagelse skal begrundes frem for at kunne glide ind.
 *
 * **Hvorfor en test og ikke en AST-regel i arkitekturharnesset:** harnessets kilde-graf udelukker
 * bevidst `src/__tests__/**` (den måler produktionskode). Reglen hører derfor her, men den bruger den
 * SAMME AST-parser som acceptregistret (`./testDeclarations`) – ikke en regex over råteksten. Det er
 * afgørende, fordi et linjefilter hverken kan se arvet `describe.skip` eller skelne kode fra kommentar
 * ([[project_structural_questions_need_ast]]).
 */
import fs from 'node:fs';
import path from 'node:path';
import { activeDeclarations } from './testDeclarations';

const TEST_ROOT = 'src/__tests__';

/**
 * Ordene, der beskriver omlægningen frem for en invariant.
 *
 * `legacy` er IKKE på listen. Ordet har en levende, korrekt betydning i Mineo: `.eo`-filer og
 * persisterede sessioner fra ældre programversioner er reelt legacy-formater, som load-stien
 * TOLERERER med vilje, og fraværsværn navngiver med vilje de slettede legacy-symboler. Et forbud
 * ville have tvunget en omskrivning af sande navne – og et værn, hvis undtagelsesliste bliver længere
 * end dens fund, måler ikke længere noget.
 */
const MIGRATION_TERMS: readonly RegExp[] = [
  /greenfield/i,
  /\bfase\s*\d/i,
  /\bWI-\d/,
  /\bmigration\b/i,
  /\bmigrering\b/i,
  /\bmigreret\b/i,
  // Sags-id'er fra lukkede arbejdsforløb: fund-id'er på formen «bogstaver-F<tal>», observations- og
  // brugerfund-numre. Et testnavn er dokumentation, og et navn, der kun kan slås op i et dokument,
  // som ikke findes, fortæller ingenting om invarianten. Testens EMNE skal stå i navnet – ikke den
  // sag, den engang blev oprettet under.
  /\b[A-Z][A-Z0-9]*-F\d+\b/,
  /\bOBS-\d+\b/,
  /\bBF-\d+\b/,
  /\bacceptmatrix\b/i,
];

/**
 * De begrundede undtagelser, som en NØJAGTIG navnetekst.
 *
 * Formen er bevidst eksakt og ikke et mønster: en `startsWith`- eller regex-undtagelse ville også
 * fritage fremtidige navne, som ingen har vurderet. Hver post er én besluttet undtagelse.
 */
const ALLOWED: readonly Readonly<{ name: string; why: string }>[] = [
  {
    name: 'EET MoneyOre-migration karakterisering',
    why: 'MoneyOre-migrationen er en ægte, navngivet DATAOMLÆGNING af afrundingsgrænser – suiten låser '
      + 'de grænser, omlægningen skal bevare. Navnet beskriver dermed sit emne, ikke et faseforløb.',
  },
  {
    name: 'låser alle EET-afrundingsgrænser som MoneyOre-migrationen skal bevare',
    why: 'Samme som ovenfor: karakteriseringens emne ER migrationen.',
  },
  {
    name: 'kører den eksakte sektionsmigration fra kildeversion til current-version',
    why: '`.eo`-/sektionsmigrationen er en LEVENDE mekanisme (`migratePersistedSectionValue`), ikke et '
      + 'afsluttet faseforløb. Ordet er det korrekte navn på det, der testes.',
  },
];

const ALLOWED_NAMES = new Set(ALLOWED.map((entry) => entry.name));

const collectTestFiles = (dir: string, out: string[] = []): string[] => {
  for (const name of fs.readdirSync(path.resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (fs.statSync(path.resolve(process.cwd(), rel)).isDirectory()) collectTestFiles(rel, out);
    else if (/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
};

const files = collectTestFiles(TEST_ROOT);
const declarationsByFile = new Map(
  files.map((file) => [
    file,
    activeDeclarations(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'), file),
  ] as const)
);

describe('aktive testnavne beskriver invarianten, ikke omlægningen', () => {
  it('testfladen findes – værnet kan ikke være grønt af tomhed', () => {
    // Uden gulvet ville en flyttet eller omdøbt testrod gøre hele reglen tavs grøn.
    expect(files.length, `ingen testfiler fundet under ${TEST_ROOT}`).toBeGreaterThan(400);
  });

  // Testnavnet undgår med vilje selv de forbudte ord: reglen scanner ALLE testfiler, inklusive sin egen,
  // og en filundtagelse for netop denne fil ville være det ene sted, hvor en rigtig overtrædelse kunne
  // gemme sig. At reglen fangede sin egen første formulering er i øvrigt det bedste bevis på, at den virker.
  it('ingen aktiv deklaration navngiver et afsluttet omlægningsforløb', () => {
    const findings: string[] = [];

    for (const file of files) {
      for (const declaration of declarationsByFile.get(file) ?? []) {
        if (ALLOWED_NAMES.has(declaration.name)) continue;
        const term = MIGRATION_TERMS.find((pattern) => pattern.test(declaration.name));
        if (term === undefined) continue;
        findings.push(
          `${file}:${declaration.line}  ${declaration.isLeaf ? 'it' : 'describe'}('${declaration.name}')`
          + `  – rammer ${term.source}`
        );
      }
    }

    expect(
      findings,
      'Aktive testnavne beskriver omlægningen frem for invarianten. Omskriv navnet til den regel, testen '
      + 'beskytter – eller tilføj en begrundet post i ALLOWED, hvis migrationsordet ER emnet:\n'
      + findings.join('\n')
    ).toEqual([]);
  });

  /**
   * Anti-rot i den anden retning. En undtagelse for et navn, der ikke længere findes, er en
   * dokumenteret fritagelse for ingenting – og den ville skjule, at listen er blevet forældet.
   * Præcis samme fejlklasse som en liveness-probe, hvis mål er slettet.
   */
  it('hver undtagelse svarer til en aktiv deklaration, der faktisk findes', () => {
    const live = new Set<string>();
    for (const file of files) {
      for (const declaration of declarationsByFile.get(file) ?? []) live.add(declaration.name);
    }

    const dead = ALLOWED.filter((entry) => !live.has(entry.name)).map((entry) => entry.name);
    expect(dead, 'undtagelser uden en levende deklaration – fjern dem').toEqual([]);
  });

  it('hver undtagelse har en begrundelse', () => {
    for (const entry of ALLOWED) {
      expect(entry.why.trim(), `undtagelsen '${entry.name}' mangler en begrundelse`).not.toBe('');
    }
  });
});
