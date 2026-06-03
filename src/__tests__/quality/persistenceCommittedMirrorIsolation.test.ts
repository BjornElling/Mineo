import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { assertPathExists, collectSourceFiles, toRepoRelativePath } from './testUtils';

const PAGES_ROOT = path.resolve(process.cwd(), 'src/components/pages');
const HOOKS_ROOT = path.resolve(process.cwd(), 'src/hooks');
const SCAN_ROOTS = [PAGES_ROOT, HOOKS_ROOT] as const;

const isNamedCall = (node: ts.CallExpression, identifier: string): boolean => {
  const { expression } = node;
  return (
    ts.isIdentifier(expression) && expression.text === identifier
  ) || (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'React' &&
    expression.name.text === identifier
  );
};

const collectBindingIdentifiers = (name: ts.BindingName): string[] => {
  if (ts.isIdentifier(name)) {
    return [name.text];
  }

  const result: string[] = [];
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    if (element.dotDotDotToken) continue;
    result.push(...collectBindingIdentifiers(element.name));
  }
  return result;
};

const expressionReferencesTrackedCommittedSource = (
  node: ts.Node,
  trackedSectionVars: ReadonlySet<string>,
  trackedValuesVars: ReadonlySet<string>,
  trackedFormVars: ReadonlySet<string>
): boolean => {
  let found = false;

  const visit = (current: ts.Node): void => {
    if (found) return;

    if (ts.isIdentifier(current) && (trackedSectionVars.has(current.text) || trackedValuesVars.has(current.text))) {
      found = true;
      return;
    }

    if (
      ts.isPropertyAccessExpression(current) &&
      ts.isIdentifier(current.expression) &&
      trackedFormVars.has(current.expression.text) &&
      current.name.text === 'values'
    ) {
      found = true;
      return;
    }

    ts.forEachChild(current, visit);
  };

  visit(node);
  return found;
};

describe('persistenceCommittedMirrorIsolation', () => {
  it('forventede scan-roots findes', () => {
    for (const root of SCAN_ROOTS) {
      assertPathExists(root, 'Quality-test persistence mirror root');
    }
  });

  it('forbyder lokale React-state spejlkopier af persisted committed sektioner i pages og hooks', () => {
    const violations: string[] = [];

    for (const root of SCAN_ROOTS) {
      for (const absolutePath of collectSourceFiles(root)) {
        const source = fs.readFileSync(absolutePath, 'utf8');
        const sourceFile = ts.createSourceFile(absolutePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const relativePath = toRepoRelativePath(absolutePath);

        const trackedSectionVars = new Set<string>();
        const trackedValuesVars = new Set<string>();
        const trackedFormVars = new Set<string>();
        const localStateSetters = new Set<string>();

        const collect = (node: ts.Node): void => {
          if (ts.isVariableDeclaration(node) && node.initializer) {
            if (
              ts.isCallExpression(node.initializer) &&
              (isNamedCall(node.initializer, 'usePersistedSectionSelector') || isNamedCall(node.initializer, 'getPersistedSectionSnapshot'))
            ) {
              for (const identifier of collectBindingIdentifiers(node.name)) {
                trackedSectionVars.add(identifier);
              }
            }

            if (ts.isCallExpression(node.initializer) && isNamedCall(node.initializer, 'usePersistedForm')) {
              if (ts.isIdentifier(node.name)) {
                trackedFormVars.add(node.name.text);
              }

              if (ts.isObjectBindingPattern(node.name)) {
                for (const element of node.name.elements) {
                  if (element.dotDotDotToken) continue;
                  const propertyName = element.propertyName ?? element.name;
                  if (ts.isIdentifier(propertyName) && propertyName.text === 'values') {
                    trackedValuesVars.add(element.name.getText(sourceFile));
                  }
                }
              }
            }

            if (
              ts.isObjectBindingPattern(node.name) &&
              ts.isIdentifier(node.initializer) &&
              trackedFormVars.has(node.initializer.text)
            ) {
              for (const element of node.name.elements) {
                if (element.dotDotDotToken) continue;
                const propertyName = element.propertyName ?? element.name;
                if (ts.isIdentifier(propertyName) && propertyName.text === 'values') {
                  trackedValuesVars.add(element.name.getText(sourceFile));
                }
              }
            }

            if (
              ts.isIdentifier(node.name) &&
              ts.isPropertyAccessExpression(node.initializer) &&
              ts.isIdentifier(node.initializer.expression) &&
              trackedFormVars.has(node.initializer.expression.text) &&
              node.initializer.name.text === 'values'
            ) {
              trackedValuesVars.add(node.name.text);
            }

            if (
              ts.isArrayBindingPattern(node.name) &&
              ts.isCallExpression(node.initializer) &&
              isNamedCall(node.initializer, 'useState')
            ) {
              const setter = node.name.elements[1];
              if (setter && ts.isBindingElement(setter) && ts.isIdentifier(setter.name)) {
                localStateSetters.add(setter.name.text);
              }
            }
          }

          ts.forEachChild(node, collect);
        };

        collect(sourceFile);

        const inspect = (node: ts.Node): void => {
          if (
            ts.isVariableDeclaration(node) &&
            node.initializer &&
            ts.isCallExpression(node.initializer) &&
            isNamedCall(node.initializer, 'useState')
          ) {
            const [firstArgument] = node.initializer.arguments;
            if (
              firstArgument &&
              expressionReferencesTrackedCommittedSource(
                firstArgument,
                trackedSectionVars,
                trackedValuesVars,
                trackedFormVars
              )
            ) {
              violations.push(`${relativePath}: useState initializer`);
            }
          }

          if (ts.isCallExpression(node) && isNamedCall(node, 'useEffect')) {
            const [effectCallback] = node.arguments;
            if (effectCallback && (ts.isArrowFunction(effectCallback) || ts.isFunctionExpression(effectCallback))) {
              const visitEffect = (effectNode: ts.Node): void => {
                if (
                  ts.isCallExpression(effectNode) &&
                  ts.isIdentifier(effectNode.expression) &&
                  localStateSetters.has(effectNode.expression.text) &&
                  effectNode.arguments.some((arg) =>
                    expressionReferencesTrackedCommittedSource(
                      arg,
                      trackedSectionVars,
                      trackedValuesVars,
                      trackedFormVars
                    )
                  )
                ) {
                  violations.push(`${relativePath}: useEffect -> ${effectNode.expression.text}`);
                }

                ts.forEachChild(effectNode, visitEffect);
              };

              visitEffect(effectCallback.body);
            }
          }

          ts.forEachChild(node, inspect);
        };

        inspect(sourceFile);
      }
    }

    expect(violations).toEqual([]);
  });
});
