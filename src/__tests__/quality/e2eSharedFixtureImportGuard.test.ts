import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const E2E_ROOT = path.resolve(process.cwd(), 'e2e');
const SHARED_FIXTURE_MODULE = './support/mineoTest';
const PLAYWRIGHT_MODULE = '@playwright/test';
const REQUIRED_SHARED_IMPORTS = new Set(['test', 'expect']);
const SHARED_API_NAMES = new Set([
  'login',
  'openPage',
  'readAutomationSnapshot',
  'waitForSettledChange',
  'setFieldValue',
  'setFieldValueAndSettle',
  'setVerbatimFieldValueAndSettle',
]);

type Finding = Readonly<{
  line: number;
  detail: string;
}>;

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

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const moduleNameOf = (declaration: ts.ImportDeclaration): string | null =>
  ts.isStringLiteral(declaration.moduleSpecifier) ? declaration.moduleSpecifier.text : null;

/** Finder runtime-bindings i en import – type-only browsertyper er ikke en runtime omgåelse. */
const runtimeNamedImports = (declaration: ts.ImportDeclaration): readonly ts.ImportSpecifier[] => {
  const clause = declaration.importClause;
  if (clause === undefined || clause.isTypeOnly || clause.namedBindings === undefined) return [];
  if (!ts.isNamedImports(clause.namedBindings)) return [];
  return clause.namedBindings.elements.filter((specifier) => !specifier.isTypeOnly);
};

const importedNameOf = (specifier: ts.ImportSpecifier): string =>
  specifier.propertyName?.text ?? specifier.name.text;

/** Et namespace-/default-import eller en side-effect-import er også en runtime-import. */
const isRuntimeImport = (declaration: ts.ImportDeclaration): boolean => {
  const clause = declaration.importClause;
  if (clause === undefined || clause.isTypeOnly) return clause === undefined;
  if (clause.name !== undefined) return true;
  if (clause.namedBindings === undefined) return true;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return runtimeNamedImports(declaration).length > 0;
};

const isDynamicPlaywrightImport = (node: ts.Node): boolean =>
  ts.isCallExpression(node)
  && node.expression.kind === ts.SyntaxKind.ImportKeyword
  && node.arguments[0] !== undefined
  && ts.isStringLiteral(node.arguments[0])
  && node.arguments[0].text === PLAYWRIGHT_MODULE;

const isRequireOfPlaywright = (node: ts.Node): boolean =>
  ts.isCallExpression(node)
  && ts.isIdentifier(node.expression)
  && node.expression.text === 'require'
  && node.arguments[0] !== undefined
  && ts.isStringLiteral(node.arguments[0])
  && node.arguments[0].text === PLAYWRIGHT_MODULE;

const findImportViolations = (source: ts.SourceFile): readonly Finding[] => {
  const findings: Finding[] = [];
  const sharedRuntimeImports = new Set<string>();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const moduleName = moduleNameOf(statement);

    if (moduleName === PLAYWRIGHT_MODULE && isRuntimeImport(statement)) {
      findings.push({
        line: lineOf(source, statement),
        detail: `runtime-import fra ${PLAYWRIGHT_MODULE}`,
      });
    }

    const runtimeImports = runtimeNamedImports(statement);
    if (moduleName === SHARED_FIXTURE_MODULE) {
      for (const specifier of runtimeImports) sharedRuntimeImports.add(importedNameOf(specifier));
    }

    if (moduleName !== SHARED_FIXTURE_MODULE) {
      for (const specifier of runtimeImports) {
        const importedNames = [importedNameOf(specifier), specifier.name.text];
        const contractName = importedNames.find(
          (name) => REQUIRED_SHARED_IMPORTS.has(name) || SHARED_API_NAMES.has(name),
        );
        if (contractName !== undefined) {
          findings.push({
            line: lineOf(source, specifier),
            detail: `«${contractName}» importeres fra «${moduleName ?? 'ukendt modul'}»`,
          });
        }
      }
    }
  }

  for (const requiredImport of REQUIRED_SHARED_IMPORTS) {
    if (!sharedRuntimeImports.has(requiredImport)) {
      findings.push({
        line: 1,
        detail: `«${requiredImport}» mangler som runtime-import fra ${SHARED_FIXTURE_MODULE}`,
      });
    }
  }

  const visit = (node: ts.Node): void => {
    if (isDynamicPlaywrightImport(node) || isRequireOfPlaywright(node)) {
      findings.push({
        line: lineOf(source, node),
        detail: `dynamisk/CommonJS-import fra ${PLAYWRIGHT_MODULE}`,
      });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);

  return findings;
};

