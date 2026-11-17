import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

// VÆRN: formuleringer om sagens skade-/anmeldelsesdato findes kun ét sted.
//
// Udviklerens regel (2026-08-16, `TVAERGAAENDE.md` M-02): enhver brugervendt tekst om sagens dato følger den
// indtastede skadestype – «anmeld…» ved Erhvervssygdom, ellers «skade…». Reglen blev gennemført ét fund ad
// gangen (BB-072, BB-121 og senere), og hver gang dukkede en ny hardkodet «skadedato», «skadestidspunkt»
// eller «Skaden er sket» op et andet sted – i en etiket, et dokument, en kontroltabel, en fejlbesked.
//
// «skaden» om selve skaden («siden skaden», «hvis skaden ikke var sket») er bevidst ikke omfattet: arbejdsskade er
// fællesbetegnelsen for arbejdsulykker og erhvervssygdomme (udviklerafgørelse 2026-11-17). Kun ord, der står for
// sagens DATO, følger skadestypen.
//
// Derfor er formerne nu DATA i `resolveStamdataDatoReference` (`src/domain/policies/stamdataCalculations.ts`),
// og dette værn afviser dem som tekstliteraler i resten af `src/`. Mangler en form, tilføjes den dér.
//
// Værnet læser kun STRENGE, skabelon-tekst og JSX-tekst via TypeScripts AST – ikke kommentarer og ikke
// identifikatorer. Interne nøgler som `'skadedato'` (feltnavnet) eller `.foerSkadedato` (en issue-kode) er
// ikke prosa og springes over: de har hverken mellemrum, dansk bogstav eller stort begyndelsesbogstav.

const PROJECT_ROOT = resolve(process.cwd());
const SRC_ROOT = join(PROJECT_ROOT, 'src');

/** Den ene kilde, der må formulere datoen. */
const CANONICAL_SOURCE = 'src/domain/policies/stamdataCalculations.ts';

/**
 * Bevidste undtagelser – hver med sin begrundelse. En sti, der ender på `/`, dækker hele mappen; `text`
 * indsnævrer undtagelsen til de konkrete tekster, så resten af filen stadig er omfattet.
 * Tilføj kun her, når teksten IKKE er en formulering om den enkelte sags dato.
 */
const ALLOWED: ReadonlyArray<Readonly<{ path: string; text?: RegExp; reason: string }>> = [
  {
    path: 'src/data/kapitalisering/kapitaliseringsTabeller/',
    reason: 'Bekendtgørelsernes officielle titler («… for ulykker indtrådt og for erhvervssygdomme anmeldt …») gengives ordret.',
  },
  {
    path: 'src/components/pages/satser/SatserRateSections.tsx',
    text: /^Kapitalisering \(skade (?:fra|før) \d{1,2}\.\d{1,2}\.\d{4}\)$/u,
    reason: 'Satser er sagsuafhængig: overskriften navngiver lovens skæringsdato for kapitaliseringsfaktoren, ikke en sags dato.',
  },
  {
    path: 'src/document/generators/satser/satserDocument.ts',
    text: /^Kapitalisering \(skade (?:fra|før) \d{1,2}\.\d{1,2}\.\d{4}\)$/u,
    reason: 'Satser-dokumentets spejling af skærmens sagsuafhængige overskrift.',
  },
];

const LETTER_OR_DIGIT = String.raw`[\p{L}\p{N}_]`;
const word = (body: string): RegExp => new RegExp(`(?<!${LETTER_OR_DIGIT})(?:${body})(?!${LETTER_OR_DIGIT})`, 'iu');

