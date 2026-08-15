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
import ts from 'typescript';
import { defineRule, forbidImports, type Finding } from '../ruleKit';
import { collectCalls, hasAnyIdentifier, hasIdentifier } from '../astQueries';
import type { SourceEntry } from '../sourceGraph';

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
    // holde reglen kunstigt levende — hvilket harnessens liveness-selvtest fanger.
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

/**
 * Popup-fokus-restore har ÉN implementering (`keyboard-navigation.md` §Popup-fokus-restore).
 *
 * Regel: lukkes en popup, vender fokus tilbage til den kontrol, brugeren åbnede den med.
 * Reglen her håndhæver ikke selve adfærden — den håndhæver, at adfærden kun findes ÉT sted.
 *
 * Hvorfor et værn: den naive form ser rigtig ud og virker næsten. Et `element.focus()` i en
 * lukkehandler dækker Chrome, men fejler i WebKit (klik fokuserer ikke `<button>`, så der er
 * intet husket mål), ved `Escape` (fokus står på popupens egen container, ikke `body`) og ved
 * MUI's transition (portalen unmountes EFTER transitionen, så fokus falder til `body` bagefter).
 * Præcis de tre fælder blev løst én gang inde i `ConfirmationDialog` — og de tre håndrullede
 * overlays havde derefter hver sin egen mangel, fordi løsningen ikke var genbrugelig.
 *
 * Skæringen er på `focus()`-kald i en fil, der SELV ejer en popup (renderer en `Dialog`/`Modal`
 * eller sætter `role="dialog"`), og som ikke aftager den fælles hook. Et `focus()` i et felt, en
 * knap eller navigationen er ikke en popup-restore og rammes ikke.
 */
const DIALOG_FOCUS_RESTORE_HOOK = 'useDialogFocusRestore';

/** Den fælles overlay-adfærd; aftager selv `useDialogFocusRestore` indeni. */
const OVERLAY_BEHAVIOR_HOOK = 'useOverlayBehavior';

/**
 * Der er bevidst INGEN allowlist. Undtagelsen er indbygget i selve prædikatet: aftager filen
 * `useDialogFocusRestore`, ejer den ikke sin egen restore-vej, og dens øvrige `focus()`-kald
 * (fx fokus IND i overlayet ved åbning) er lovlige. En allowlist ville derfor bestå af poster,
 * der aldrig kan udløse reglen — præcis det harnessens anti-rot-kontrol med rette afviser.
 */

/** Markører for «denne fil ejer en popup-flade». */
const POPUP_OWNER_MARKERS = ['Dialog', 'Modal'] as const;

/**
 * Renderer filen en JSX-attribut `role="dialog"`?
 *
 * AST-baseret og IKKE `entry.text.includes('role="dialog"')`. Tekstformen kan ikke skelne kode fra
 * kommentar: en kommentar, der FORKLARER reglen — fx navigationens note om, at et inline
 * `role="dialog"`-overlay er en DOM-efterkommer — gjorde filen til en «popup-ejer» og udløste reglen
 * på dens almindelige `element.focus()`-kald. Prosa må ikke kunne ændre, hvad et værn måler.
 */
