import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const E2E_ROOT = path.resolve(process.cwd(), 'e2e');

const SIDE_MENU_LABELS = new Set([
  'Stamdata',
  'Erstatningsopgørelse',
  'Erhvervsevnetab',
  'Varige mén',
  'Forsørgertab',
  'Årslønsberegning',
  'Renteberegning',
  'Satser',
  'Indstillinger',
  'Om',
]);

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

const isStringLiteralWithText = (node: ts.Node | undefined, text: string): node is ts.StringLiteral =>
  node !== undefined && ts.isStringLiteral(node) && node.text === text;

const hasDoubleQuotedMenuLookup = (node: ts.CallExpression, source: ts.SourceFile): boolean => {
  if (!ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'getByRole') {
    return false;
  }

  const [role, options] = node.arguments;
  if (!isStringLiteralWithText(role, 'button') || !options || !ts.isObjectLiteralExpression(options)) {
    return false;
  }

  const name = options.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property)
      && ts.isIdentifier(property.name)
      && property.name.text === 'name'
      && ts.isStringLiteral(property.initializer)
      && property.initializer.getText(source).startsWith('"'),
  );

  return name !== undefined
    && ts.isStringLiteral(name.initializer)
    && SIDE_MENU_LABELS.has(name.initializer.text);
};

/** Finder kun den nye blindspot: direkte sidemenu-klik med dobbelcitation. */
const findDoubleQuotedMenuClicks = (source: ts.SourceFile): readonly ts.CallExpression[] => {
  const findings: ts.CallExpression[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'click'
    ) {
      let receiver: ts.Expression = node.expression.expression;
      while (true) {
        if (ts.isCallExpression(receiver)) {
          if (hasDoubleQuotedMenuLookup(receiver, source)) findings.push(node);
          receiver = receiver.expression;
          continue;
        }
        if (ts.isPropertyAccessExpression(receiver)) {
          receiver = receiver.expression;
          continue;
        }
        break;
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return findings;
};

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

describe('ARCH-003 – dobbelciterede sidemenu-klik er synligt dækket', () => {
  it('har en levende E2E-specflade at kontrollere', () => {
    expect(listSpecFiles(E2E_ROOT).length).toBeGreaterThan(60);
  });

  it('afviser et direkte sidemenu-klik med dobbelcitation', () => {
    const source = parse('await page.getByRole("button", { name: "Satser" }).click();');

    expect(findDoubleQuotedMenuClicks(source)).toHaveLength(1);
  });

  it('finder ingen dobbelciterede direkte sidemenu-klik i den levende suite', () => {
    const findings = listSpecFiles(E2E_ROOT).flatMap((filePath) => {
      const source = parse(fs.readFileSync(filePath, 'utf8'));
      return findDoubleQuotedMenuClicks(source).map(
        (node) => `${path.relative(process.cwd(), filePath)}:${lineOf(source, node)}`,
      );
    });

    expect(
      findings,
      'Brug openPage(page, side) fra e2e/support/mineoTest.ts i stedet for direkte sidemenu-klik.',
    ).toEqual([]);
  });
});
