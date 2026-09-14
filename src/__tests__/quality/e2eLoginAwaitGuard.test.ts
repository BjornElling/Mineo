import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const E2E_ROOT = path.resolve(process.cwd(), 'e2e');

const listSpecFiles = (directory: string): readonly string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSpecFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.spec.ts') ? [entryPath] : [];
  });

const parse = (source: string): ts.SourceFile =>
  ts.createSourceFile(
    'fixture.spec.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

/** Finder et direkte login-kald, der ikke afsluttes med await. */
const findUnawaitedLoginCalls = (source: ts.SourceFile): readonly ts.CallExpression[] => {
  const findings: ts.CallExpression[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'login'
      && !ts.isAwaitExpression(node.parent)
    ) {
      findings.push(node);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return findings;
};

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

describe('E2E-specs afventer den fælles loginrejse', () => {
  it('await-er alle direkte login-kald i den levende suite', () => {
    const violations: string[] = [];

    for (const filePath of listSpecFiles(E2E_ROOT)) {
      const source = parse(fs.readFileSync(filePath, 'utf8'));
      for (const node of findUnawaitedLoginCalls(source)) {
        violations.push(`${path.relative(process.cwd(), filePath)}:${lineOf(source, node)}`);
      }
    }

    expect(
      violations,
      'login er asynkron og venter på den færdigmonterede app-shell. Et uawaitet kald kan lade næste '
      + 'handling starte mod login- eller lazy-loadingtilstanden; brug `await login(page)`.',
    ).toEqual([]);
  });

  describe('værnet kan faktisk fejle', () => {
    const fixture = (body: string): ts.SourceFile =>
      ts.createSourceFile('fixture.spec.ts', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    it('fanger et direkte uawaitet login-kald', () => {
      expect(findUnawaitedLoginCalls(fixture('login(page);'))).toHaveLength(1);
    });

    it('fanger fire-and-forget gennem void', () => {
      expect(findUnawaitedLoginCalls(fixture('void login(page);'))).toHaveLength(1);
    });

    it('accepterer et awaitet login-kald', () => {
      expect(findUnawaitedLoginCalls(fixture('await login(page);'))).toHaveLength(0);
    });

    it('måler kode og ikke ordene i kommentarer eller strenge', () => {
      const source = fixture(
        '// login(page);\n'
        + 'const forklaring = "login(page)";\n'
        + 'await login(page);',
      );

      expect(findUnawaitedLoginCalls(source)).toHaveLength(0);
    });

    it('måler en levende E2E-suite', () => {
      expect(listSpecFiles(E2E_ROOT).length).toBeGreaterThan(60);
    });
  });
});