const describeFindings = (filePath: string, source: ts.SourceFile): readonly string[] =>
  findImportViolations(source).map(({ line, detail }) => `${path.basename(filePath)}:${line} – ${detail}`);

describe('ARCH-003 – E2E-specs bruger det fælles testgrundlag', () => {
  it('har en levende E2E-specflade at kontrollere', () => {
    expect(listSpecFiles(E2E_ROOT).length).toBeGreaterThan(60);
  });

  it('afviser runtime-import af Playwright-runneren i et spec', () => {
    const source = parse(
      "import { expect as pwExpect, test as pwTest } from '@playwright/test';\n"
      + "import { expect, test } from './support/mineoTest';",
    );

    expect(findImportViolations(source).map(({ detail }) => detail)).toContain(
      `runtime-import fra ${PLAYWRIGHT_MODULE}`,
    );
  });

  it('afviser namespace-, dynamisk- og CommonJS-omgåelser', () => {
    const source = parse(
      "import * as playwright from '@playwright/test';\n"
      + "import { expect, test } from './support/mineoTest';\n"
      + "const dynamic = import('@playwright/test');\n"
      + "const commonjs = require('@playwright/test');",
    );

    const details = findImportViolations(source).map(({ detail }) => detail);
    expect(details.filter((detail) => detail === `runtime-import fra ${PLAYWRIGHT_MODULE}`)).toHaveLength(1);
    expect(details.filter((detail) => detail === `dynamisk/CommonJS-import fra ${PLAYWRIGHT_MODULE}`)).toHaveLength(2);
  });

  it('tillader type-only Page- og Locator-imports fra Playwright', () => {
    const source = parse(
      "import type { Page } from '@playwright/test';\n"
      + "import { type Locator } from '@playwright/test';\n"
      + "import { expect, test, openPage } from './support/mineoTest';",
    );

    expect(findImportViolations(source)).toEqual([]);
  });

  it('kræver test, expect og delte helpers fra den kanoniske modulsti', () => {
    const source = parse(
      "import { makeTest as test, makeExpect as expect } from './support/andetTestgrundlag';\n"
      + "import { makeLogin as login } from './support/lokalHelper';",
    );

    const details = findImportViolations(source).map(({ detail }) => detail);
    expect(details).toEqual(expect.arrayContaining([
      '«test» importeres fra «./support/andetTestgrundlag»',
      '«expect» importeres fra «./support/andetTestgrundlag»',
      '«login» importeres fra «./support/lokalHelper»',
      '«test» mangler som runtime-import fra ./support/mineoTest',
      '«expect» mangler som runtime-import fra ./support/mineoTest',
    ]));
  });

  it('accepterer aliaser af test, expect og helpers fra det fælles grundlag', () => {
    const source = parse(
      "import { test as mineoTest, expect as assert, openPage as navigate } from './support/mineoTest';",
    );

    expect(findImportViolations(source)).toEqual([]);
  });

  it('finder ingen importomgåelser i den levende E2E-suite', () => {
    const findings = listSpecFiles(E2E_ROOT).flatMap((filePath) => {
      const source = parse(fs.readFileSync(filePath, 'utf8'));
      return describeFindings(filePath, source);
    });

    expect(
      findings,
      'Importer test, expect og de delte E2E-helpers fra e2e/support/mineoTest.ts. Type-only browsertyper '
      + 'fra @playwright/test er tilladt, men runnerens runtime-fixtures må ikke omgås.'
      + `\n${findings.join('\n')}`,
    ).toEqual([]);
  });
});
