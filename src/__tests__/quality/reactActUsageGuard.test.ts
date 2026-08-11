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

const containsAsyncQuery = (node: ts.Node): boolean => {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(current) && isAsyncQueryName(callName(current.expression))) {
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
  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const isAct = ts.isIdentifier(node.expression)
        ? actNames.has(node.expression.text)
        : ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'act';
      const callback = node.arguments[0];
      if (isAct && callback && isAsyncCallback(callback) && containsAsyncQuery(callback.body)) {
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

  it('ingen test har async queries inde i en async act-callback', () => {
    const findings = TEST_ROOTS.flatMap(collectTestSourceFiles).flatMap(scanFile);

    expect(findings, findings.map((finding) =>
      `${finding.relativePath}:${finding.line}:${finding.column}`).join('\n')).toEqual([]);
  });
});
