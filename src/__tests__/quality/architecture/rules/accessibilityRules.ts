/**
 * Tilgængeligt navn på interaktive kontroller.
 *
 * **Hvad reglen dækker – og hvorfor den findes ved siden af typesystemet.** Navnekravet håndhæves
 * primært af typerne: `StyledToggleSwitch`, `ToggleField` og `MappedToggleField` tager et
 * `AccessibleNameProps`-union, så en navnløs toggle ikke kan type-checke. Typerne rækker imidlertid
 * kun til VORES egne komponenter. En rå `<button>`, en MUI `<IconButton>` eller en `<Fab>` med kun
 * et ikon som barn er ægte JSX uden vores props – dér ville en navnløs kontrol slippe igennem
 * præcis som før.
 *
 * Netop den art fandtes i sidemenuen: hamburger-knappen var en `<Button>` med et `MenuIcon` og en
 * kommentar «Ingen tekst». Reglen lukker den vej strukturelt, så det tredje lag
 * (type → AST → runtime-invariant) tilsammen dækker alle veje til en navnløs kontrol.
 *
 * **Skæringen.** Reglen flager en interaktiv JSX-kontrol, der hverken har
 * - et `aria-label` / `aria-labelledby` / `title`,
 * - eller et tekstbarn (literal, `{...}`-udtryk eller en tekstbærende prop som `label`).
 *
 * Et `<Tooltip>` udenom TÆLLER IKKE som navn: MUI sætter `aria-labelledby` på selve popper-elementet,
 * som kun eksisterer mens tooltippen er åben. En skærmlæser, der lander på knappen uden at hovere,
 * får derfor intet navn – hvilket er nøjagtig den fejl, auditen observerede på flere ikon-knapper.
 *
 * Reglen er bevidst KONSERVATIV: den flager kun kontroller, hvor der hverken direkte eller i et
 * indlejret barn findes tekst eller en navngivende prop. Så snart der er tekst i spil – eller navnet
 * kommer fra et udtryk, reglen ikke kan evaluere statisk – er den tavs. Formålet er at fange den
 * navnløse ikonknap uden at støje på hver almindelig tekstknap.
 */
import ts from 'typescript';
import { defineRule, type Finding } from '../ruleKit';
import type { SourceEntry } from '../sourceGraph';

/**
 * Elementer, der ER en interaktiv kontrol.
 *
 * Kun kontroller, hvor et manglende navn faktisk er et tilgængelighedsproblem. Vores egne
 * felt-komponenter står ikke på listen: deres navnekrav er allerede håndhævet af typesystemet, og en
 * post her ville duplikere kravet i to konkurrerende former.
 */
const INTERACTIVE_ELEMENTS: ReadonlySet<string> = new Set([
  'button',
  'Button',
  'IconButton',
  'Fab',
  'ToggleButton',
  'Checkbox',
  'Switch',
  'Radio',
]);

/** Props, der giver kontrollen et tilgængeligt navn. */
const NAME_ATTRIBUTES: ReadonlySet<string> = new Set([
  'aria-label',
  'aria-labelledby',
  'title',
  'label',
  'ariaLabel',
  'visibleLabel',
  'labelledBy',
  'inputProps',
  'slotProps',
]);

