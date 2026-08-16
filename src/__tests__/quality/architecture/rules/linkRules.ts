/**
 * Den fælles web-linkregel.
 *
 * Links er små JSX-flader, men deres target og plads i tastaturrækkefølgen er en tværgående
 * brugerregel. Derfor må de ikke sammensættes lokalt med `component="a"` og en håndfuld attributter:
 * alle links til web-sider går gennem én af de to policy-primitiver.
 */
import ts from 'typescript';
import { defineRule, type Finding } from '../ruleKit';
import { hasIdentifier } from '../astQueries';
import type { SourceEntry } from '../sourceGraph';

const EXTERNAL_LINK_PATH = 'src/components/ui/ExternalLink.tsx';
const INTERNAL_LINK_PATH = 'src/components/ui/InternalLink.tsx';

const jsxTagName = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string => {
  if (ts.isIdentifier(node.tagName)) return node.tagName.text;
  if (ts.isPropertyAccessExpression(node.tagName)) return node.tagName.name.text;
  return '';
};

const jsxAttribute = (
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  name: string
): ts.JsxAttribute | undefined => node.attributes.properties.find(
  (property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && ts.isIdentifier(property.name) && property.name.text === name
);

const stringAttributeValue = (attribute: ts.JsxAttribute | undefined): string | null => {
  if (!attribute?.initializer || !ts.isStringLiteral(attribute.initializer)) return null;
  return attribute.initializer.text;
};

const numericAttributeValue = (attribute: ts.JsxAttribute | undefined): number | null => {
  if (!attribute?.initializer || !ts.isJsxExpression(attribute.initializer)) return null;
  const expression = attribute.initializer.expression;
  if (expression === undefined) return null;
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  ) {
    return -Number(expression.operand.text);
  }
  return null;
};

const isAnchorElement = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): boolean => {
  if (jsxTagName(node) === 'a') return true;
  return stringAttributeValue(jsxAttribute(node, 'component')) === 'a';
};

const primitiveHasRequiredAttribute = (
  entry: SourceEntry,
  name: string,
  expectedValue: string | number
): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    const opening = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening !== null && isAnchorElement(opening)) {
      const attribute = jsxAttribute(opening, name);
      if (attribute?.initializer) {
        if (typeof expectedValue === 'string' && stringAttributeValue(attribute) === expectedValue) {
          found = true;
        } else if (
          typeof expectedValue === 'number' &&
          numericAttributeValue(attribute) === expectedValue
        ) {
          found = true;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return found;
};

const findBrokenExternalLinkPrimitive = (entry: SourceEntry): readonly Finding[] => {
  if (entry.relativePath !== EXTERNAL_LINK_PATH) return [];

  const required: readonly (readonly [string, string | number])[] = [
    ['target', '_blank'],
    ['rel', 'noopener noreferrer'],
    ['tabIndex', -1],
  ];
  const missing = required.filter(([name, expectedValue]) => !primitiveHasRequiredAttribute(entry, name, expectedValue));

  if (missing.length === 0) return [];
  const { line, character } = entry.ast.getLineAndCharacterOfPosition(0);
  return [{
    position: { line: line + 1, column: character + 1 },
    message:
      `ExternalLink mangler den faste attribut ${missing.map(([name]) => `\`${name}\``).join(', ')}. `
      + 'Eksterne web-links skal åbne i ny fane og være ude af Tab-rækkefølgen.',
  }];
};

const findUnmanagedWebLinks = (entry: SourceEntry): readonly Finding[] => {
  if (!/\.tsx$/.test(entry.relativePath)) return [];
  if (entry.relativePath === EXTERNAL_LINK_PATH) return findBrokenExternalLinkPrimitive(entry);
  const isInternalLinkPrimitive = entry.relativePath === INTERNAL_LINK_PATH;

  const findings: Finding[] = [];
  const report = (node: ts.Node, message: string): void => {
    const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
    findings.push({
      position: { line: line + 1, column: character + 1 },
      message,
    });
  };

  const visit = (node: ts.Node): void => {
    const opening = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening !== null) {
      const href = jsxAttribute(opening, 'href');
      const target = jsxAttribute(opening, 'target');

      if (isAnchorElement(opening) && href && !isInternalLinkPrimitive) {
        const hrefValue = stringAttributeValue(href);
        if (hrefValue?.toLowerCase().startsWith('mailto:')) {
          // mailto åbner brugerens mailprogram, ikke en ekstern web-side, og er derfor ikke omfattet.
        } else {
          report(
            opening,
            'Web-link uden fælles link-primitive. Brug `ExternalLink` til en ekstern HTTP(S)-side '
              + 'eller `InternalLink` til en intern side; lokale target-/Tab-regler er ikke tilladt.'
          );
        }
      }

      if (href && target) {
        report(
          target,
          'Et web-link må ikke angive sit eget target. `ExternalLink` ejer `_blank`, mens `InternalLink` '
            + 'altid bliver i samme fane.'
        );
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(entry.ast);
  return findings;
};

export const webLinkPolicyRule = defineRule({
  id: 'a11y/web-link-policy-single-source',
  description:
    'Web-links skal bruge ExternalLink eller InternalLink. Eksterne links åbner i ny fane og har tabIndex=-1; interne links bliver i samme fane.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => hasIdentifier(entry, 'ExternalLink'),
    rationale:
      'reglen forudsætter, at ExternalLink stadig er den fælles primitive og bruges af de eksisterende eksterne web-linkflader',
    minimumMatches: 4,
    requiredPaths: [
      EXTERNAL_LINK_PATH,
      'src/components/layout/SiblingSitesFooter.tsx',
      'src/components/pages/satser/satserRows.tsx',
      'src/components/pages/Mineo.tsx',
    ],
  },
  find: findUnmanagedWebLinks,
  violatingFixtures: [
    {
      relativePath: 'src/components/pages/Links.tsx',
      code: '<Box component="a" href="https://example.test">Ekstern</Box>',
    },
    {
      relativePath: 'src/components/pages/Links.tsx',
      code: '<a href="/indstillinger" target="_blank">Indstillinger</a>',
    },
    {
      relativePath: EXTERNAL_LINK_PATH,
      code: 'const ExternalLink = () => <Typography component="a" href={href} />;',
    },
    {
      relativePath: INTERNAL_LINK_PATH,
      code: 'const InternalLink = () => <Box component="a" href={href} target="_blank" />;',
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/pages/Links.tsx',
      code: '<ExternalLink href="https://example.test">Ekstern</ExternalLink>',
    },
    {
      relativePath: 'src/components/pages/Links.tsx',
      code: '<InternalLink href="/indstillinger">Indstillinger</InternalLink>',
    },
    {
      relativePath: 'src/auth/LoginPage.tsx',
      code: '<a href="mailto:bel@fho.dk">Kontakt</a>',
    },
  ],
});
