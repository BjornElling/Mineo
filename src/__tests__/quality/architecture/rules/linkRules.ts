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

/**
 * Den ENESTE fil der må sammensætte et eksternt web-link i hånden.
 *
 * `UnsupportedDevicePage` er hard-stop-siden for mobil/tablet (AGENTS.md «Desktop-only gate»).
 * Den er bevidst isoleret fra app-shellen: bootstrap-stien renderer den UDEN app-stylesheet,
 * UDEN MUI-tema og uden nogen anden import end React — kun to Montserrat-vægte hentes. At bruge
 * `ExternalLink` her ville trække hele `@mui/material` ind i netop den entry-chunk, som enhver
 * mobilbruger downloader, før de får at vide, at siden ikke virker på deres enhed.
 *
 * De to policy-krav, primitiven findes for, er OPFYLDT i hånden på callsitet:
 * `target="_blank"` + `rel="noopener noreferrer"`. Kun `tabIndex={-1}` er bevidst udeladt —
 * den regel findes for ikke at forurene PROGRAMMETS tastaturrækkefølge, og der er intet program
 * på hard-stop-siden. Linkene er tværtimod brugerens eneste vej videre og skal kunne tabbes.
 *
 * Anti-rot-kontrollen i harnesset fjerner posten igen, hvis filen holder op med at udløse reglen.
 */
const RAW_WEB_LINK_ALLOWLIST: readonly string[] = [
  'src/components/system/UnsupportedDevicePage.tsx',
];

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

/**
 * `href`ens KENDTE præfiks — nok til at afgøre, om linket overhovedet er en web-side.
 *
 * `stringAttributeValue` kræver en ren strengliteral og bruges bevidst uændret til de EXAKTE
 * `target`/`rel`-sammenligninger. Men et `href` sammensat af en konstant
 * (`` href={`mailto:${ADRESSE}`} `` ) er stadig utvetydigt et mailto-link, og reglen må ikke
 * tvinge adressen til at stå to gange i kilden for at kunne genkendes.
 */
const hrefPrefix = (attribute: ts.JsxAttribute | undefined): string | null => {
  const initializer = attribute?.initializer;
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    const { expression } = initializer;
    if (ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
    // Kun template-literalens FASTE hoved (`mailto:` i `` `mailto:${adresse}` ``) er kendt.
    if (ts.isTemplateExpression(expression)) return expression.head.text;
  }
  return null;
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

/**
 * Fundene for en allowlistet fil: den slipper for primitive-kravet, men IKKE for de to
 * sikkerhedsattributter. Uden dette ville allowlisten være et hul frem for en afgrænset
 * undtagelse — en `rel`-løs `target="_blank"` er præcis den tabnabbing-risiko, `ExternalLink`
 * findes for at lukke.
 */
const findUnsafeRawExternalLinks = (entry: SourceEntry): readonly Finding[] => {
  const findings: Finding[] = [];

  const visit = (node: ts.Node): void => {
    const opening = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening !== null && isAnchorElement(opening)) {
      const hrefValue = hrefPrefix(jsxAttribute(opening, 'href'));
      if (hrefValue !== null && /^https?:/i.test(hrefValue)) {
        const missing = ([
          ['target', '_blank'],
          ['rel', 'noopener noreferrer'],
        ] as const).filter(
          ([name, expected]) => stringAttributeValue(jsxAttribute(opening, name)) !== expected
        );

        if (missing.length > 0) {
          const { line, character } = entry.ast.getLineAndCharacterOfPosition(opening.getStart(entry.ast));
          findings.push({
            position: { line: line + 1, column: character + 1 },
            message:
              `Håndsammensat eksternt web-link mangler ${missing.map(([name]) => `\`${name}\``).join(', ')}. `
              + 'Filen er undtaget fra primitive-kravet, men ikke fra sikkerhedskravet: '
              + '`target="_blank"` uden `rel="noopener noreferrer"` er en tabnabbing-risiko.',
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(entry.ast);
  return findings;
};

const findUnmanagedWebLinks = (entry: SourceEntry): readonly Finding[] => {
  if (!/\.tsx$/.test(entry.relativePath)) return [];
  if (entry.relativePath === EXTERNAL_LINK_PATH) return findBrokenExternalLinkPrimitive(entry);
  if (RAW_WEB_LINK_ALLOWLIST.includes(entry.relativePath)) return findUnsafeRawExternalLinks(entry);
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
        const hrefValue = hrefPrefix(href);
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
    'Web-links skal bruge ExternalLink eller InternalLink. Eksterne links åbner i ny fane og har tabIndex=-1; interne links bliver i samme fane. '
    + 'Hard-stop-siden (UnsupportedDevicePage) må sammensætte i hånden for at holde MUI ude af mobilens entry-chunk, men skal stadig bære target+rel.',
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
    // Et web-link må ikke kunne slippe uden om primitive-kravet ved at bygge sit href
    // af en template-literal.
    {
      relativePath: 'src/components/pages/Links.tsx',
      code: '<Box component="a" href={`https://example.test/${slug}`}>Ekstern</Box>',
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
    // Undtagelsen er afgrænset, ikke et hul: den allowlistede fil skal stadig bære begge
    // sikkerhedsattributter. Uden `rel` er linket en tabnabbing-risiko, også her.
    {
      relativePath: 'src/components/system/UnsupportedDevicePage.tsx',
      code: '<a href="https://minprocesrente.dk" target="_blank">minProcesrente.dk</a>',
    },
    {
      relativePath: 'src/components/system/UnsupportedDevicePage.tsx',
      code: '<a href="https://minprocesrente.dk" rel="noopener noreferrer">minProcesrente.dk</a>',
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
    // Et mailto sammensat af en konstant er stadig et mailto — adressen skal kunne stå ét sted.
    {
      relativePath: 'src/components/layout/SiblingSitesFooter.tsx',
      code: '<Box component="a" href={`mailto:${SIBLING_SITES_CONTACT_EMAIL}`}>Kontakt</Box>',
    },
    // Hard-stop-siden må sammensætte i hånden — når begge sikkerhedsattributter er på plads.
    {
      relativePath: 'src/components/system/UnsupportedDevicePage.tsx',
      code: '<a href="https://minprocesrente.dk" target="_blank" rel="noopener noreferrer">minProcesrente.dk</a>',
    },
    // ... men undtagelsen gælder KUN den ene fil.
    {
      relativePath: 'src/components/system/OtherSystemPage.tsx',
      code: '<ExternalLink href="https://minprocesrente.dk">minProcesrente.dk</ExternalLink>',
    },
  ],
});