const jsxTagName = (node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string => {
  const { tagName } = node;
  if (ts.isIdentifier(tagName)) return tagName.text;
  // `<Foo.Bar>` – brug det sidste led, så et namespaced MUI-alias stadig matcher.
  if (ts.isPropertyAccessExpression(tagName)) return tagName.name.text;
  return '';
};

const hasNamingAttribute = (attributes: ts.JsxAttributes): boolean =>
  attributes.properties.some((property) => {
    // `{...props}` kan bære et navn, reglen ikke kan se. Vær tavs frem for at støje.
    if (ts.isJsxSpreadAttribute(property)) return true;
    if (!ts.isJsxAttribute(property)) return false;
    const name = ts.isIdentifier(property.name) ? property.name.text : property.name.namespace.text
      ? `${property.name.namespace.text}:${property.name.name.text}`
      : property.name.name.text;
    return NAME_ATTRIBUTES.has(name);
  });

/**
 * Har elementet tekstindhold, der kan blive dets navn?
 *
 * Søgningen går REKURSIVT ned i børnene, fordi et navn lige så gyldigt kan ligge i et indlejret
 * element som direkte i knappen. `ScrollToTopButton` bruger netop den form: et `aria-hidden` ikon
 * plus en visuelt skjult `<span>` med teksten – bevidst valgt frem for `aria-label`, som browseren
 * ville vise som en hover-tooltip. En ikke-rekursiv kontrol ville flage den knap som navnløs, selv om
 * den er korrekt navngivet, og reglen ville presse en ellers rigtig løsning væk.
 *
 * Et `{udtryk}` tæller også: reglen kan ikke afgøre statisk, om det bliver til tekst, og en falsk
 * positiv på hver dynamisk knaptekst ville gøre reglen ubrugelig.
 *
 * `aria-hidden`-elementer springes over: de er eksplicit fjernet fra accessibility-træet og kan pr.
 * definition ikke bidrage med et navn. Uden den undtagelse ville et ikon med `aria-hidden` og et
 * tekstbærende `<title>`-barn kunne maskere en ellers navnløs knap.
 */
const isAriaHidden = (attributes: ts.JsxAttributes): boolean =>
  attributes.properties.some(
    (property) =>
      ts.isJsxAttribute(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'aria-hidden'
  );

const hasTextContent = (children: ts.NodeArray<ts.JsxChild>): boolean =>
  children.some((child) => {
    if (ts.isJsxText(child)) return child.text.trim() !== '';
    if (ts.isJsxExpression(child)) {
      // `{/* kommentar */}` er et tomt udtryk – netop formen sidemenuens navnløse knap havde.
      return child.expression !== undefined;
    }
    if (ts.isJsxElement(child)) {
      if (isAriaHidden(child.openingElement.attributes)) return false;
      // Et indlejret element kan selv bære navnet (fx visuelt skjult tekst i et <span>).
      return hasNamingAttribute(child.openingElement.attributes) || hasTextContent(child.children);
    }
    if (ts.isJsxSelfClosingElement(child)) {
      if (isAriaHidden(child.attributes)) return false;
      return hasNamingAttribute(child.attributes);
    }
    if (ts.isJsxFragment(child)) return hasTextContent(child.children);
    return false;
  });

/** Renderer filen overhovedet en interaktiv kontrol? Bruges som AST-baseret liveness-probe. */
const hasInteractiveControlElement = (entry: SourceEntry): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isJsxSelfClosingElement(node) && INTERACTIVE_ELEMENTS.has(jsxTagName(node))) {
      found = true;
      return;
    }
    if (ts.isJsxElement(node) && INTERACTIVE_ELEMENTS.has(jsxTagName(node.openingElement))) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return found;
};

