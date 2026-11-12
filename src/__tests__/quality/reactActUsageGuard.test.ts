import { readdirSync, statSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

type Finding = Readonly<{
  relativePath: string;
  line: number;
  column: number;
}>;

const TEST_ROOTS = [resolve(process.cwd(), 'src/__tests__'), resolve(process.cwd(), 'src/test')];
const ACT_MODULES = new Set(['@testing-library/react', 'react', 'react-dom/test-utils']);

const collectTestSourceFiles = (directory: string): string[] => readdirSync(directory).flatMap((name) => {
  const absolutePath = resolve(directory, name);
  return statSync(absolutePath).isDirectory()
    ? collectTestSourceFiles(absolutePath)
    : /\.tsx?$/.test(name) ? [absolutePath] : [];
});

const isAsyncCallback = (node: ts.Node): node is ts.ArrowFunction | ts.FunctionExpression =>
  (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
  && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) === true;

const isAsyncQueryName = (name: string): boolean =>
  name.startsWith('findBy')
  || name.startsWith('findAllBy')
  || name === 'waitFor'
  || name === 'waitForElementToBeRemoved';

const callName = (expression: ts.Expression): string => {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return '';
};

const actNamesFor = (source: ts.SourceFile): ReadonlySet<string> => {
  const names = new Set(['act']);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!ACT_MODULES.has(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if (element.propertyName?.text === 'act' || element.name.text === 'act') names.add(element.name.text);
    }
  }
  return names;
};

/**
 * Navnene, user-event er bundet til i filen: `userEvent` selv og enhver `const x = userEvent.setup(...)`.
 *
 * user-event wrapper selv sine handlinger i RTL's async act. Lægges de i endnu en `act(async …)`, slår den
 * indre wrapper React's act-miljø fra midt i den ydre, og React advarer «The current testing environment is
 * not configured to support act(...)» – samme klasse som en async query inde i act.
 */
const userEventNamesFor = (source: ts.SourceFile): ReadonlySet<string> => {
  const names = new Set(['userEvent']);
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && ts.isCallExpression(node.initializer) && ts.isPropertyAccessExpression(node.initializer.expression)
      && ts.isIdentifier(node.initializer.expression.expression)
      && node.initializer.expression.expression.text === 'userEvent'
      && node.initializer.expression.name.text === 'setup'
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

const isUserEventCall = (expression: ts.Expression, userEventNames: ReadonlySet<string>): boolean =>
  ts.isPropertyAccessExpression(expression)
  && ts.isIdentifier(expression.expression)
  && userEventNames.has(expression.expression.text)
  && expression.name.text !== 'setup';

const containsAsyncQuery = (node: ts.Node, userEventNames: ReadonlySet<string> = new Set()): boolean => {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(current) && (
      isAsyncQueryName(callName(current.expression)) || isUserEventCall(current.expression, userEventNames)
    )) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

const findAsyncActQueries = (source: ts.SourceFile, relativePath: string): readonly Finding[] => {
  const actNames = actNamesFor(source);
  const userEventNames = userEventNamesFor(source);
  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const isAct = ts.isIdentifier(node.expression)
        ? actNames.has(node.expression.text)
        : ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'act';
      const callback = node.arguments[0];
      if (isAct && callback && isAsyncCallback(callback) && containsAsyncQuery(callback.body, userEventNames)) {
        const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
        findings.push({ relativePath, line: line + 1, column: character + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

const scanFile = (absolutePath: string): readonly Finding[] => {
  const relativePath = relative(process.cwd(), absolutePath).replaceAll('\\', '/');
  const source = ts.createSourceFile(
    relativePath,
    readFileSync(absolutePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    absolutePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  return findAsyncActQueries(source, relativePath);
};

describe('React act-brug i tests', () => {
  it('finder den farlige kombination i en syntetisk test', () => {
    const source = ts.createSourceFile(
      'probe.test.tsx',
      "import { act, screen } from '@testing-library/react';\nawait act(async () => screen.findByRole('option'));",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    expect(findAsyncActQueries(source, 'probe.test.tsx')).toHaveLength(1);
  });

  it('finder et user-event-kald inde i en async act-callback', () => {
    const source = ts.createSourceFile(
      'probe.test.tsx',
      [
        "import { act } from '@testing-library/react';",
        'const user = userEvent.setup();',
        "await act(async () => user.keyboard('{Enter}'));",
      ].join('\n'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    expect(findAsyncActQueries(source, 'probe.test.tsx')).toHaveLength(1);
  });

  it('accepterer et user-event-kald uden ydre act', () => {
    const source = ts.createSourceFile(
      'probe.test.tsx',
      [
        "import { act } from '@testing-library/react';",
        'const user = userEvent.setup();',
        "await user.keyboard('{Enter}');",
        'act(() => input.focus());',
      ].join('\n'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    expect(findAsyncActQueries(source, 'probe.test.tsx')).toEqual([]);
  });

  it('accepterer en async query før den separate act-grænse', () => {
    const source = ts.createSourceFile(
      'probe.test.tsx',
      "import { act, screen } from '@testing-library/react';\nconst option = await screen.findByRole('option');\nawait act(async () => fireEvent.click(option));",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    expect(findAsyncActQueries(source, 'probe.test.tsx')).toEqual([]);
  });

  it('ingen test har async queries eller user-event-kald inde i en async act-callback', () => {
    const findings = TEST_ROOTS.flatMap(collectTestSourceFiles).flatMap(scanFile);

    expect(findings, findings.map((finding) =>
      `${finding.relativePath}:${finding.line}:${finding.column}`).join('\n')).toEqual([]);
  });
});
