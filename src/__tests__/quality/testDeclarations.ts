/**
 * AKTIVE testdeklarationer læst af TypeScripts AST.
 *
 * Modulet er udskilt, fordi to uafhængige kvalitetsværn har brug for præcis samme parser:
 * `acceptanceMatrix.test.ts` (registret citerer leaf-tests, ikke suiter) og
 * `testNamingConvention.test.ts` (aktive navne må ikke beskrive omlægningen frem for invarianten). En
 * kopi pr. konsument ville være to udgaver af den samme svære sondring – netop den drift, begge værn
 * findes for at fange.
 *
 * **Hvorfor ikke `content.includes(navn)`**: en substring-søgning beviser kun, at teksten forekommer et
 * vilkårligt sted i filen – den kunne matche et importnavn eller en kommentar.
 *
 * **Hvorfor ikke en regex over råteksten**: den var falsk-grøn på to måder, verificeret ved probe:
 *
 *   - `describe.skip('suite', () => { it('navn', …) })` – den INDLEJREDE `it` består sit eget
 *     linje-filter, selv om hele suiten er skippet. Skip arves ned gennem hierarkiet; et linjefilter
 *     kan per konstruktion ikke se det.
 *   - `// it('navn', …)` i en kommentar blev medtaget som en levende deklaration.
 *
 * **Hvorfor LEAF/SUITE-sondringen**: et `describe`-navn overlever, efter at hver `it` under det
 * er slettet. Et register, der accepterer suitenavne, kan derfor stå grønt uden en eneste udførende
 * assertion.
 *
 * `.skip`/`.todo`/`.failing`/`.skipIf` udelukkes (inkl. arvet fra en ancestor); `.each`/`.only`/
 * `.concurrent`/`.runIf` medtages, da de kører.
 */
import ts from 'typescript';

const LEAF_FNS = new Set(['it', 'test']);
const SUITE_FNS = new Set(['describe', 'suite']);
const TEST_FNS = new Set([...LEAF_FNS, ...SUITE_FNS]);
const SKIPPING_MODIFIERS = new Set(['skip', 'todo', 'failing', 'skipIf']);

export type Declaration = Readonly<{
  name: string;
  isLeaf: boolean;
  /** 1-indekseret linje for deklarationens kald, så et fund kan rapporteres som fil:linje. */
  line: number;
}>;

/** Bunden af en kaldekæde: `it.each(x)('n')` → `it`, plus de modifikatorer der blev brugt. */
const unwrapCallee = (expression: ts.Expression): { root: string; modifiers: string[] } | null => {
  const modifiers: string[] = [];
  let current: ts.Expression = expression;
  for (;;) {
    if (ts.isIdentifier(current)) {
      return TEST_FNS.has(current.text) ? { root: current.text, modifiers } : null;
    }
    if (ts.isPropertyAccessExpression(current)) {
      modifiers.push(current.name.text);
      current = current.expression;
      continue;
    }
    // `it.each([...])(...)` / `it.skipIf(cond)(...)`: tag-kaldet er selv et CallExpression.
    if (ts.isCallExpression(current)) {
      current = current.expression;
      continue;
    }
    return null;
  }
};

export const activeDeclarations = (content: string, fileName = 'test.tsx'): readonly Declaration[] => {
  const source = ts.createSourceFile(
    fileName, content, ts.ScriptTarget.Latest, /* setParentNodes */ true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const declarations: Declaration[] = [];

  const visit = (node: ts.Node, insideSkipped: boolean): void => {
    if (!ts.isCallExpression(node)) {
      node.forEachChild((child) => visit(child, insideSkipped));
      return;
    }
    const callee = unwrapCallee(node.expression);
    if (callee === null) {
      node.forEachChild((child) => visit(child, insideSkipped));
      return;
    }

    const skipped = insideSkipped || callee.modifiers.some((m) => SKIPPING_MODIFIERS.has(m));
    const isLeaf = LEAF_FNS.has(callee.root);
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const [first] = node.arguments;
    if (!skipped && first !== undefined) {
      if (ts.isStringLiteralLike(first)) {
        declarations.push({ name: first.text, isLeaf, line });
      } else if (ts.isTemplateExpression(first)) {
        // Et dynamisk navn (`${definition.id}: samme projektion …`) er stadig en aktiv deklaration.
        // De STATISKE dele er det, et register kan citere; interpolationerne er per-case-værdier, som
        // ingen registerpost kan kende på forhånd.
        declarations.push({ name: first.head.text, isLeaf, line });
        for (const span of first.templateSpans) declarations.push({ name: span.literal.text, isLeaf, line });
      }
    }
    // Kroppen walkes med den ARVEDE skip-tilstand: en `it` inde i en `describe.skip` er ikke aktiv.
    node.forEachChild((child) => visit(child, skipped));
  };

  visit(source, false);
  return declarations;
};

export const leafTestNames = (content: string, fileName?: string): readonly string[] =>
  activeDeclarations(content, fileName).filter((entry) => entry.isLeaf).map((entry) => entry.name);

export const suiteNames = (content: string, fileName?: string): readonly string[] =>
  activeDeclarations(content, fileName).filter((entry) => !entry.isLeaf).map((entry) => entry.name);
