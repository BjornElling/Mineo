import ts from 'typescript';
import {
  ARCHITECTURE_RULES,
  CATALOG_DIR,
  DESCRIPTOR_CATALOG_MODULE_NAMES,
  LEGACY_MODULE_PATH_SELFTEST,
  NON_DOMAIN_CATALOG_MODULES,
} from './architectureRules';
import { getSourceGraph } from './sourceGraph';

/**
 * Fraværsreglernes modstykke (Fase 6, WI-012 pass 1).
 *
 * En forbudsregel kan ikke bevise sin egen relevans ved at ramme noget: nul hits ER den ønskede
 * tilstand. Det efterlader et hul, som `architectureRules.test.ts`' fixture-selvtest ikke kan lukke —
 * reglen består sine fixtures, uanset om det, den forbyder, faktisk er væk, og uanset om navnet er
 * stavet rigtigt. En regel, der forbyder `useRowDraftz`, ville se lige så grøn ud som en, der forbyder
 * `useRowDrafts`, mens den rigtige fil levede videre ved siden af.
 *
 * Denne fil er den omvendte kontrol, planens Fase 6 trin 1 reelt beder om: for hvert forbudt
 * modul/navn, BEVIS at det er fraværende i den levende kilde-graf. Det er samtidig den maskinelle
 * erstatning for "gennemlæs slettelisterne fra fase 1-5", og den kan køres igen.
 */

