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

const parse = (filePath: string): ts.SourceFile =>
  ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

/** Et direkte `openPage`-kald skal være awaitet, før testen går videre. */
const findUnawaitedOpenPageCalls = (source: ts.SourceFile): readonly ts.CallExpression[] => {
  const findings: ts.CallExpression[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'openPage'
      && (ts.isExpressionStatement(node.parent) || ts.isVoidExpression(node.parent))
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

describe('E2E-specs afventer openPage før næste påstand', () => {
  it('await-er alle direkte openPage-kald i den levende suite', () => {
    const violations: string[] = [];

    for (const filePath of listSpecFiles(E2E_ROOT)) {
      const source = parse(filePath);
      for (const node of findUnawaitedOpenPageCalls(source)) {
        violations.push(`${path.relative(process.cwd(), filePath)}:${lineOf(source, node)}`);
      }
    }

    expect(
      violations,
      'openPage er asynkron og venter på destinationens sidetitel. Et uawaitet kald kan lade den næste '
      + 'påstand måle den forrige lazy side; brug `await openPage(page, side)`.'
    ).toEqual([]);
  });

  describe('værnet kan faktisk fejle', () => {
    const fixture = (body: string): ts.SourceFile =>
      ts.createSourceFile('fixture.spec.ts', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    it('fanger et direkte uawaitet openPage-kald', () => {
      expect(findUnawaitedOpenPageCalls(fixture("openPage(page, 'Satser');"))).toHaveLength(1);
    });

    it('fanger fire-and-forget gennem void', () => {
      expect(findUnawaitedOpenPageCalls(fixture("void openPage(page, 'Satser');"))).toHaveLength(1);
    });

    it('accepterer et awaitet openPage-kald', () => {
      expect(findUnawaitedOpenPageCalls(fixture("await openPage(page, 'Satser');"))).toHaveLength(0);
    });

    it('måler kode og ikke ordene i kommentarer eller strenge', () => {
      const source = fixture(
        "// openPage(page, 'Satser');\n"
        + "const forklaring = \"openPage(page, 'Satser')\";\n"
        + "await openPage(page, 'Satser');"
      );

      expect(findUnawaitedOpenPageCalls(source)).toHaveLength(0);
    });

    it('måler en levende E2E-suite', () => {
      expect(listSpecFiles(E2E_ROOT).length).toBeGreaterThan(60);
    });
  });
});
