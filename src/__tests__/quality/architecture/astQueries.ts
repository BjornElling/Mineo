import path from 'node:path';
import ts from 'typescript';
import type { SourceEntry } from './sourceGraph';

/**
 * Rene AST-forespørgsler over en {@link SourceEntry}. Reglerne i
 * `architectureRules.ts` komponeres udelukkende af disse primitiver, så
 * grænse-håndhævelsen er strukturel (ikke tekstuel) og fri for de silent-pass-huller
 * — aliasing, destrukturering, bracket-notation — som de gamle regex-scannere selv
 * dokumenterede.
 */

export type CodePosition = Readonly<{ line: number; column: number }>;

export type ImportRef = Readonly<{
  /** Modulets specifier uden anførselstegn, fx `../../stores/formPersistenceStore`. */
  moduleSpecifier: string;
  /** Statisk `import`/`export ... from`, dynamisk `import(...)` eller `require(...)`. */
  kind: 'import' | 'export-from' | 'dynamic' | 'require';
  /** Er importen ren type-position (`import type` / `import { type X }`)? */
  typeOnly: boolean;
  /**
   * Eksporterede navne i en named import/export (`{ a, b as c }` → `['a', 'b']`) —
   * det ORIGINALE eksport-navn, ikke aliaset. Tom for default/namespace/side-effect
   * og for dynamiske/`require`-imports.
   */
  namedBindings: readonly string[];
  node: ts.Node;
  position: CodePosition;
}>;

export type CallRef = Readonly<{
  /** Sidste identifier i callee-kæden, fx `setItem` i `sessionStorage.setItem(...)`. */
  calleeName: string;
  /** Fuld callee-tekst, fx `sessionStorage.setItem` eller `React.useEffect`. */
  calleeText: string;
  /** Første string-literal-argumenter (kun direkte literaler; ikke variabler). */
  stringArgs: readonly string[];
  /** Første argument, hvis det er en string-literal — ellers `null` (positionelt præcist). */
  firstArgStringLiteral: string | null;
  node: ts.CallExpression;
  position: CodePosition;
}>;

export type ElementAccessRef = Readonly<{
  /** Objektet der subscriptes, hvis det er en bar identifier (`aarsloenAslMax[x]` → `aarsloenAslMax`); ellers `''`. */
  objectName: string;
  /** Fuld tekst inkl. subscript, fx `aarsloenAslMax[year]`. */
  chainText: string;
  node: ts.ElementAccessExpression;
  position: CodePosition;
}>;

export type MemberAccessRef = Readonly<{
  /** Fuld prik-kæde uden kald, fx `window.localStorage` eller `sessionStorage.length`. */
  chainText: string;
  /** Kædens venstre-mest identifier, fx `window` eller `sessionStorage`. */
  rootName: string;
  node: ts.PropertyAccessExpression;
  position: CodePosition;
}>;

export type TypeAssertionRef = Readonly<{
  /** Den skrevne target-type i `value as Type` eller `<Type>value`. */
  typeText: string;
  node: ts.AsExpression | ts.TypeAssertion;
  position: CodePosition;
}>;

const positionOf = (ast: ts.SourceFile, node: ts.Node): CodePosition => {
  const { line, character } = ast.getLineAndCharacterOfPosition(node.getStart(ast));
  return { line: line + 1, column: character + 1 };
};

const walk = (node: ts.Node, visit: (node: ts.Node) => void): void => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

const unquote = (node: ts.Expression | undefined): string | null => {
  if (node && ts.isStringLiteralLike(node)) return node.text;
  return null;
};

const namedBindingsOf = (
  bindings: ts.NamedImportBindings | ts.NamedExportBindings | undefined
): readonly string[] => {
  if (!bindings) return [];
  if (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) {
    // propertyName er det oprindelige eksport-navn ved alias (`orig as alias`); ellers er name navnet.
    return bindings.elements.map((element) => (element.propertyName ?? element.name).text);
  }
  return [];
};

/** Alle modul-imports i filen: statiske, `export ... from`, dynamiske og `require`. */
export const collectImports = (entry: SourceEntry): readonly ImportRef[] => {
  const { ast } = entry;
  const refs: ImportRef[] = [];

  walk(ast, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const typeOnly =
        node.importClause?.isTypeOnly === true ||
        (node.importClause?.namedBindings !== undefined &&
          ts.isNamedImports(node.importClause.namedBindings) &&
          node.importClause.namedBindings.elements.length > 0 &&
          node.importClause.namedBindings.elements.every((e) => e.isTypeOnly));
      refs.push({
        moduleSpecifier: node.moduleSpecifier.text,
        kind: 'import',
        typeOnly,
        namedBindings: namedBindingsOf(node.importClause?.namedBindings),
        node,
        position: positionOf(ast, node),
      });
      return;
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      refs.push({
        moduleSpecifier: node.moduleSpecifier.text,
        kind: 'export-from',
        typeOnly: node.isTypeOnly,
        namedBindings: namedBindingsOf(node.exportClause),
        node,
        position: positionOf(ast, node),
      });
      return;
    }

    if (ts.isCallExpression(node)) {
      // Dynamisk import('...')
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const spec = unquote(node.arguments[0]);
        if (spec !== null) {
          refs.push({
            moduleSpecifier: spec,
            kind: 'dynamic',
            typeOnly: false,
            namedBindings: [],
            node,
            position: positionOf(ast, node),
          });
        }
        return;
      }
      // require('...')
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const spec = unquote(node.arguments[0]);
        if (spec !== null) {
          refs.push({
            moduleSpecifier: spec,
            kind: 'require',
            typeOnly: false,
            namedBindings: [],
            node,
            position: positionOf(ast, node),
          });
        }
      }
    }
  });

  return refs;
};