/** Formerne, der kun må komme fra den kanoniske kilde. */
const FORBIDDEN_DATE_TERMS: ReadonlyArray<Readonly<{ name: string; pattern: RegExp }>> = [
  { name: 'datoens navn', pattern: word('skades?dato(?:en|er|erne|s)?|anmeldelsesdato(?:en|er|erne|s)?') },
  { name: 'tidspunktsform', pattern: word('skades?tidspunkt(?:et|s)?|anmeldelsestidspunkt(?:et|s)?') },
  { name: 'årsform', pattern: word('skades?år(?:et)?|anmeldelsesår(?:et)?') },
  { name: '«anmeldt»/«indtrådt»', pattern: word('anmeldt|indtrådt') },
  { name: 'skaden som tidsreference', pattern: word('(?:før|efter|fra) skaden') },
  { name: 'skaden som tidsreference', pattern: word('skaden er (?:sket|indtrådt|før|fra|efter)') },
  { name: 'skaden som tidsreference', pattern: word('skade (?:før|fra|efter)') },
];

/** Bøjede former, der ER prosa, selv når de står alene uden mellemrum (fx en tidligere `?? 'skadedatoen'`). */
const STANDALONE_PROSE_FORM = /^(?:skades?datoen|anmeldelsesdatoen|skades?tidspunkt(?:et)?|anmeldelsestidspunkt(?:et)?|anmeldt|indtrådt)$/iu;

/** Et internt navn: én ASCII-token med lille begyndelsesbogstav eller tegnsætning (`'skadedato'`, `':skadedato'`). */
const isInternalKey = (text: string): boolean =>
  /^[\x21-\x7e]+$/.test(text) && !/^[A-Z]/.test(text) && !STANDALONE_PROSE_FORM.test(text);

type TermFinding = Readonly<{ line: number; term: string; text: string }>;