const rendersDialogRoleAttribute = (entry: SourceEntry): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'role') {
      const { initializer } = node;
      if (initializer && ts.isStringLiteral(initializer) && initializer.text === 'dialog') {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return found;
};

const ownsPopupSurface = (entry: SourceEntry): boolean => {
  if (!/\.tsx?$/.test(entry.relativePath)) return false;
  if (rendersDialogRoleAttribute(entry)) return true;
  return POPUP_OWNER_MARKERS.some((marker) => hasIdentifier(entry, marker));
};

/**
 * Aftager filen den fælles restore-vej? Enten DIREKTE gennem `useDialogFocusRestore`, eller gennem
 * `useOverlayBehavior`, som selv kalder den indeni og videregiver dens `restoreFocus`.
 *
 * Begge tæller, fordi garantien er den samme: der er ÉN implementering af restoren. Da overlays blev
 * samlet om det fælles regelsæt, flyttede indgangen — ikke mekanismen. En probe, der kun kendte det
 * gamle navn, ville erklære reglen inert, selv om den beskyttede præcis lige så meget som før.
 */
const consumesSharedFocusRestore = (entry: SourceEntry): boolean =>
  hasIdentifier(entry, DIALOG_FOCUS_RESTORE_HOOK) || hasIdentifier(entry, OVERLAY_BEHAVIOR_HOOK);

const findUnownedPopupFocusRestore = (entry: SourceEntry): readonly Finding[] => {
  if (!ownsPopupSurface(entry)) return [];
  // Aftager filen den fælles vej, ejer den ikke sin egen restore-vej.
  if (consumesSharedFocusRestore(entry)) return [];

  return collectCalls(entry)
    .filter((ref) => ref.calleeName === 'focus')
    .map((ref) => ({
      position: ref.position,
      message:
        `Popup-flade kalder selv \`${ref.calleeText}()\`. Fokus-restore ved lukning ejes af `
        + '`useDialogFocusRestore` (keyboard-navigation.md §Popup-fokus-restore) — byg ikke en '
        + 'parallel vej: et bart focus()-kald fejler i WebKit, ved Escape og ved MUI-transitionen.',
    }));
};

export const popupFocusRestoreSingleSourceRule = defineRule({
  id: 'layout/popup-focus-restore-single-source',
  description:
    'Fokus-restore ved lukning af en popup ejes af useDialogFocusRestore. En popup-flade må ikke føre sin egen focus()-restore-vej.',
  liveTarget: {
    kind: 'precondition',
    // AST-baseret: en kommentar der blot OMTALER hooken må ikke holde reglen kunstigt levende.
    probe: consumesSharedFocusRestore,
    rationale:
      'reglen forudsætter, at den fælles restore-vej findes og aftages — direkte eller gennem `useOverlayBehavior`; forsvinder den, er der ingen enkeltkilde at håndhæve',
    // Hooken, det fælles overlay-lag, plus de flader der aftager dem.
    minimumMatches: 4,
    requiredPaths: [
      'src/hooks/useDialogFocusRestore.ts',
      'src/hooks/useOverlayBehavior.ts',
      'src/components/ui/ConfirmationDialog.tsx',
      'src/components/ui/LicenseModal.tsx',
    ],
  },
  find: findUnownedPopupFocusRestore,
  violatingFixtures: [
    {
      relativePath: 'src/components/ui/SomeOverlay.tsx',
      code: 'const Overlay = () => { const close = () => { triggerRef.current?.focus(); }; return <Dialog onClose={close} />; };',
    },
    {
      relativePath: 'src/components/pages/SomePopup.tsx',
      code: 'const P = () => <div role="dialog" onKeyDown={() => { opener.focus(); }} />;',
    },
  ],
  cleanFixtures: [
    // Aftager den fælles hook — lovligt, uanset at filen også ejer en popup.
    {
      relativePath: 'src/components/ui/GoodOverlay.tsx',
      code: 'const O = () => { const { triggerRef } = useDialogFocusRestore({ open }); return <Dialog ref={triggerRef} />; };',
    },
    // Et almindeligt felt-fokus uden popup i filen er ikke en popup-restore.
    {
      relativePath: 'src/components/inputs/SomeField.tsx',
      code: 'const F = () => { const focusIt = () => inputRef.current?.focus(); return <input onBlur={focusIt} />; };',
    },
  ],
});

/**
 * En MUI-baseret popup, der selv genopretter fokus, skal slå MUI's egen restore fra.
 *
 * **Hvorfor reglen findes ved siden af `popup-focus-restore-single-source`.** Den regel fanger den
 * SYNLIGE parallelle vej: et `focus()`-kald i en fil, der ejer en popup uden at aftage den fælles
 * hook. Den er blind for den USYNLIGE: en `<Dialog>`, der aftager hooken korrekt, men glemmer
 * `disableRestoreFocus`. Dér er den konkurrerende vej ikke kode i filen — den er MUI's default.
 *
 * Det er værre end den synlige variant, netop fordi intet ser forkert ud: hooken er kaldt, kontrakten
 * ser overholdt ud, og MUI's restore kører SIDST og overskriver målet uden at noget fejler. Tre
 * dialoger stod i præcis den tilstand (fejlrapport fra indholdsbokse, fejlrapport-knappen og
 * ErrorFallbacks genindlæsningsbekræftelse), mens `ConfirmationDialog` — den ene, nogen havde
 * fejlsøgt — bar flaget.
 *
 * Kontrakten krævede det i forvejen (`keyboard-navigation.md` §Popup-fokus-restore: «En MUI-baseret
 * popup skal sætte `disableRestoreFocus`»), men intet målte det.
 *
 * **Skæringen** er snæver med vilje: kun filer, der BÅDE renderer et `<Dialog>` OG aftager
 * `useDialogFocusRestore`. En dialog uden egen restore har ingen konkurrerende vej, og MUI's default
 * er da det rigtige svar — den skal ikke tvinges til at slå den fra.
 */
const findMuiDialogWithoutRestoreOptOut = (entry: SourceEntry): readonly Finding[] => {
  if (!/\.tsx$/.test(entry.relativePath)) return [];
  // Kun filer med en EGEN restore-vej: uden den er MUI's default ikke en konkurrent.
  if (!consumesSharedFocusRestore(entry)) return [];

  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    const opening = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening !== null && ts.isIdentifier(opening.tagName) && opening.tagName.text === 'Dialog') {
      const optsOut = opening.attributes.properties.some((property) => {
        // `{...props}` kan bære flaget, reglen ikke kan se. Vær tavs frem for at støje.
        if (ts.isJsxSpreadAttribute(property)) return true;
        if (!ts.isJsxAttribute(property)) return false;
        return ts.isIdentifier(property.name) && property.name.text === 'disableRestoreFocus';
      });
      if (!optsOut) {
        const { line, character } = entry.ast.getLineAndCharacterOfPosition(opening.getStart(entry.ast));
        findings.push({
          position: { line: line + 1, column: character + 1 },
          message:
            'MUI `<Dialog>` i en fil, der selv fører fokus-restore gennem `useDialogFocusRestore`, mangler '
            + '`disableRestoreFocus`. MUI genopretter da SELV fokus til det element, der var aktivt ved '
            + 'åbningen, og den kører sidst — så den overskriver kontraktens målprioritet uden at noget '
            + 'fejler (`keyboard-navigation.md` §Popup-fokus-restore). Se `ConfirmationDialog`.',
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return findings;
};

export const muiDialogRestoreOptOutRule = defineRule({
  id: 'layout/mui-dialog-disables-own-focus-restore',
  description:
    'En MUI-Dialog, hvis fil selv fører fokus-restore, skal sætte disableRestoreFocus, så MUI ikke overskriver målet.',
  liveTarget: {
    kind: 'precondition',
    probe: consumesSharedFocusRestore,
    rationale:
      'reglen forudsætter, at den fælles restore-vej findes og aftages af MUI-baserede dialoger — '
      + 'direkte eller gennem `useOverlayBehavior`; forsvinder den, er der ingen konkurrerende vej at lukke',
    minimumMatches: 4,
    requiredPaths: ['src/components/ui/ConfirmationDialog.tsx'],
  },
  find: findMuiDialogWithoutRestoreOptOut,
  violatingFixtures: [
    {
      relativePath: 'src/components/ui/LeakyDialog.tsx',
      code: 'const D = () => { const { triggerRef } = useDialogFocusRestore({ open }); '
        + 'return <Dialog open={open} onClose={close}><span ref={triggerRef} /></Dialog>; };',
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/ui/GoodDialog.tsx',
      code: 'const D = () => { const { triggerRef } = useDialogFocusRestore({ open }); '
        + 'return <Dialog open={open} disableRestoreFocus><span ref={triggerRef} /></Dialog>; };',
    },
    // Ingen egen restore-vej ⇒ MUI's default er det rigtige svar, og reglen er tavs.
    {
      relativePath: 'src/components/ui/PlainDialog.tsx',
      code: 'const D = () => <Dialog open={open} onClose={close} />;',
    },
  ],
});

/**
 * Ethvert overlay aftager den fælles overlay-adfærd.
 *
 * **Hvorfor.** Der fandtes seks overlay-flader og lige så mange delvise løsninger: tre forskellige
 * måder at lytte på Escape (window-lytter, capture+boble-par, MUI's `onClose`), ingen fælles
 * lukkekontrakt, og INGEN af dem kendte browserens/musens tilbage-knap. En flade kunne se komplet
 * ud og alligevel mangle en lukkevej, uden at noget fejlede.
 *
 * Værre: forskellen mellem en PORTALERET og en INLINE monteret popup afgjorde, om sidens
 * tastaturnavigation overtog Tab inde i vinduet — og den forskel var tilfældig, ikke valgt.
 * `useOverlayBehavior` gør åbenhed til noget overlayet SIGER (markøren), så begge monteringsformer
 * opfører sig ens.
 *
 * **Skæringen** er en fil, der ejer en overlay-flade (`role="dialog"` eller en `<Dialog>`), og som
 * IKKE aftager `useOverlayBehavior`. Toasts og ikke-modale notitser rammes ikke: de bærer
 * `role="alert"`/`role="status"`, ikke `role="dialog"`.
 */

/** Filer der ejer en overlay-flade uden at være et overlay i kontraktens forstand. */
const OVERLAY_RULE_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  // Definerer selve markøren og de rene beslutninger; aftager ikke sin egen React-hook.
  'src/components/ui/overlayBehavior.ts',
  // ER hooken.
  'src/hooks/useOverlayBehavior.ts',
  // `StyledDropdown`s `Popover` er en popup-WIDGET, ikke et modalt overlay: fokus skal bevidst blive
  // på comboboxen (`disableEnforceFocus`), og dens Escape ejes af feltets egen tastelogik. Et
  // overlay-regelsæt ovenpå ville slå den adfærd i stykker.
  'src/components/inputs/StyledDropdown.tsx',
]);

const findOverlayWithoutSharedBehavior = (entry: SourceEntry): readonly Finding[] => {
  if (!/\.tsx$/.test(entry.relativePath)) return [];
  if (OVERLAY_RULE_EXEMPT_PATHS.has(entry.relativePath)) return [];
  // Ejer filen en MODAL overlay-flade? `Dialog`-identifikatoren eller en eksplicit dialog-rolle.
  // AST-baseret af samme grund som `ownsPopupSurface`: en kommentar om reglen må ikke udløse den.
  const ownsOverlay = rendersDialogRoleAttribute(entry) || hasIdentifier(entry, 'Dialog');
  if (!ownsOverlay) return [];
  if (hasIdentifier(entry, OVERLAY_BEHAVIOR_HOOK)) return [];

  const { line, character } = entry.ast.getLineAndCharacterOfPosition(0);
  return [{
    position: { line: line + 1, column: character + 1 },
    message:
      'Overlay-flade uden `useOverlayBehavior`. Programmets overlays deler ÉT regelsæt for tastatur og '
      + 'lukkeveje (`keyboard-navigation.md` §Overlay-adfærd): Escape, backdrop, lukkeknap OG browserens/'
      + 'musens tilbage-knap, plus stak-disciplin når overlays ligger oven på hinanden. En flade må ikke '
      + 'implementere sin egen delmængde — det var netop sådan, tilbage-knappen manglede overalt og Tab '
      + 'kunne slippe ud af et inline-monteret vindue.',
  }];
};

export const overlaySharedBehaviorRule = defineRule({
  id: 'layout/overlay-uses-shared-behavior',
  description:
    'Enhver overlay-flade (role="dialog" eller MUI Dialog) skal aftage useOverlayBehavior, så tastatur- og lukkeregler er ens.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => hasIdentifier(entry, OVERLAY_BEHAVIOR_HOOK),
    rationale:
      'reglen forudsætter, at den fælles overlay-hook findes og aftages; forsvinder den, er der intet fælles regelsæt at håndhæve',
    // Hooken plus de seks overlay-flader.
    minimumMatches: 5,
    requiredPaths: [
      'src/hooks/useOverlayBehavior.ts',
      'src/components/ui/ConfirmationDialog.tsx',
      'src/components/ui/LicenseModal.tsx',
    ],
  },
  find: findOverlayWithoutSharedBehavior,
  violatingFixtures: [
    {
      relativePath: 'src/components/ui/LonelyOverlay.tsx',
      code: 'const O = () => <div role="dialog" aria-modal="true"><button>Luk</button></div>;',
    },
    {
      relativePath: 'src/components/ui/LonelyDialog.tsx',
      code: 'const D = () => <Dialog open={open} onClose={close}><span /></Dialog>;',
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/ui/GoodOverlay.tsx',
      code: 'const O = () => { const { overlayRootProps } = useOverlayBehavior({ open, onClose }); '
        + 'return <div role="dialog" {...overlayRootProps} />; };',
    },
    // En toast er ikke et overlay: den fanger ikke fokus og har ingen backdrop.
    {
      relativePath: 'src/components/ui/SomeToast.tsx',
      code: 'const T = () => <div role="alert">Fejl</div>;',
    },
  ],
});

/**
 * Blink-markeringen sættes KUN af `blinkFieldAttention` — aldrig deklarativt fra React-state.
 *
 * **Hvorfor det er en regel og ikke bare en konvention.** En «peg på dette felt»-markering er en
 * TRANSIENT respons: den skal komme igen, hver gang brugeren udløser den. Sættes klassen derimod
 * deklarativt ud fra state, dør gentagelsen lydløst — anden gang skrives den SAMME værdi, React
 * bailer ud af re-renderen, og der sker intet synligt. Ingen test fejler; brugeren tror bare, at
 * programmet ignorerer dem.
 *
 * Præcis det skete i løntabellen: en afvist «Omregning til fuldt år» blinkede kun ved FØRSTE klik.
 * Målt med `animationstart` gav tre klik 1, 1, 1 — efter rettelsen 1, 2, 3.
 *
 * Helperen ejer genstarten (fjern klasse → tving reflow → sæt igen) og oprydningen. Den er
 * desuden det ene sted, varigheden og `prefers-reduced-motion`-hensynet kan ændres.
 *
 * Skæringen er snæver: kun selve klasse-KONSTANTEN og dens strengværdi uden for helper-modulet.
 */
const BLINK_CLASS_CONSTANT = 'FIELD_ATTENTION_BLINK_CLASS';
const BLINK_CLASS_LITERAL = 'mineo-field-attention-blink';
const BLINK_HELPER_MODULE = 'src/inputCore/react/fieldAttentionBlink.ts';

const findDeclarativeBlinkClassUse = (entry: SourceEntry): readonly Finding[] => {
  if (!/\.tsx?$/.test(entry.relativePath)) return [];
  // Helper-modulet DEFINERER klassen og sætter den — det er hele pointen med det.
  if (entry.relativePath === BLINK_HELPER_MODULE) return [];

  const findings: Finding[] = [];
  const visit = (node: ts.Node): void => {
    const isConstantRef = ts.isIdentifier(node) && node.text === BLINK_CLASS_CONSTANT;
    const isLiteralRef = ts.isStringLiteral(node) && node.text === BLINK_CLASS_LITERAL;
    if (isConstantRef || isLiteralRef) {
      const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
      findings.push({
        position: { line: line + 1, column: character + 1 },
        message:
          'Blink-klassen bruges uden for `blinkFieldAttention`. En «peg på dette felt»-markering skal '
          + 'sættes gennem helperen, som GENSTARTER animationen. Sættes klassen deklarativt fra state, '
          + 'er en gentagen markering på samme mål et no-op: React skriver samme værdi, re-renderen '
          + 'udebliver, og brugeren får intet svar anden gang.',
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(entry.ast);
  return findings;
};

export const attentionBlinkSingleSourceRule = defineRule({
  id: 'layout/attention-blink-applied-by-helper',
  description:
    'Blink-markeringen må kun sættes af blinkFieldAttention, så en gentagen markering altid genstarter animationen.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => hasIdentifier(entry, 'blinkFieldAttention'),
    rationale:
      'reglen forudsætter, at den delte blink-helper findes og aftages; forsvinder den, er der ingen enkeltkilde at håndhæve',
    // Helperen plus de flader, der peger på et felt.
    minimumMatches: 3,
    requiredPaths: [BLINK_HELPER_MODULE],
  },
  find: findDeclarativeBlinkClassUse,
  violatingFixtures: [
    {
      relativePath: 'src/components/tables/SomeTable.tsx',
      code: 'const cls = (id: string) => (marked === id ? FIELD_ATTENTION_BLINK_CLASS : undefined);',
    },
    {
      relativePath: 'src/components/pages/SomePage.tsx',
      code: "const cls = isMarked ? 'mineo-field-attention-blink' : '';",
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/tables/GoodTable.tsx',
      code: 'const point = (el: HTMLElement) => { blinkFieldAttention(el); };',
    },
  ],
});

export const FOCUS_NAVIGATION_RULES = [
  focusTraversalOwnershipRule,
  popupFocusRestoreSingleSourceRule,
  muiDialogRestoreOptOutRule,
  overlaySharedBehaviorRule,
  attentionBlinkSingleSourceRule,
] as const;