describe('slettet legacy er faktisk fraværende (fraværsreglernes modstykke)', () => {
  it('hver forbudt modulsti i manifestet matcher sit eget regex (liste og mønster er ikke driftet)', () => {
    const unmatched = LEGACY_MODULE_PATH_SELFTEST.paths.filter(
      (path) => !LEGACY_MODULE_PATH_SELFTEST.pattern.test(path)
    );

    expect(
      unmatched,
      'Disse stier står på forbudslisten, men fanges ikke af DELETED_LEGACY_INPUT_MODULES — '
        + 'listen og regexen beskriver ikke længere samme mængde.'
    ).toEqual([]);
  });

  it('ingen forbudt legacy-modul findes som fil i kilde-grafen', () => {
    const entries = getSourceGraph();
    const resurrected: string[] = [];

    for (const forbiddenPath of LEGACY_MODULE_PATH_SELFTEST.paths) {
      // En post med afsluttende '/' er en hel MAPPE; ellers et modul (`X.ts(x)` eller `X/index.ts(x)`).
      const isDirectory = forbiddenPath.endsWith('/');
      const match = entries.find((entry) =>
        isDirectory
          ? entry.relativePath.startsWith(forbiddenPath)
          : entry.relativePath === `${forbiddenPath}.ts`
            || entry.relativePath === `${forbiddenPath}.tsx`
            || entry.relativePath.startsWith(`${forbiddenPath}/`)
      );
      if (match) {
        resurrected.push(`${forbiddenPath} → ${match.relativePath}`);
      }
    }

    expect(
      resurrected,
      'Et forbudt legacy-modul er genopstået som fil. Importreglen ville først fange en KONSUMENT; '
        + 'her fanges selve genopstandelsen.'
    ).toEqual([]);
  });

  it('hvert forbudt legacy-navn er dødt som identifier i produktionen', () => {
    const entries = getSourceGraph();
    const absenceRules = ARCHITECTURE_RULES.filter(
      (rule) => rule.liveTarget.kind === 'absence' && rule.id === 'legacy/forbidden-identifier'
    );

    expect(absenceRules.length, 'forbudt-identifier-gaten mangler i manifestet').toBe(1);
    const forbidden = new Set(
      absenceRules[0].liveTarget.kind === 'absence' ? absenceRules[0].liveTarget.forbids : []
    );

    // Manifestet selv NÆVNER navnene som strengliteraler (det er dets data). Strengliteraler er ikke
    // identifiers, så de rammes ikke — men filen udelades alligevel, så testen ikke afhænger af den
    // finesse for at give mening.
    const production = entries.filter(
      (entry) => !entry.relativePath.startsWith('src/__tests__/')
    );

    const alive: string[] = [];
    for (const entry of production) {
      const sourceFile = entry.ast;
      const visit = (node: ts.Node): void => {
        if (ts.isIdentifier(node) && forbidden.has(node.text)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          alive.push(`${entry.relativePath}:${line + 1} — ${node.text}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    expect(
      alive,
      'Et navn på forbudt-listen lever stadig som identifier. Enten er sletningen ufuldstændig, '
        + 'eller også hører navnet ikke på listen (fx fordi det er levende greenfield-vokabular).'
    ).toEqual([]);
  });

  it('page-grænsens katalogkort dækker hvert descriptor-katalog (ingen usynlig domænekobling)', () => {
    const entries = getSourceGraph();
    const known = new Set([...DESCRIPTOR_CATALOG_MODULE_NAMES, ...NON_DOMAIN_CATALOG_MODULES]);

    const uncovered = entries
      .filter((entry) => entry.relativePath.startsWith(`${CATALOG_DIR}/`) && entry.relativePath.endsWith('.ts'))
      .map((entry) => entry.relativePath.slice(`${CATALOG_DIR}/`.length).replace(/\.ts$/, ''))
      .filter((moduleName) => !known.has(moduleName));

    expect(
      uncovered,
      'Et descriptor-katalog mangler i DESCRIPTOR_CATALOG_SECTIONS. `domain/page-section-access-boundary` '
        + 'ville da læse en kobling til dét domæne som "ingen kobling" og tie — værnet ville være tavst, '
        + 'ikke grønt. Tilføj modulet til kortet (eller til NON_DOMAIN_CATALOG_MODULES, hvis det ikke er '
        + 'et domæne).'
    ).toEqual([]);
  });

  it('ingen produktionsfil er en compatibility-facade (@deprecated / Legacy-eksport / dual-read)', () => {
    const entries = getSourceGraph();
    const facades: string[] = [];

    for (const entry of entries) {
      if (entry.relativePath.startsWith('src/__tests__/')) continue;

      // (a) @deprecated i produktionskoden: exitkriterie 1 forbyder en bevaret, udfaset vej.
      if (/@deprecated\b/.test(entry.text)) {
        facades.push(`${entry.relativePath} — @deprecated`);
      }

      // (b) Et EKSPORTERET symbol, hvis navn erklærer sig som legacy eller compat. Kommentarer og
      //     interne hjælpere rammes ikke: kun eksportfladen er en facade, andre kan gribe fat i.
      //
      //     `Fallback` er BEVIDST udeladt af mønsteret. Ordet bruges i domænet om ægte, ønsket
      //     ADFÆRD — fald-tilbage-dage ved ren ferie/weekend
      //     ([[project_feriedage_indkomst_fald_tilbage]]) og fokusmål efter en slettet række — ikke om
      //     en dual-read-facade. Exitkriterie 1's "fallback" handler om en bevaret gammel læsevej ved
      //     siden af den nye; den fanges af @deprecated-kontrollen og af legacy-modulkontrollen ovenfor.
      //     At forbyde ordet ville tvinge en omdøbning af korrekt domænesprog.
      const sourceFile = entry.ast;
      const visit = (node: ts.Node): void => {
        const isExported = ts.canHaveModifiers(node)
          && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true;
        if (isExported) {
          const declared = ts.isVariableStatement(node)
            ? node.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []))
            : 'name' in node && node.name !== undefined && ts.isIdentifier(node.name as ts.Node)
              ? [(node.name as ts.Identifier).text]
              : [];
          for (const name of declared) {
            if (/(?:^|[a-z])(?:Legacy|Compat)(?:[A-Z]|$)/.test(name) || /^legacy/.test(name)) {
              facades.push(`${entry.relativePath} — eksporteret '${name}'`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }

    expect(
      facades,
      'Exitkriterie 1: ingen permanent compatibility-facade, fallback eller dual-read under src/.'
    ).toEqual([]);
  });
});