const findUnnamedControls = (entry: SourceEntry): readonly Finding[] => {
  const findings: Finding[] = [];

  const report = (node: ts.Node, tag: string): void => {
    const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
    findings.push({
      position: { line: line + 1, column: character + 1 },
      message:
        `<${tag}> er en interaktiv kontrol uden tilgængeligt navn: den har hverken aria-label, ` +
        'aria-labelledby, title eller et tekstbarn. En skærmlæser og rolle-/navn-navigation kan ikke ' +
        'identificere den. Et <Tooltip> udenom tæller ikke – MUI sætter kun aria-labelledby på ' +
        'popper\'en, mens tooltippen er åben. Tilføj aria-label, eller brug LabeledControlRow. ' +
        'Se src/components/inputs/accessibleName.ts.',
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node)) {
      const tag = jsxTagName(node);
      // Selvlukkende: der ER ingen børn, så navnet skal komme fra en prop.
      if (INTERACTIVE_ELEMENTS.has(tag) && !hasNamingAttribute(node.attributes)) {
        report(node, tag);
      }
    } else if (ts.isJsxElement(node)) {
      const tag = jsxTagName(node.openingElement);
      if (
        INTERACTIVE_ELEMENTS.has(tag) &&
        !hasNamingAttribute(node.openingElement.attributes) &&
        !hasTextContent(node.children)
      ) {
        report(node.openingElement, tag);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(entry.ast);
  return findings;
};

export const interactiveControlHasAccessibleNameRule = defineRule({
  id: 'a11y/interactive-control-has-accessible-name',
  description:
    'Interaktive kontroller (button, IconButton, Fab, Switch, Checkbox, Radio) skal have et tilgængeligt navn – aria-label, aria-labelledby, title eller et tekstbarn. Et Tooltip udenom er ikke et navn.',
  liveTarget: {
    kind: 'precondition',
    // Reglen forudsætter, at der stadig RENDERES interaktive kontroller. Forsvinder de, er den inert.
    // AST-baseret, ikke tekst: en udkommenteret fil må ikke kunne holde reglen kunstigt levende –
    // harnessets liveness-selvtest kontrollerer netop det.
    probe: (entry) => hasInteractiveControlElement(entry),
    rationale:
      'reglen forudsætter, at kildegrafen stadig renderer interaktive kontroller; findes de ikke, er der intet navnekrav at håndhæve',
    minimumMatches: 5,
    requiredPaths: [
      'src/components/layout/SideMenu.tsx',
      'src/components/layout/ContentBox.tsx',
      'src/components/pages/indstillinger/DefaultDirectoryRow.tsx',
    ],
  },
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/') && !relativePath.includes('__tests__'),
  find: (entry) => findUnnamedControls(entry),
  violatingFixtures: [
    {
      // Præcis den form, en navnløs ikon-knap har: kun et ikon og en kommentar som «indhold».
      relativePath: 'src/components/layout/SideMenu.tsx',
      code: 'const M = () => <Button onClick={toggle} startIcon={<MenuIcon />}>{/* Ingen tekst */}</Button>;',
    },
    {
      // Tooltip udenom er ikke et navn – knappen selv er stadig navnløs.
      relativePath: 'src/components/pages/indstillinger/DefaultDirectoryRow.tsx',
      code: 'const R = () => <Tooltip title="Vælg mappe"><IconButton onClick={pick}><FolderOpenIcon /></IconButton></Tooltip>;',
    },
    {
      relativePath: 'src/components/layout/ContentBox.tsx',
      code: 'const F = () => <Fab size="small" onClick={open}><BugReportIcon /></Fab>;',
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/layout/SideMenu.tsx',
      code: 'const M = () => <Button onClick={toggle} aria-label="Fold menuen ud" startIcon={<MenuIcon />} />;',
    },
    {
      // Tekstbarn er et fuldgyldigt navn.
      relativePath: 'src/auth/LoginPage.tsx',
      code: 'const L = () => <button type="submit">Log ind</button>;',
    },
    {
      // Dynamisk tekst kan reglen ikke evaluere statisk – den skal være tavs, ikke gætte.
      relativePath: 'src/components/pages/erhvervsevnetab/EetIssuesBox.tsx',
      code: 'const N = () => <Button onClick={go}>{navigation.sectionName}</Button>;',
    },
    {
      relativePath: 'src/components/inputs/DownloadIconButton.tsx',
      code: 'const D = () => <IconButton aria-label={tooltip}><DownloadIcon /></IconButton>;',
    },
    {
      // Visuelt skjult tekst er et fuldgyldigt navn – og er her et BEVIDST valg frem for aria-label,
      // fordi browseren ville vise et aria-label som hover-tooltip. Reglen må ikke presse den væk.
      relativePath: 'src/components/ui/ScrollToTopButton.tsx',
      code: 'const S = () => <Fab onClick={up}><Box component="svg" aria-hidden="true" /><Box component="span" sx={visuallyHidden}>Scroll til toppen</Box></Fab>;',
    },
  ],
});

export const ACCESSIBILITY_RULES = [interactiveControlHasAccessibleNameRule] as const;