/** Alle forbudte forekomster i tekstliteraler i én kildefil. */
const findDateTermsInSource = (content: string, fileName: string): readonly TermFinding[] => {
  const source = ts.createSourceFile(
    fileName, content, ts.ScriptTarget.Latest, true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const findings: TermFinding[] = [];

  const inspect = (node: ts.Node, text: string): void => {
    const trimmed = text.trim();
    if (trimmed === '' || isInternalKey(trimmed)) return;
    for (const { name, pattern } of FORBIDDEN_DATE_TERMS) {
      if (pattern.test(trimmed)) {
        findings.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, term: name, text: trimmed });
        return;
      }
    }
  };

  const isModuleSpecifier = (node: ts.Node): boolean =>
    ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isExternalModuleReference(node.parent);

  /** Interne invariantfejl (`new Error('…')`) er ikke brugervendt tekst. */
  const isErrorMessage = (node: ts.Node): boolean => {
    let current: ts.Node = node.parent;
    while (ts.isTemplateSpan(current) || ts.isTemplateExpression(current) || ts.isBinaryExpression(current)) {
      current = current.parent;
    }
    return ts.isNewExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === 'Error';
  };

  /** `notes`-felter er udviklerdokumentation (jf. undtagelsen for `dateRanges.ts`). */
  const isNotesProperty = (node: ts.Node): boolean =>
    ts.isPropertyAssignment(node.parent) && ts.isIdentifier(node.parent.name) && node.parent.name.text === 'notes';

  const visit = (node: ts.Node): void => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && !isModuleSpecifier(node) && !isErrorMessage(node) && !isNotesProperty(node)) {
      inspect(node, node.text);
    } else if (ts.isTemplateExpression(node) && !isErrorMessage(node)) {
      inspect(node.head, node.head.text);
      for (const span of node.templateSpans) inspect(span.literal, span.literal.text);
    } else if (ts.isJsxText(node)) {
      inspect(node, node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

const walk = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
  const path = join(directory, name);
  if (path === join(SRC_ROOT, '__tests__')) return [];
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const toRelative = (path: string): string => relative(PROJECT_ROOT, path).split(sep).join('/');

const matchesPath = (relativePath: string, path: string): boolean =>
  path.endsWith('/') ? relativePath.startsWith(path) : relativePath === path;

const isAllowed = (relativePath: string, text: string): boolean =>
  relativePath === CANONICAL_SOURCE
  || ALLOWED.some((entry) => matchesPath(relativePath, entry.path) && (entry.text === undefined || entry.text.test(text)));

const productionFiles = walk(SRC_ROOT)
  .filter((path) => extname(path) === '.ts' || extname(path) === '.tsx')
  .map((path) => ({ path, relativePath: toRelative(path) }));

describe('skadedatoTerminologyGuard', () => {
  it('har et levende scope, og den kanoniske kilde bærer alle formerne', () => {
    expect(productionFiles.length).toBeGreaterThan(500);
    const canonical = productionFiles.find((file) => file.relativePath === CANONICAL_SOURCE);
    expect(canonical, `${CANONICAL_SOURCE} findes ikke – værnet peger på en flyttet kilde`).toBeDefined();
    const canonicalFindings = findDateTermsInSource(readFileSync(canonical!.path, 'utf8'), canonical!.path);
    // Kilden SKAL rumme formerne; ellers er værnet grønt, fordi formerne er flyttet et andet sted hen.
    expect(new Set(canonicalFindings.map((finding) => finding.term)).size).toBeGreaterThanOrEqual(4);
  });

  it('hver undtagelse peger på en eksisterende sti og bærer en begrundelse', () => {
    for (const { path, reason } of ALLOWED) {
      expect(reason.trim().length, path).toBeGreaterThan(0);
      expect(productionFiles.some((file) => file.relativePath.startsWith(path)), `${path} findes ikke`).toBe(true);
    }
  });

  it('skelner prosa fra interne nøgler og kommentarer (selvtest)', () => {
    const violating = [
      "const a = 'Anciennitetstillæg efter skadedatoen';",
      "const b = 'Skadedato';",
      "const c = x ?? 'skadedatoen';",
      'const d = `Alder på skadestidspunkt ${x}`;',
      "const e = 'Regulering fra skadesår 2020';",
      "const f = 'Skaden er sket før 1. juli 2024.';",
      "const g = 'Da skaden er før 1/1-2011';",
      "const h = 'lønoplysninger før skaden.';",
      "const i = `TAF ophører (skade før ${d})`;",
      "const j = `Erhvervssygdom ${'anmeldt'} den`;",
      'const k = <p>Skaden er indtrådt før 16. juni 2011.</p>;',
    ];
    for (const code of violating) {
      expect(findDateTermsInSource(code, 'fixture.tsx'), code).not.toHaveLength(0);
    }
    const clean = [
      "const a = values.skadedato;",
      "const b = { kind: 'skadedato' };",
      "const c = `${id}:skadedato`;",
      "const d = `${field.descriptor.id}.foerSkadedato`;",
      "// Skaden er sket før 2011 – en kommentar er ikke brugervendt",
      "const e = 'Feriepenge, hvis skaden ikke var sket (+ AG-pension)';",
      "const f = 'samtlige TAF-perioder siden skaden';",
      "throw new Error(`Kapitaliseringsinterval for skadedato ${x}`);",
      "const g = { notes: 'Valideres mod dynamisk min-værdi (skadedato)' };",
      "import { x } from './skadedatoAnmeldt';",
    ];
    for (const code of clean) {
      expect(findDateTermsInSource(code, 'fixture.tsx'), code).toEqual([]);
    }
  });

  it('ingen tekst uden for den kanoniske kilde formulerer sagens dato selv', () => {
    const violations = productionFiles.flatMap((file) => findDateTermsInSource(readFileSync(file.path, 'utf8'), file.path)
      .filter((finding) => !isAllowed(file.relativePath, finding.text))
      .map((finding) => `${file.relativePath}:${finding.line} (${finding.term}): ${finding.text}`));

    expect(
      violations,
      'Tekst om sagens skade-/anmeldelsesdato skal hentes fra resolveStamdataDatoReference '
      + `(${CANONICAL_SOURCE}), så den følger skadestypen. Mangler en form, tilføjes den dér.`,
    ).toEqual([]);
  });
});
