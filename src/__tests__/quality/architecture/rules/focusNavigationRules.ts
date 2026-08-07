/**
 * Ejerskabsgrænsen for sidens fokus-traversering (greenfield #26).
 *
 * `Container` er «single owner» af fokus-traversering på en side
 * (`keyboard-navigation.md` §Cross-cutting contract). Efter #26 er selve navigationen
 * flyttet ud i `src/components/layout/containerNavigation/`, og `Container.tsx` er
 * reduceret til scroll-vært + `<main>`-landmark.
 *
 * Reglen findes, fordi den gamle form voksede organisk til det modsatte: ~440 af 584
 * linjer var fokus-logik i en fil, der hed «Container». Intet forhindrede den vækst, og
 * intet ville forhindre den igen — en enkelt `querySelectorAll(CONTAINER_FOCUSABLE_SELECTOR)`
 * i en layout-komponent er nok til at starte forfra med en andenudgave af traverseringen
 * ved siden af den kanoniske.
 *
 * Skæringen er på de PRIMITIVER, en konkurrerende traversering ville have brug for
 * (fokuserbar-selectoren, række-selectoren, tabel-kant-flaget), ikke på ordet «focus»:
 * et almindeligt `element.focus()` er ikke en traversering, og et værn der forbød det
 * ville støje uden at ramme mekanismen.
 */
import { forbidImports } from '../ruleKit';
import { hasAnyIdentifier } from '../astQueries';

/**
 * Modulerne der ejer traverseringen. Kun disse — og selectorernes eget hjem — må
 * forbruge fokus-traverserings-primitiverne.
 */
const FOCUS_TRAVERSAL_OWNERS: readonly string[] = [
  'src/components/layout/containerNavigation/useFocusableInventory.ts',
  'src/components/layout/containerNavigation/useContainerKeyboardNavigation.ts',
  // Grid'ets egen navigation er en BEVIDST anden autoritet inden for tabel-subtræet.
  // Grænsen mellem de to er kodet (`isInTableNavigation`, `markTableBoundaryExit`) og
  // beskrevet i kontrakten; den er ikke duplikering.
  'src/components/tables/gridCore/tableKeyboardNavigation.ts',
];

/**
 * `tableFocusHelpers.ts` står bevidst IKKE på listen: den DEFINERER primitiverne og
 * importerer dem derfor ikke. En post for den ville aldrig udløse reglen, og harnessens
 * anti-rot-kontrol ville med rette kalde den forældet.
 */

/** Primitiverne en konkurrerende fokus-traversering ville skulle bruge. */
const TRAVERSAL_PRIMITIVE_NAMES = [
  'CONTAINER_FOCUSABLE_SELECTOR',
  'CONTAINER_ROW_SELECTOR',
  'hasTableBoundaryExit',
  'markTableBoundaryExit',
] as const;

const TRAVERSAL_PRIMITIVES: ReadonlySet<string> = new Set(TRAVERSAL_PRIMITIVE_NAMES);

export const focusTraversalOwnershipRule = forbidImports({
  id: 'layout/focus-traversal-owned-by-container-navigation',
  description:
    'Fokus-traverserings-primitiverne (CONTAINER_FOCUSABLE_SELECTOR, CONTAINER_ROW_SELECTOR, tabel-kant-flaget) må kun forbruges af containerNavigation/ og grid-navigationen — ikke af layout- eller sidekomponenter.',
  liveTarget: {
    kind: 'precondition',
    // AST-baseret, ikke tekst: ellers kunne en kommentar, der blot OMTALER selectoren,
    // holde reglen kunstigt levende (harnessens R0-F02 fanger netop det).
    probe: (entry) => hasAnyIdentifier(entry, TRAVERSAL_PRIMITIVE_NAMES),
    rationale:
      'reglen forudsætter, at traverserings-primitiverne stadig findes og forbruges; forsvinder de, er der ingen grænse at håndhæve',
    // Selectorerne bor ét sted og forbruges af begge autoriteter: definitionsfilen plus
    // mindst inventaret og grid-navigationen. Gulvet gør det synligt, hvis vejen skrumper
    // til én rest — fx hvis nogen inlinede selectoren igen.
    minimumMatches: 3,
    requiredPaths: [
      'src/components/tables/gridCore/tableFocusHelpers.ts',
      'src/components/layout/containerNavigation/useFocusableInventory.ts',
      'src/components/layout/containerNavigation/useContainerKeyboardNavigation.ts',
    ],
  },
  allow: FOCUS_TRAVERSAL_OWNERS,
  forbidden: (ref) =>
    ref.moduleSpecifier.includes('tableFocusHelpers') &&
    ref.namedBindings.some((name) => TRAVERSAL_PRIMITIVES.has(name)),
  message: (ref) =>
    `Fokus-traverserings-primitiv importeret uden for containerNavigation/ (${ref.namedBindings.filter((name) => TRAVERSAL_PRIMITIVES.has(name)).join(', ')}). Sidens fokus-traversering ejes af src/components/layout/containerNavigation/ — byg ikke en parallel traversering. Se keyboard-navigation.md §Cross-cutting contract.`,
  violatingFixtures: [
    {
      relativePath: 'src/components/layout/Container.tsx',
      code: "import { CONTAINER_FOCUSABLE_SELECTOR } from '../tables/gridCore/tableFocusHelpers';",
    },
    {
      relativePath: 'src/components/pages/Aarsloen.tsx',
      code: "import { CONTAINER_ROW_SELECTOR, hasTableBoundaryExit } from '../tables/gridCore/tableFocusHelpers';",
    },
  ],
  cleanFixtures: [
    // De ufarlige hjælpere fra samme modul er ikke traverserings-primitiver.
    {
      relativePath: 'src/components/layout/Container.tsx',
      code: "import { focusTableElement, isTableElementVisible } from '../tables/gridCore/tableFocusHelpers';",
    },
    // Et almindeligt fokus-kald er ikke en traversering.
    {
      relativePath: 'src/components/pages/Aarsloen.tsx',
      code: 'const focusField = (el: HTMLElement) => el.focus({ preventScroll: true });',
    },
    {
      relativePath: 'src/components/layout/containerNavigation/useFocusableInventory.ts',
      code: "import { CONTAINER_FOCUSABLE_SELECTOR } from '../../tables/gridCore/tableFocusHelpers';",
    },
  ],
});

export const FOCUS_NAVIGATION_RULES = [focusTraversalOwnershipRule] as const;
