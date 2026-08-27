import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const SOURCE_ROOT = path.resolve(__dirname, '../../');

type Violation = Readonly<{
  file: string;
  line: number;
}>;

const listSourceFiles = (): readonly string[] => {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') visit(entryPath);
      } else if (entry.name.endsWith('.tsx')) {
        files.push(entryPath);
      }
    }
  };
  visit(SOURCE_ROOT);
  return files;
};

const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const objectHasTooltipProperty = (expression: ts.Expression): boolean => {
  if (!ts.isObjectLiteralExpression(expression)) return false;
  return expression.properties.some((property) => (
    ts.isPropertyAssignment(property)
    && property.name.getText() === 'tooltip'
  ));
};

const objectPropertiesOf = (
  expression: ts.Expression,
  source: ts.SourceFile,
): readonly ts.ObjectLiteralElementLike[] | null => {
  if (ts.isParenthesizedExpression(expression)) return objectPropertiesOf(expression.expression, source);
  if (ts.isObjectLiteralExpression(expression)) return expression.properties;
  if (ts.isIdentifier(expression)) {
    let initializer: ts.Expression | undefined;
    const visit = (node: ts.Node): void => {
      if (
        initializer === undefined
        && ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name)
        && node.name.text === expression.text
        && node.initializer !== undefined
      ) {
        initializer = node.initializer;
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
    if (initializer === undefined) return null;
    if (ts.isCallExpression(initializer)) {
      const factory = initializer.arguments[0];
      if (factory !== undefined && ts.isArrowFunction(factory) && !ts.isBlock(factory.body)) {
        return objectPropertiesOf(factory.body, source);
      }
    }
    return objectPropertiesOf(initializer, source);
  }
  return null;
};

const tooltipImports = (source: ts.SourceFile): ReadonlySet<string> => {
  const imports = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleName = statement.moduleSpecifier.text;
    if (moduleName !== '@mui/material' && moduleName !== '@mui/material/Tooltip') continue;
    if (moduleName === '@mui/material/Tooltip' && statement.importClause?.name !== undefined) {
      imports.add(statement.importClause.name.text);
    }
    const namedImports = statement.importClause?.namedBindings;
    if (namedImports === undefined || !ts.isNamedImports(namedImports)) continue;
    for (const specifier of namedImports.elements) {
      if (specifier.propertyName?.text === 'Tooltip' || specifier.name.text === 'Tooltip') {
        imports.add(specifier.name.text);
      }
    }
  }
  return imports;
};

const findTooltipSlotOverrides = (source: ts.SourceFile): readonly ts.JsxAttribute[] => {
  const importedTooltipNames = tooltipImports(source);
  const overrides: ts.JsxAttribute[] = [];
  const visit = (node: ts.Node): void => {
    if (!ts.isJsxOpeningLikeElement(node) || !ts.isIdentifier(node.tagName)) {
      ts.forEachChild(node, visit);
      return;
    }
    if (!importedTooltipNames.has(node.tagName.text)) {
      ts.forEachChild(node, visit);
      return;
    }
    for (const attribute of node.attributes.properties) {
      if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name)) continue;
      const attributeName = attribute.name.text;
      if (attributeName !== 'slots' && attributeName !== 'slotProps') continue;
      const expression = attribute.initializer;
      // En lokal `slots`-prop kan erstatte selve tekstslotten. `slotProps` må kun indeholde
      // Poppers positioneringsdata, som sidemenuen bruger til sin egen skala.
      if (attributeName === 'slots') {
        overrides.push(attribute);
        continue;
      }
      if (
        expression !== undefined
        && ts.isJsxExpression(expression)
        && expression.expression !== undefined
        && (
          objectPropertiesOf(expression.expression, source) === null
          || objectHasTooltipProperty(expression.expression)
        )
      ) {
        overrides.push(attribute);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return overrides;
};

describe('tooltip-præsentationens værn', () => {
  it('lader ikke callsites erstatte eller style den globale tooltipslot', () => {
    const violations: Violation[] = [];
    for (const file of listSourceFiles()) {
      const source = parse(file);
      for (const node of findTooltipSlotOverrides(source)) {
        violations.push({
          file: path.relative(SOURCE_ROOT, file),
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        });
      }
    }

    expect(violations, `Den fælles tooltiptekst må ikke erstattes eller styles lokalt:\n${violations
      .map((violation) => `  ${violation.file}:${violation.line}`)
      .join('\n')}`).toEqual([]);
  });

  it('kan faktisk opdage en lokal tooltipslot og dens slotprops', () => {
    const source = ts.createSourceFile(
      'fixture.tsx',
      "import { Tooltip } from '@mui/material';\n<Tooltip slots={{ tooltip: LocalTooltip }} title=\"x\"><span /></Tooltip>;\n<Tooltip slotProps={{ tooltip: { sx: { width: 500 } } }} title=\"x\"><span /></Tooltip>;",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    expect(findTooltipSlotOverrides(source)).toHaveLength(2);
  });
});