const calleeTextOf = (expression: ts.Expression): string => {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    return `${calleeTextOf(expression.expression)}.${expression.name.text}`;
  }
  if (ts.isElementAccessExpression(expression)) {
    const arg = unquote(expression.argumentExpression);
    return arg !== null
      ? `${calleeTextOf(expression.expression)}[${JSON.stringify(arg)}]`
      : `${calleeTextOf(expression.expression)}[…]`;
  }
  if (ts.isParenthesizedExpression(expression)) return calleeTextOf(expression.expression);
  return expression.getText();
};

const calleeNameOf = (expression: ts.Expression): string => {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isElementAccessExpression(expression)) return unquote(expression.argumentExpression) ?? '';
  if (ts.isParenthesizedExpression(expression)) return calleeNameOf(expression.expression);
  return '';
};

/** Alle kald-udtryk med callee-navn/-tekst og deres direkte string-literal-argumenter. */
export const collectCalls = (entry: SourceEntry): readonly CallRef[] => {
  const { ast } = entry;
  const refs: CallRef[] = [];

  walk(ast, (node) => {
    if (!ts.isCallExpression(node)) return;
    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return;

    const stringArgs: string[] = [];
    for (const arg of node.arguments) {
      const value = unquote(arg);
      if (value !== null) stringArgs.push(value);
    }

    refs.push({
      calleeName: calleeNameOf(node.expression),
      calleeText: calleeTextOf(node.expression),
      stringArgs,
      firstArgStringLiteral: unquote(node.arguments[0]),
      node,
      position: positionOf(ast, node),
    });
  });

  return refs;
};

const rootIdentifierOf = (expression: ts.Expression): string => {
  let current: ts.Expression = expression;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : '';
};

const chainTextOf = (node: ts.PropertyAccessExpression): string => calleeTextOf(node);

/**
 * Alle prik-medlemsadgange (`a.b`, `a.b.c`) i filen. Bruges til at fange global
 * adgang som `sessionStorage.setItem` / `window.localStorage` strukturelt.
 */
export const collectMemberAccess = (entry: SourceEntry): readonly MemberAccessRef[] => {
  const { ast } = entry;
  const refs: MemberAccessRef[] = [];

  walk(ast, (node) => {
    if (!ts.isPropertyAccessExpression(node)) return;
    refs.push({
      chainText: chainTextOf(node),
      rootName: rootIdentifierOf(node),
      node,
      position: positionOf(ast, node),
    });
  });

  return refs;
};

/** Alle element-adgange (`a[x]`, `a.b[x]`). Bruges til at fange rå subscript-opslag som `aarsloenAslMax[year]`. */
export const collectElementAccess = (entry: SourceEntry): readonly ElementAccessRef[] => {
  const { ast } = entry;
  const refs: ElementAccessRef[] = [];

  walk(ast, (node) => {
    if (!ts.isElementAccessExpression(node)) return;
    refs.push({
      objectName: ts.isIdentifier(node.expression) ? node.expression.text : '',
      chainText: node.getText(ast),
      node,
      position: positionOf(ast, node),
    });
  });

  return refs;
};

/** Alle eksplicitte type-assertions (`value as Type` og `<Type>value`). */
export const collectTypeAssertions = (entry: SourceEntry): readonly TypeAssertionRef[] => {
  const { ast } = entry;
  const refs: TypeAssertionRef[] = [];

  walk(ast, (node) => {
    if (!ts.isAsExpression(node) && !ts.isTypeAssertionExpression(node)) return;
    refs.push({
      typeText: node.type.getText(ast),
      node,
      position: positionOf(ast, node),
    });
  });

  return refs;
};

export type IdentifierRef = Readonly<{
  text: string;
  node: ts.Identifier;
  position: CodePosition;
}>;

/**
 * Alle identifiers i filen — den kanoniske kilde til "bruges dette navn?".
 *
 * Bevidst AST-baseret: kommentarer er ikke noder, så en historik-kommentar om en slettet mekanisme
 * kan pr. konstruktion ikke flages ([[project_dansk_prosa_guard_markers]]). Strengliteraler er heller
 * ikke identifiers, så et manifest der NÆVNER navnene som data, rammes ikke.
 */
export const collectIdentifiers = (entry: SourceEntry): readonly IdentifierRef[] => {
  const { ast } = entry;
  const refs: IdentifierRef[] = [];

  walk(ast, (node) => {
    if (!ts.isIdentifier(node)) return;
    refs.push({ text: node.text, node, position: positionOf(ast, node) });
  });

  return refs;
};

/**
 * Bruges navnet som identifier i filen?
 *
 * Delt af forbudt-identifier-gatens `find` OG dens fraværsbevis, så de to ikke kan drifte: en gate,
 * der måler navnet på én måde og beviser fraværet på en anden, kan være grøn i begge ender og alligevel
 * forkert i midten.
 */
export const hasIdentifier = (entry: SourceEntry, name: string): boolean =>
  collectIdentifiers(entry).some((ref) => ref.text === name);

/**
 * Opløser en relativ import-specifier til en repo-relativ posix-sti (uden extension),
 * fx (`src/domain/x/y.ts`, `../../eoInspektion/z`) → `src/domain/eoInspektion/z`.
 * Returnerer `null` for ikke-relative (bare/alias) specifiers — de matches på segment i stedet.
 */
export const resolveRelativeImport = (
  fromRelativePath: string,
  specifier: string
): string | null => {
  if (!specifier.startsWith('.')) return null;
  const fromDir = path.posix.dirname(fromRelativePath.replaceAll('\\', '/'));
  return path.posix.normalize(path.posix.join(fromDir, specifier));
};
