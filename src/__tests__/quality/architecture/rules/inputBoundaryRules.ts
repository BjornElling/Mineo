/**
 * Inputgrænser og legacy-fravær.
 *
 * Skrivegrænsen, den rå sektionsadgang, systemportens producentliste, de transiente controls og
 * forbudt-identifier-gaten. Kernen i §3.6's capability-opdeling.
 *
 * Del af det koncern-opdelte arkitekturmanifest: storage-, input-, domæne-, UI- og dokumentregler bor
 * hver for sig, så en regel og dens nabo hører til samme emne. `architectureRules.ts` samler de fem
 * moduler til ét registry.
 */
import ts from 'typescript';
import {
  collectCallTypeArguments,
  collectCalls,
  collectDestructuredProperties,
  collectElementAccess,
  collectIdentifiers,
  collectImports,
  collectLocalTypeAliases,
  collectMemberAccess,
  collectTypeAssertions,
  hasAnyIdentifier,
  hasDeclaredMember,
  hasIdentifier,
  hasJsxAttribute,
  hasMemberRead,
} from '../astQueries';
import { defineRule, forbidImports, type Finding } from '../ruleKit';

// --- Skrivegrænsen: kun runneren skriver input (§3.6) -------------------------

/**
 * PRIMÆRVÆRNET er STRUKTUREN, ikke denne regel.
 *
 * Skrivegrænsen var tidligere et brandet vidne (`InputWriteAuthority`) oven på en fortsat OFFENTLIG
 * Zustand-`StoreApi`. Det var den forkerte rækkefølge: capabilityen `setState` blev ved med at være
 * tilgængelig, og et AST-værn skulle holde den lukket. Værnet kunne omgås af et alias, en aliaseret
 * type-assertion eller et direkte `store.setState(...)` — præcis de tre huller, reviewet påviste.
 *
 * Rettelsen er at fjerne muligheden i stedet for at bevogte den: `SlimInputStore` er rent læsbar,
 * mens runneren alene har de registrerede mutatorer. Zustands `StoreApi` forlader aldrig
 * `slimInputStore.ts`.
 *
 * Reglen dækker de to rester, strukturen ikke selv kan udtale sig om:
 *
 *   1. **Genindførsel af den rå store.** Importerer nogen `zustand` uden for de to moduler, der
 *      legitimt ejer en store, er der ved at opstå en ny, ubevogtet inputvej.
 *   2. **Produktionsbrug af testfabrikken.** `__createSlimInputTestStore` bygger en isoleret runtime;
 *      i produktionskode ville et kald være en anden samtidig sandhed om, hvilken sag der er aktiv.
 *
 * Allowlisten er tom med vilje: en undtagelse ville være en anden samtidig sandhed om, hvem der ejer
 * input — samme begrundelse som `input/deleted-legacy-architecture-import`.
 */
/** Modulet der ejer den mutable input-store. Kun her må Zustand importeres til inputformål. */
const INPUT_STORE_OWNER = 'src/inputCore/runtime/slimInputStore.ts';

/** Moduler der legitimt ejer en Zustand-store (input-runtime + gridets rene UI-state). */
const ZUSTAND_STORE_OWNERS: readonly string[] = [
  INPUT_STORE_OWNER,
];

export const inputWriteBoundary = defineRule({
  id: 'input/write-boundary',
  description:
    'Kun runneren skriver input (§3.6). Grænsen er STRUKTUREL: `SlimInputStore` er rent læsbar, '
    + 'og Zustands `StoreApi` (og dermed `setState`) forlader aldrig '
    + '`slimInputStore.ts`. Reglen dækker resterne: en nyimporteret rå Zustand-store til input, og '
    + 'produktionsbrug af den isolerede testfabrik.',
  liveTarget: {
    kind: 'precondition',
    // AST-signal, ikke tekst: skrivevejenes NAVNE skal findes som identifiers, ikke blot omtales.
    probe: (entry) => entry.relativePath === INPUT_STORE_OWNER
      || hasAnyIdentifier(entry, ['registerSlimInputStoreInternals', 'hydrateInputStoreOnce', 'dispatchInput']),
    rationale:
      'skrivegrænsens moduler (store-ejeren + de autoritative interne skriveveje) '
      + 'findes stadig — forsvinder de, er grænsen flyttet og reglen skal skrives om',
    // Sammensat mål: BÅDE ejeren og de to autoritative skriveveje skal findes. Slettes én af dem,
    // er reglen halvt død, selvom "≥1 fil matcher" fortsat holder.
    requiredPaths: [
      INPUT_STORE_OWNER,
      'src/inputCore/runtime/dispatchInput.ts',
      'src/inputCore/runtime/initializeInputRuntime.ts',
    ],
  },
  allow: [],
  find: (entry) => {
    const findings: Finding[] = [];

    if (!ZUSTAND_STORE_OWNERS.includes(entry.relativePath)) {
      for (const ref of collectImports(entry)) {
        if (/^zustand(?:\/|$)/.test(ref.moduleSpecifier)) {
          findings.push({
            position: ref.position,
            message:
              `Rå Zustand-store uden for ${INPUT_STORE_OWNER} — en ny mutabel store er en ny, ubevogtet `
              + 'inputvej. Skriv gennem `dispatchInput`; læs gennem readeren/projektionen (§3.6).',
          });
        }
      }
    }

    for (const ref of collectImports(entry)) {
      const specifier = ref.moduleSpecifier.replaceAll('\\', '/');
      if (/(?:^|\/)slimInputStore$/.test(specifier)) {
        for (const binding of ref.namedBindings) {
          if (
            binding.startsWith('__')
            || (binding === 'slimInputStore'
              && entry.relativePath !== 'src/inputCore/react/productionInputRuntime.tsx')
          ) {
            findings.push({
              position: ref.position,
              message: `Store-capabilityen \`${binding}\` må ikke importeres her.`,
            });
          }
        }
      }
      if (/(?:^|\/)dispatchInput$/.test(specifier)) {
        const owners: Readonly<Record<string, readonly string[]>> = {
          registerSlimInputStoreInternals: [INPUT_STORE_OWNER],
          hydrateInputStoreOnce: ['src/inputCore/runtime/initializeInputRuntime.ts'],
          bumpInputSettingsRevision: [
            INPUT_STORE_OWNER,
            'src/inputCore/react/productionInputRuntime.tsx',
          ],
        };
        for (const binding of ref.namedBindings) {
          const allowedOwners = owners[binding];
          if (allowedOwners !== undefined && !allowedOwners.includes(entry.relativePath)) {
            findings.push({
              position: ref.position,
              message: `Intern store-operation \`${binding}\` må kun importeres af ${allowedOwners.join(', ')}.`,
            });
          }
        }
      }
    }

    return findings;
  },
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: "import { createStore } from 'zustand/vanilla';" },
    { relativePath: 'src/components/x.tsx', code: "import { create } from 'zustand';" },
    // Også inde i inputCore — men uden for det ene modul der ejer storen.
    { relativePath: 'src/inputCore/react/x.ts', code: "import { createStore } from 'zustand/vanilla';" },
    {
      relativePath: 'src/components/x.tsx',
      code: "import { __createSlimInputTestStore as create } from '../inputCore/runtime/slimInputStore';",
    },
    {
      relativePath: 'src/components/x.tsx',
      code: "import { hydrateInputStoreOnce as hydrate } from '../inputCore/runtime/dispatchInput';",
    },
  ],
  cleanFixtures: [
    // Ejeren må naturligvis importere Zustand.
    {
      relativePath: 'src/inputCore/runtime/slimInputStore.ts',
      code: "import { createStore } from 'zustand/vanilla';",
    },
    {
      relativePath: 'src/inputCore/runtime/dispatchInput.ts',
      code: 'internals.applyCommit(commit);',
    },
    {
      relativePath: 'src/inputCore/runtime/initializeInputRuntime.ts',
      code: "import { hydrateInputStoreOnce as hydrate } from './dispatchInput'; hydrate(store, input, catalog);",
    },
    // Læsning er fri.
    { relativePath: 'src/components/x.tsx', code: 'const state = slimInputStore.getState();' },
  ],
});

// --- Rå sektionsadgang: kun gennem en navngiven projektion ---------------------

/**
 * `input.sections[...]` er den RÅ persisterede form. §3.4's læsegrænse siger, at consumers læser
 * gennem `InputReader`/projektionen, så en værdi bag en rød feltfejl er skjult og en gate kan blokere
 * korrekt. Et rå sektionsopslag omgår hele den mekanik.
 *
 * Der findes præcis ét sådant opslag uden for
 * inputinfrastrukturen (shellens devtools-diagnostik), og intet hindrede det næste. Diagnostikken har
 * et legitimt behov for den rå form — en fejlrapport skal vise hvad der ER gemt — men behovet hører i
 * en NAVNGIVEN projektion (`inputDiagnosticsProjection`), ikke i en generel undtagelse.
 */
const RAW_SECTION_OWNERS = 'src/inputCore/';

/**
 * Save-/persistensprojektionen er den ene LEGITIME rå læser uden for inputkernen: den skal
 * serialisere HVER sektion til `.eo`-filen, og en maskeret reader-værdi ville skrive et andet
 * dokument end det, brugeren har indtastet. Den udtømmende enumeration ER dens opgave (§3.9).
 */
const RAW_SECTION_SERIALIZERS: readonly string[] = [
  'src/persistence/eoSaveProjection.ts',
  // Case-fil-porten er den anden legitime rå ejer: den bygger load-kandidatens sektions-map fra det
  // schema-gyldige `.eo`-snapshot og svarer på hel-sags-data-presence. Begge er per definition udtømmende
  // over sektionerne og kan ikke udtrykkes gennem readeren, som netop skjuler værdier bag røde issues.
  // Den blev synlig, da property-/spread-formen kom med i reglen; den var altså ejer i
  // praksis, mens reglen kun målte bracket-formen.
  'src/persistence/caseFileOperations.ts',
];

/**
 * Destrukturering, der HENTER `sections` ud af et objekt — altså `const { sections } = input`, ikke en
 * komponent-parameter, der tilfældigvis HEDDER `sections`.
 *
 * Sondringen er strukturel, ikke navnebaseret, og den er nødvendig: `sections` er også et almindeligt ord.
 * EO-inspektionens komponenter tager en prop `sections: readonly InspektionSection[]` — view-modeller uden
 * nogen relation til `SettledInput`. Ville reglen flage dem, skulle tre uskyldige filer på allowlisten, og
 * grænsen ville blive udvandet præcis der, hvor den skal være skarp.
 *
 * Kun en `VariableDeclaration` med et INITIALISERINGSUDTRYK udtrykker en læsning: der ER et objekt, værdien
 * hentes fra. En parameter- eller catch-binding modtager derimod noget, kalderen har bygget — og hvis det
 * kaldssted rakte ind i den rå form, flages det DÉR af member-access-benet.
 */
const isSectionsReadFromObject = (node: ts.BindingElement): boolean => {
  const pattern = node.parent;
  if (!ts.isObjectBindingPattern(pattern)) return false;
  const declaration = pattern.parent;
  return ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined;
};

export const rawSectionAccessBoundary = defineRule({
  id: 'domain/raw-section-access-boundary',
  description:
    'Rå adgang til `…input.sections` — i ENHVER form (subscript, property, reference/spread, '
    + 'destrukturering) — hører i `src/inputCore/` (readeren + den navngivne diagnostikprojektion) og i '
    + 'de to navngivne persistensporte. Alle andre lag læser gennem `InputReader`/projektionen (§3.4), '
    + 'så en værdi bag en rød feltfejl forbliver skjult og gates blokerer korrekt.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => (entry.relativePath.startsWith(RAW_SECTION_OWNERS)
      || RAW_SECTION_SERIALIZERS.includes(entry.relativePath))
      // AST-signal, ikke tekst: `.sections` skal LÆSES, ikke blot nævnes i en kommentar (og netop
      // dette modul bærer nu flere kommentarer om den rå form, som en tekstprobe ville have accepteret).
      && hasMemberRead(entry, 'sections'),
    rationale:
      'den rå sektionsform findes stadig i inputkernen — forsvinder `sections` fra `SettledInput`, '
      + 'er der ingen rå adgang at regulere, og reglen skal slettes',
    // Begge de navngivne rå læsere skal findes OG stadig læse rå sektioner. Flyttes/omdøbes en af
    // dem, ville undtagelsen ellers blive en tavs udvidelse af grænsen for en fremtidig fil på
    // samme sti.
    requiredPaths: [
      'src/inputCore/react/inputDiagnosticsProjection.ts',
      ...RAW_SECTION_SERIALIZERS,
    ],
  },
  allow: [],
  // En regel, der KUN måler `collectElementAccess`, ser kun bracket-formen `input.sections["satser"]`. En
  // syntetisk kørsel viste, at `input.sections.satser` gav NUL fund, og at en reference til hele
  // `input.sections` (fx et spread) heller ikke blev set. Grænsen handler om ADGANG TIL VÆRDIEN, ikke om
  // hvilken syntaks der bruges, så alle fire former måles nu:
  //   1. `x.sections[k]`         — element access (den oprindelige)
  //   2. `x.sections.satser`     — property access
  //   3. `x.sections` / `{...x.sections}` — bar reference og spread (samme member access-node)
  //   4. `const { sections } = x` — destrukturering (en binding-pattern, ikke et adgangsudtryk)
  find: (entry) => {
    if (entry.relativePath.startsWith(RAW_SECTION_OWNERS)) return [];
    if (RAW_SECTION_SERIALIZERS.includes(entry.relativePath)) return [];

    const message =
      'Rå sektionsadgang uden for inputCore — læs gennem `useInputEvaluation`/en domæneprojektion, '
      + 'eller (til diagnostik) gennem `useInputDiagnostics` (§3.4).';

    const elementAccess = collectElementAccess(entry)
      // `chainText` er hele udtrykket inkl. subscript; vi matcher på objektet FØR `[`, så både
      // `x.input.sections[k]` og `sections[k]` rammes, men `rows[i]` ikke gør.
      .filter((ref) => /(?:^|\.)sections$/.test(ref.chainText.split('[')[0]?.trim() ?? ''))
      .map((ref) => ({ position: ref.position, message }));

    // Property-formen fanges på den YDERSTE `.sections`-node, så `x.sections.satser` rapporteres ét sted
    // og ikke to (både `x.sections` og hele kæden ville ellers matche).
    const memberAccess = collectMemberAccess(entry)
      .filter((ref) => ref.node.name.text === 'sections')
      .map((ref) => ({ position: ref.position, message }));

    const destructured = collectDestructuredProperties(entry)
      .filter((ref) => ref.propertyName === 'sections' && isSectionsReadFromObject(ref.node))
      .map((ref) => ({ position: ref.position, message }));

    return [...elementAccess, ...memberAccess, ...destructured];
  },
  violatingFixtures: [
    {
      relativePath: 'src/components/layout/X.tsx',
      code: 'const s = runtime.getSettled().input.sections[pageKey];',
    },
    { relativePath: 'src/domain/x/y.ts', code: 'const v = snapshot.input.sections["satser"];' },
    // De tre former, den oprindelige regel var blind for.
    { relativePath: 'src/domain/x/y.ts', code: 'const v = snapshot.input.sections.satser;' },
    { relativePath: 'src/domain/x/y.ts', code: 'const next = { ...empty.sections, satser: v };' },
    { relativePath: 'src/domain/x/y.ts', code: 'const { sections } = snapshot.input;' },
  ],
  cleanFixtures: [
    // Inputkernen selv ejer den rå form.
    {
      relativePath: 'src/inputCore/react/inputDiagnosticsProjection.ts',
      code: 'const s = read.getSettled().input.sections[pageKey];',
    },
    {
      relativePath: 'src/inputCore/runtime/initializeInputRuntime.ts',
      code: 'const sections = { ...empty.sections };',
    },
    // Læsning gennem readeren/projektionen er hele pointen.
    { relativePath: 'src/domain/x/y.ts', code: 'const v = reader.read(field);' },
    // Et element-opslag på noget ANDET end `sections` er ikke reglens ærinde.
    { relativePath: 'src/domain/x/y.ts', code: 'const v = rows[index];' },
    // En anden property, der blot HEDDER noget med sections, er ikke den rå form.
    { relativePath: 'src/domain/x/y.ts', code: 'const v = doc.sectionsCount;' },
    // Destrukturering af noget andet end `sections`.
    { relativePath: 'src/domain/x/y.ts', code: 'const { issues } = snapshot;' },
    // En komponent-PARAMETER, der tilfældigvis hedder `sections` (EO-inspektionens view-modeller): der er
    // intet objekt, værdien hentes fra, så det er ikke en rå læsning.
    {
      relativePath: 'src/components/pages/x/Y.tsx',
      code: 'const C = ({ sections }: { sections: readonly Row[] }) => sections.length;',
    },
  ],
});

// --- EO's inputflader ligger på den autoritative editorvej -----------

/**
 * Enhver EO-inputflade skal føre sit input gennem inputkernens autoritative editorvej.
 *
 * Reglen afløser `erstatningsopgoerelseSurfaceGuard.test.ts`, som var en RÅ TEKST-guard i begge ender: den
 * fandt inputflader med regex over kildeteksten og godkendte arkitekturvejen med `source.includes(...)`. En
 * håndrullet inputflade kunne derfor passere alene ved at NÆVNE fx `useFieldEditor` i en kommentar — en
 * in-memory probe med `// useFieldEditor` foran en `<Input field={x} onChange={…} />` blev accepteret
 *. Det er samme fejlklasse, blot i et lokalt værn frem for i harnesset.
 *
 * Begge ender er nu AST:
 *  - FLADEN genkendes på JSX-attributter (`field`/`location`/`onCommit`/`onDraftChange`), der er noder.
 *  - VEJEN bevises af en faktisk IMPORT fra et autoritativt inputmodul eller af et kald til en af
 *    inputvejens hooks — ikke af at navnet forekommer i filteksten.
 */
const EO_SURFACE_ROOTS = [
  'src/components/pages/Erstatningsopgoerelse.tsx',
  'src/components/pages/erstatningsopgoerelse',
];

/** JSX-attributter, der gør en fil til en inputflade (og ikke ren visning/beregning). */
const EO_INPUT_SURFACE_ATTRIBUTES = ['field', 'location', 'onCommit', 'onDraftChange'];

/** Den autoritative inputvej som IMPORT-stier — en import er en node, en kommentar er ikke. */
const AUTHORITATIVE_EDITOR_MODULE = /(?:^|\/)(?:inputCore\/react(?:\/|$)|useCollectionTable|useCollectionRows)/;

/** Den autoritative inputvej som KALD — samme veje, hvis de nås via en re-eksport uden matchende sti. */
const AUTHORITATIVE_EDITOR_HOOKS = [
  'useFieldEditor',
  'useFormFieldSurface',
  'useGridCellSurface',
  'useCollectionTable',
  'useCollectionRows',
];

/**
 * Den transiente familie er den ENE bevidste ikke-sagsdata-flade (overlays/dialoger), hvis værdier aldrig
 * persisteres ([[project_transient_input_family]]). Den skal netop IKKE ligge på den autoritative editorvej — at
 * kræve det ville være at bede den om at skrive sagsdata. Undtagelsen gælder KUN en REN transient flade:
 * bærer filen også et persisteret felt (`field={…}`), skal den på editorvejen, så en overtrædelse ikke
 * kan gemme sig bag ét transient input. Den anden retning håndhæves af
 * `input/transient-cannot-write-case-data`.
 */
const TRANSIENT_INPUT_COMPONENTS = ['TransientAmountInput', 'TransientDateInput', 'TransientTextInput'];

export const eoSurfaceOnAuthoritativeEditorPath = defineRule({
  id: 'input/eo-surface-on-authoritative-editor-path',
  description:
    'Enhver EO-inputflade (JSX med field/location/onCommit/onDraftChange) skal importere eller kalde '
    + 'inputkernens autoritative editorvej — bevist på AST-noder, ikke på tekst i filen.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      EO_SURFACE_ROOTS.some((root) => entry.relativePath === root || entry.relativePath.startsWith(`${root}/`))
      && EO_INPUT_SURFACE_ATTRIBUTES.some((name) => hasJsxAttribute(entry, name)),
    rationale:
      'EO-siden har stadig inputflader at kontrollere — forsvinder de, er der ingen overflade at holde '
      + 'på den autoritative editorvej',
    // Gulvet er ikke kosmetisk: den gamle guard havde samme krav, fordi en filflytning ellers ville gøre
    // værnet trivielt grønt. Fem er antallet af flader, EO faktisk har.
    minimumMatches: 5,
  },
  appliesTo: (relativePath) =>
    EO_SURFACE_ROOTS.some((root) => relativePath === root || relativePath.startsWith(`${root}/`)),
  find: (entry) => {
    if (!EO_INPUT_SURFACE_ATTRIBUTES.some((name) => hasJsxAttribute(entry, name))) return [];

    const onAuthoritativeEditorPath =
      collectImports(entry).some((ref) => AUTHORITATIVE_EDITOR_MODULE.test(ref.moduleSpecifier))
      || collectCalls(entry).some((ref) => AUTHORITATIVE_EDITOR_HOOKS.includes(ref.calleeName));
    if (onAuthoritativeEditorPath) return [];

    // Ren transient flade: intet persisteret `field`, kun transiente kontroller.
    const isPurelyTransient =
      !hasJsxAttribute(entry, 'field')
      && hasAnyIdentifier(entry, TRANSIENT_INPUT_COMPONENTS);
    if (isPurelyTransient) return [];

    return [{
      position: { line: 1, column: 1 },
      message:
        'EO-inputflade uden for den autoritative editorvej: filen sætter field/location/onCommit/onDraftChange, '
        + 'men importerer eller kalder ingen af inputCores editorveje (§3.5/§3.6).',
    }];
  },
  violatingFixtures: [
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/X.tsx',
      code: 'const C = () => <Input field={x} onChange={(e) => setLocal(e.target.value)} />;',
    },
    // Det konkrete bypass: kommentaren nævner editor-hooket, men INTET kalder eller importerer det.
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/Y.tsx',
      code: '// useFieldEditor\nconst C = () => <Input field={x} onChange={(e) => setLocal(e.target.value)} />;',
    },
    // Et transient input kan ikke dække over et persisteret felt i samme fil.
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/Z.tsx',
      code: 'const C = () => <><TransientDateInput /><Input field={x} onCommit={c} /></>;',
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/A.tsx',
      code: "import { useFormFieldSurface } from '../../../inputCore/react/useFormFieldSurface';\n"
        + 'const C = () => { const s = useFormFieldSurface(field, location); return <input field={x} {...s} />; };',
    },
    // Ren transient flade uden persisteret felt: bevidst undtagelse.
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/B.tsx',
      code: 'const C = () => <TransientAmountInput onCommit={c} />;',
    },
    // Ren visning/beregning uden inputattributter.
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/C.tsx',
      code: 'const C = ({ total }: { total: number }) => <span>{total}</span>;',
    },
  ],
});

// --- Interne runtime-capabilities: kun navngivne ejere -------------------------

/**
 * Sektionsreset, hel-sags-replacement, history og kritiske handlinger kan ikke udtrykkes som en
 * feltredigering, og en celle må aldrig kunne formulere dem.
 *
 * Grænsen er primært STRUKTUREL: porten er skilt ud fra `InputEditPort`, så en editor-flade slet ikke
 * har `replaceCase` i hånden. Reglen holder PRODUCENTLISTEN lukket — hvem der overhovedet henter
 * systemporten — for ellers kunne en ny celleflade tilføje kaldet lydløst, og adskillelsen ville være
 * tilbage til en aftale.
 */
const INTERNAL_HOOK_OWNERS: Readonly<Record<string, readonly string[]>> = {
  useCaseRuntimeAccess: ['src/inputCore/react/useCaseOperations.ts'],
  useInputHistoryAccess: ['src/inputCore/react/useUndoRedoShortcuts.ts'],
  useCriticalActionCoordinator: ['src/inputCore/react/useInputEvaluation.ts'],
  useSectionReset: ['src/components/pages/renteberegning/RenteberegningTab.tsx'],
  useInternalSettledSnapshot: [
    'src/inputCore/react/useFieldEditor.ts',
    'src/inputCore/react/useCollectionRows.ts',
    'src/inputCore/react/inputDiagnosticsProjection.ts',
  ],
  useInternalInputCatalog: ['src/inputCore/react/useCollectionRows.ts'],
};

export const internalRuntimeCapabilityBoundary = defineRule({
  id: 'input/internal-runtime-capability-boundary',
  description:
    'Interne runtime-capabilities importeres kun af deres navngivne ejer.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => Object.keys(INTERNAL_HOOK_OWNERS).some((name) => hasIdentifier(entry, name)),
    rationale: 'de snævre interne hooks findes og bruges af deres composition roots',
    requiredPaths: [
      'src/inputCore/react/inputRuntimeContext.tsx',
      ...new Set(Object.values(INTERNAL_HOOK_OWNERS).flat()),
    ],
  },
  allow: [],
  find: (entry) => {
    if (entry.relativePath === 'src/inputCore/react/inputRuntimeContext.tsx') return [];
    return collectImports(entry).flatMap((ref) => ref.namedBindings.flatMap((binding) => {
      const owners = INTERNAL_HOOK_OWNERS[binding];
      if (owners === undefined || owners.includes(entry.relativePath)) return [];
      return [{
        position: ref.position,
        message: `Intern runtime-capability ${binding} importeres uden for sin navngivne ejer.`,
      }];
    }));
  },
  violatingFixtures: [
    {
      relativePath: 'src/components/inputs/X.tsx',
      code: "import { useSectionReset as reset } from '../../inputCore/react/inputRuntimeContext'; reset();",
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/inputCore/react/useCaseOperations.ts',
      code: "import { useCaseRuntimeAccess as access } from './inputRuntimeContext'; access();",
    },
    { relativePath: 'src/components/inputs/X.tsx', code: 'const edit = useInputEditPort();' },
    { relativePath: 'src/components/inputs/X.tsx', code: 'const read = useInputReadPort();' },
  ],
});

// --- Transiente controls må ikke kunne skrive sagsinput ------------------------

/**
 * `src/components/inputs/transient/` er den ENESTE bevidste ikke-sagsdata-flade: tre overlay-/dialog-
 * felter, hvis værdier aldrig persisteres ([[project_transient_input_family]]). Det var indtil nu kun
 * en aftale — intet hindrede en af dem i at importere skrivevejen og dermed genskabe præcis den
 * parallelle inputvej, cutoveren slettede ("genindfør ALDRIG en Styled*Field-familie").
 *
 * Reglen forbyder dem enhver sagsinput-skrivevej: dispatch, storen, feltredigeringen og
 * descriptor-katalogerne (uden en descriptor findes der ingen feltadresse at skrive til).
 */
const TRANSIENT_DIR = 'src/components/inputs/transient';

export const transientCannotWriteCaseData = forbidImports({
  id: 'input/transient-cannot-write-case-data',
  description:
    'Transiente (ikke-sagsdata) input-controls må ikke importere en sagsinput-skrivevej — hverken '
    + 'dispatch, den autoritative store, felteditoren eller et descriptor-katalog.',
  liveTarget: {
    kind: 'scoped',
    roots: [TRANSIENT_DIR],
    rationale:
      'den transiente feltfamilie findes stadig som selvstændig flade og kan koble sig på sagsinput',
  },
  appliesTo: (relativePath) => relativePath.startsWith(`${TRANSIENT_DIR}/`),
  allow: [],
  forbidden: (ref) => {
    const moduleSpecifier = ref.moduleSpecifier.replaceAll('\\', '/');
    return (
      /(?:^|\/)inputCore\/catalog\//.test(moduleSpecifier)
      || /(?:^|\/)(?:dispatchInput|slimInputStore|initializeInputRuntime)$/.test(moduleSpecifier)
      || /(?:^|\/)inputCore\/runtime(?:\/index)?$/.test(moduleSpecifier)
      || /(?:^|\/)(?:useFieldEditor|useFormFieldSurface|useGridCellSurface|useCollectionRows)$/.test(moduleSpecifier)
      || ref.namedBindings.some((binding) =>
        binding === 'dispatchInput'
        || binding === 'slimInputStore'
        || binding === 'useFieldEditor'
        || binding === 'useFormFieldSurface'
        || binding === 'useInputEvaluation'
      )
    );
  },
  message: (ref) =>
    `Transient control importerer en sagsinput-skrivevej (${ref.moduleSpecifier}) — transiente felter `
    + 'er pr. definition ikke sagsdata og må ikke kunne persistere.',
  violatingFixtures: [
    {
      relativePath: `${TRANSIENT_DIR}/TransientX.tsx`,
      code: "import { dispatchInput } from '../../../inputCore/runtime/dispatchInput';",
    },
    {
      relativePath: `${TRANSIENT_DIR}/TransientX.tsx`,
      code: "import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';",
    },
    {
      relativePath: `${TRANSIENT_DIR}/TransientX.tsx`,
      code: "import { useFieldEditor } from '../../../inputCore/react/useFieldEditor';",
    },
    {
      relativePath: `${TRANSIENT_DIR}/TransientX.tsx`,
      code: "import { stamdataSkadedatoField } from '../../../inputCore/catalog/stamdataDescriptors';",
    },
  ],
  cleanFixtures: [
    // Den transiente families egen draft-hook + de bevarede UI-primitiver er hele dens tilladte verden.
    { relativePath: `${TRANSIENT_DIR}/TransientX.tsx`, code: "import { useTransientDraft } from './useTransientDraft';" },
    { relativePath: `${TRANSIENT_DIR}/TransientX.tsx`, code: "import StyledTextFieldBase from '../StyledTextFieldBase';" },
    { relativePath: `${TRANSIENT_DIR}/TransientX.tsx`, code: "import { parseAmountInput } from '../../../utils/expressionAmount';" },
    // Uden for den transiente mappe gælder forbuddet ikke.
    { relativePath: 'src/components/x.tsx', code: "import { useFieldEditor } from '../inputCore/react/useFieldEditor';" },
  ],
});

// --- Forbudt-identifier-gate: de reelt døde legacy-navne ----------------------

/**
 * Forbudt-symbol-gaten, med listen holdt mod den faktiske kildetilstand.
 *
 * Gaten måler **identifiers fra AST'en**, ikke tekst. Det er afgørende, fordi de fleste af navnene
 * stadig optræder i produktionen — som KOMMENTARER, der forklarer hvorfor en mekanisme ikke findes
 * længere. Den historik er bevidst dokumentation og skal blive ([[project_dansk_prosa_guard_markers]]);
 * en grep-baseret gate ville tvinge en oprydning af netop den prosa, der gør sletningerne forståelige.
 *
 * **`blocksSave` blev fejlagtigt udeladt og er nu tilbage på listen.**
 *
 * Begrundelsen for at udelade det — "levende navn i `eoInputIssues.ts`" — var faktuelt forkert. Navnet
 * fandtes kun i KOMMENTARER, som netop forklarede, at booleanen ER slettet, og `error-contract.md` §1.1
 * forbyder normativt et `blocksSave`-flag. Klassifikationen var lavet efter tekstsøgning frem for efter
 * den normative model, og en tekstsøgning kan ikke skelne "navnet bruges" fra "navnet omtales".
 * Gaten måler identifiers, så de forklarende kommentarer bevares uændret.
 *
 * **`fieldErrors` er fortsat UDELADT — og her holder begrundelsen.** Navnet er et LEVENDE feltnavn i
 * snapshot-/projektionskontrakterne (`eoErrors`/`stamdataErrors`-familien, download-gates), altså en
 * identifier produktionen retmæssigt bruger. At forbyde det ville tvinge en kosmetisk omdøbning igennem
 * uden gevinst — stik imod [[feedback_prefer_structural_unification]].
 *
 * `usePersistedForm` og `useSliceRowDrafts` er afklaret: begge har NUL identifiers
 * i produktionen (og `usePersistedForm` har ingen definition overhovedet), så de hører hjemme på listen.
 *
 * `EoInputIssueSource`/`EoFieldIssuesBySource` er med på listen: EO's parallelle
 * source-register er slettet, og `error-contract.md` §11 forbyder det eksplicit.
 */
export const FORBIDDEN_LEGACY_IDENTIFIERS: readonly string[] = [
  'executeLegacyInputTransaction',
  'useDraftLifecycle',
  'legacyGridTransactionBridge',
  'useDraftField',
  'useTableInputCore',
  'useRowDrafts',
  'useSliceRowDrafts',
  'invalidDrafts',
  'FormPersistenceContext',
  'usePersistedForm',
  'blocksSave',
  'EoInputIssueSource',
  'EoFieldIssuesBySource',
  'collectPresentFieldErrors',
  'InputWriteAuthority',
  'claimInputWriteAuthority',
  'cellFocusPaths',
  'useCellInvalidDraftChannel',
  'onFieldError',
  // `error-contract.md` §2 og `form-contract.md` §12 navngiver BEGGE denne hook som del af den slettede,
  // forbudte feltfejl-bus — men kun `onFieldError` stod her. To normative kontrakter erklærede altså et
  // forbud, gaten ikke håndhævede (fundet ved kontraktverifikationen 2026-08-07). Kontrakterne havde ret;
  // det var listen, der var ufuldstændig.
  'useFormFieldErrorReporter',
  'visibleDocumentFailureMessage',
  'resolveOverenskomstNameOnlyDisplay',
  'normalizeGridRows',
  'reconcileGridRowIdentityForRestore',
  'undoAliasRowIdsByRowId',
];

const FORBIDDEN_IDENTIFIER_SET = new Set(FORBIDDEN_LEGACY_IDENTIFIERS);

export const forbiddenLegacyIdentifier = defineRule({
  id: 'legacy/forbidden-identifier',
  description:
    'De slettede legacy-mekanismers navne må ikke genopstå som identifiers i produktionskoden. Gaten '
    + 'måler AST-identifiers, ikke tekst, så historik-kommentarer om de samme mekanismer bevares.',
  liveTarget: {
    kind: 'absence',
    forbids: FORBIDDEN_LEGACY_IDENTIFIERS,
    rationale:
      'nul hits ER målet: hvert navn er bevisligt dødt som identifier',
    // Fraværskontrollen kører i harnesset, ikke i en sidestillet testfil, og i BEGGE retninger: navnet
    // skal være fraværende i grafen, OG prædikatet skal kunne finde det i en fil, der bruger det.
    // Uden den anden retning kunne en stavefejl bevises "fraværende" lige så let som det rigtige navn.
    verifyAbsent: (name, entries) => !entries.some((entry) => hasIdentifier(entry, name)),
    absenceProbeCode: (name) => `const probe = ${name};`,
  },
  // KUN identifiers, gennem den DELTE `collectIdentifiers`. Kommentarer er ikke AST-noder og kan derfor
  // pr. konstruktion ikke flages; strengliteraler heller ikke. Samme funktion bærer fraværsbeviset
  // ovenfor, så måling og bevis ikke kan drifte fra hinanden.
  find: (entry) => collectIdentifiers(entry)
    .filter((ref) => FORBIDDEN_IDENTIFIER_SET.has(ref.text))
    .map((ref) => ({
      position: ref.position,
      message:
        `Genindført legacy-symbol '${ref.text}' — mekanismen er slettet. `
        + 'Brug inputCore: reader/projektion til læsning, dispatch/useFieldEditor til skrivning.',
    })),
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'const s = usePersistedForm("aarsloen");' },
    { relativePath: 'src/x.ts', code: 'import { useDraftField } from "./somewhere";' },
    { relativePath: 'src/x.ts', code: 'const d = state.invalidDrafts;' },
    { relativePath: 'src/x.tsx', code: 'const rows = useSliceRowDrafts(x);' },
    { relativePath: 'src/x.ts', code: 'type T = { ctx: FormPersistenceContext };' },
  ],
  cleanFixtures: [
    // DEN VIGTIGSTE fixture: historik-prosa med præcis de forbudte ord må IKKE flages. Den er beviset
    // for, at gaten ikke kolliderer med den bevidste dokumentation af hvad der blev slettet.
    {
      relativePath: 'src/x.ts',
      code: '// Nøglen `mineo_invalidDrafts` findes ikke: invalidDrafts-kanalen er slettet.',
    },
    {
      relativePath: 'src/x.ts',
      code: '/** Erstatter `usePersistedForm`/`useDraftField`-vejen med den ene write-grænse. */\nexport const x = 1;',
    },
    // Strengliterale (fx i et manifest eller en fejlbesked) er heller ikke identifiers.
    { relativePath: 'src/x.ts', code: 'const names = ["useRowDrafts", "invalidDrafts"];' },
    // Levende vokabular må ikke rammes: `fieldErrors` er det nuværende feltnavn i
    // snapshot-/projektionskontrakterne. (`blocksSave` stod tidligere i denne fixture som "levende" —
    // det var netop en fejlklassifikation; navnet er forbudt.)
    { relativePath: 'src/x.ts', code: 'const { fieldErrors } = snapshot;' },
    // En KOMMENTAR om den slettede boolean skal fortsat bevares.
    { relativePath: 'src/x.ts', code: '// INGEN blocksSave-booleans: konsekvensen udledes strukturelt.\nexport const x = 1;' },
  ],
});

// --- Source-settings-snapshottet: kun projektoren konstruerer det --------------

/** Modulet der ejer de to nominelle settings-snapshots og deres projektorer. */
const SOURCE_SETTINGS_OWNER = 'src/settings/sourceSettings.ts';

/**
 * De brandede settings-typer, kun projektorerne må stemple.
 *
 * `DocumentRenderSettings` kom til, da gate- og render-halvdelen blev adskilt: da blev
 * render-halvdelen sin egen offentlige type, og uden et mærke var hele `AppSettings` strukturelt
 * assignable til den — altså samme tavse hul som for de to øvrige.
 */
const BRANDED_SETTINGS_TYPE_NAMES = ['SourceSettings', 'EoRowPolicy', 'DocumentRenderSettings'] as const;
const BRANDED_SETTINGS_TYPES: ReadonlySet<string> = new Set(BRANDED_SETTINGS_TYPE_NAMES);

/** Typernes eneste konstruktører. Deres fravær betyder, at grænsen er flyttet. */
const PROJECTOR_NAMES = [
  'projectSourceSettings',
  'projectEoRowPolicy',
  'projectDocumentRenderSettings',
] as const;

/**
 * Fabrikker der PARAMETRISERES med settings-typen frem for at producere en værdi af den.
 * `defineDocumentAction<Request, SourceSettings, Brevhoved>` erklærer en definitions settings-form;
 * den fremstiller intet snapshot og er derfor ikke en omgåelse af projektoren.
 */
const DEFINITION_FACTORY_PATTERN = /^define[A-Z]/;

/**
 * PRIMÆRVÆRNET er STRUKTUREN, ikke denne regel.
 *
 * `SourceSettings` og `EoRowPolicy` er nominelle (unique-symbol-brands), og `projectSourceSettings`/
 * `projectEoRowPolicy` er deres eneste konstruktører. Derfor kan hele `AppSettings` ikke længere
 * flyde ind i evaluering, rækkepolitik eller dokumentcapture — netop hullet her: en læsning
 * af en nøgle UDEN FOR `SOURCE_SETTINGS_KEYS` ville indføre en source-afhængighed, der ikke gør et
 * optaget `EvaluationSourceToken` stale, så en download godkendt under den gamle regel kunne
 * overleve et regelskift.
 *
 * Reglen dækker brandede typers KENDTE loft, som strukturen ikke selv kan lukke: en
 * type-assertion (`{} as SourceSettings`, `settings as EoRowPolicy`) fremstiller mærket uden at gå
 * gennem projektoren. Det er samme afvejning og samme restansvar som `input/write-boundary`s
 * assertion-hul.
 *
 * **Ingen ejer-undtagelse.** Reglen gælder ALLE filer, også `sourceSettings.ts` selv. Det er muligt,
 * fordi mærkerne er ægte runtime-symboler: projektorerne SÆTTER egenskaben og behøver derfor intet
 * cast. En bred `appliesTo`-undtagelse for ejerfilen ville have gjort netop det sted, hvor mærket
 * fremstilles, usynligt for værnet — og dermed friholdt en ny usikker eksport dér.
 *
 * **Reglen ser ikke kun det skrevne typenavn.** Tre omveje lukkes ud over den direkte assertion:
 *   1. **Lokale type-aliaser** (`type S = SourceSettings; x as S`). Aliaser opsamles pr. fil, så
 *      assertionens target opløses til rodnavnet. Fanget uanset kædelængde.
 *   2. **Kvalificerede navne** (`Settings.SourceSettings`) — sidste led sammenlignes også.
 *   3. **Generisk coercion** (`forge<EoRowPolicy>(x)` hvor hjælperen internt caster til sin egen
 *      typeparameter). Kaldet bærer den brandede type som eksplicit type-argument, og det er ikke
 *      til at skelne fra en assertion i konsekvens, så et type-argument til et KALD flages.
 *      Type-argumenter i rene TYPE-positioner (fx `DocumentSourceContext<SourceSettings>`) er
 *      uberørte; det er den sædvanlige, legitime brug.
 *
 * Restrisiko, der IKKE kan lukkes syntaktisk: en hjælper, der får den brandede type inferet frem for
 * eksplicit. Den kræver en typechecker-baseret analyse; grænsens primære bevis er derfor fortsat
 * strukturen (mærket + den cast-frie projektor), ikke denne regel.
 */
export const sourceSettingsProjectionBoundary = defineRule({
  id: 'input/source-settings-projection-boundary',
  description:
    'Source-settings-snapshottet og EO-rækkepolitikken konstrueres KUN af deres projektorer i '
    + `${SOURCE_SETTINGS_OWNER}. Grænsen er STRUKTUREL: begge typer er nominelle, så hele `
    + '`AppSettings` ikke kan flyde ind i evaluering, rækkepolitik eller dokumentcapture. Reglen '
    + 'dækker resten — en type-assertion, der stempler mærket uden om projektoren.',
  liveTarget: {
    kind: 'precondition',
    // Proben måler IDENTIFIERS, ikke filtekst. En tekstprobe (og en ren sti-match på ejerfilen) ville
    // bestå, selv om typen og projektoren var slettet og kun historik-kommentaren stod tilbage —
    // altså præcis den tomhed, `liveTarget` findes for at udelukke.
    probe: (entry) => BRANDED_SETTINGS_TYPE_NAMES.some((name) => hasIdentifier(entry, name))
      || PROJECTOR_NAMES.some((name) => hasIdentifier(entry, name)),
    rationale:
      'de nominelle settings-snapshots og deres projektorer findes stadig som IDENTIFIERS, og der '
      + 'findes consumers, der kunne forsøge at fremstille dem uden om projektoren — forsvinder '
      + 'typerne, er grænsen flyttet og reglen skal skrives om',
    // Sammensat mål: BÅDE ejeren og de tre consumer-lag (evaluering, rækkeevaluering, dokumentcapture)
    // skal findes. Slettes ét af dem, er reglen halvt død, selvom "≥1 fil matcher" fortsat holder.
    // Hver sti skal desuden selv opfylde proben, altså faktisk NÆVNE et af navnene som identifier.
    requiredPaths: [
      SOURCE_SETTINGS_OWNER,
      'src/inputCore/react/productionInputRuntime.tsx',
      'src/domain/eoRowEvaluation/eoRowExecutionContext.ts',
      'src/document/runtime/react/useMineoDocumentEnvironment.ts',
    ],
  },
  allow: [],
  // Måler AST-noder, ikke tekst: en tekstsøgning ville både ramme kommentarer, der NÆVNER mønsteret
  // (den bevidste historik-prosa), og give en forkert position.
  find: (entry) => {
    const aliases = collectLocalTypeAliases(entry);
    // Opløser et skrevet target til sit rodnavn: aliaskæde først, derefter sidste led af et
    // kvalificeret navn. `as unknown as X` fanges i forvejen, fordi den ydre assertion bærer X.
    const resolveTarget = (typeText: string): string => {
      const written = typeText.trim();
      const unqualified = written.slice(written.lastIndexOf('.') + 1);
      return aliases.get(unqualified) ?? unqualified;
    };
    const findings: Finding[] = [];

    for (const ref of collectTypeAssertions(entry)) {
      const target = resolveTarget(ref.typeText);
      if (!BRANDED_SETTINGS_TYPES.has(target)) continue;
      findings.push({
        position: ref.position,
        message:
          `Type-assertion til '${target}' uden om projektoren — mærket skal komme fra `
          + '`projectSourceSettings`/`projectEoRowPolicy`, ellers er indsnævringen til '
          + '`SOURCE_SETTINGS_KEYS` ikke sket, og en nøgle uden for sættet kan ændre en gate uden at '
          + 'gøre et optaget `EvaluationSourceToken` stale.',
      });
    }

    // Et eksplicit type-argument på et kald flages KUN, når kaldet ser ud som en coercion — altså en
    // hjælper, der PRODUCERER en værdi af den brandede type. Det er nødvendigt at skelne: de
    // legitime `define*`-fabrikker parametriserer en DEFINITION med settings-typen (fx
    // `defineDocumentAction<Request, SourceSettings, Brevhoved>`), hvilket er hele deres formål og
    // ikke fremstiller nogen værdi. Første udgave af reglen manglede den sondring og flagede
    // `reguleringDocumentAction` — et ægte falsk positiv, fanget ved at køre værnet mod produktionen.
    //
    // Sondringen er navnebaseret og derfor ikke vandtæt; det er bevidst. Grænsens primære bevis er
    // strukturen (mærket + den cast-frie projektor). En hjælper, der hverken heder `define*` og
    // alligevel kun beskriver en type, vil give et falsk positiv, som skal afgøres eksplicit her —
    // hvilket er den rigtige retning for et sekundært værn.
    for (const ref of collectCallTypeArguments(entry)) {
      const target = resolveTarget(ref.typeText);
      if (!BRANDED_SETTINGS_TYPES.has(target)) continue;
      if (DEFINITION_FACTORY_PATTERN.test(ref.calleeText)) continue;
      findings.push({
        position: ref.position,
        message:
          `'${target}' gives som eksplicit type-argument til \`${ref.calleeText}\` — en generisk `
          + 'hjælper, der producerer den brandede type, er en assertion flyttet én funktion væk. Byg '
          + 'værdien med `projectSourceSettings`/`projectEoRowPolicy`.',
      });
    }

    // Testfabrikkerne (`__createTestSourceSettings`/`__createTestEoRowPolicy`) bygger vel gennem
    // projektoren, men fra en VILKÅRLIG delvis override og uden om revisionsbroen. I produktionskode
    // ville de derfor være en anden samtidig sandhed om, hvilke settings der gælder. Samme
    // `__`-konvention og samme dom som `__createSlimInputTestStore` i `input/write-boundary`.
    for (const ref of collectImports(entry)) {
      const specifier = ref.moduleSpecifier.replaceAll('\\', '/');
      if (!/(?:^|\/)sourceSettings$/.test(specifier)) continue;
      for (const binding of ref.namedBindings) {
        if (!binding.startsWith('__')) continue;
        findings.push({
          position: ref.position,
          message:
            `Test-fabrikken \`${binding}\` må ikke bruges i produktionskode — den bygger et snapshot `
            + 'fra en vilkårlig override og uden om settings-revisionsbroen. Produktionen skal '
            + 'projicere det committede `AppSettings`.',
        });
      }
    }

    return findings;
  },
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'const s = {} as SourceSettings;' },
    { relativePath: 'src/x.ts', code: 'const p = settings as EoRowPolicy;' },
    { relativePath: 'src/x.ts', code: 'const s = appSettings as unknown as SourceSettings;' },
    // Omvej 1: lokalt type-alias. Uden aliasopløsningen var dette en gratis omgåelse.
    { relativePath: 'src/x.ts', code: 'type S = SourceSettings;\nconst s = appSettings as unknown as S;' },
    // Aliaskæde — opslaget er transitivt.
    { relativePath: 'src/x.ts', code: 'type A = EoRowPolicy;\ntype B = A;\nconst p = x as B;' },
    // Omvej 2: kvalificeret navn via namespace-import.
    { relativePath: 'src/x.ts', code: 'const s = x as Settings.SourceSettings;' },
    // Omvej 3: generisk coercion — hjælperen caster internt til sin egen typeparameter.
    { relativePath: 'src/x.ts', code: 'const p = forge<EoRowPolicy>(appSettings);' },
    // Gammel vinkel-syntaks er også en assertion.
    { relativePath: 'src/x.ts', code: 'const s = <SourceSettings><unknown>appSettings;' },
    // Produktionsbrug af testfabrikkerne — også under et alias.
    { relativePath: 'src/x.ts', code: "import { __createTestSourceSettings } from '../settings/sourceSettings';" },
    { relativePath: 'src/components/x.tsx', code: "import { __createTestEoRowPolicy as mk } from '../../settings/sourceSettings';" },
  ],
  cleanFixtures: [
    // Den legitime vej: gennem projektoren.
    { relativePath: 'src/x.ts', code: "import { projectSourceSettings } from '../settings/sourceSettings';\nconst s = projectSourceSettings(settings);" },
    { relativePath: 'src/x.ts', code: 'const p = projectEoRowPolicy(sourceSettings);' },
    // At NÆVNE typen i en annotation er ikke en konstruktion.
    { relativePath: 'src/x.ts', code: 'const s: SourceSettings = projectSourceSettings(settings);' },
    { relativePath: 'src/x.ts', code: 'export const f = (policy: EoRowPolicy): void => { void policy; };' },
    // VIGTIG negativ fixture: et type-argument i en TYPE-position er den sædvanlige, legitime brug og
    // må ikke rammes — kun type-argumenter på KALD flages.
    { relativePath: 'src/x.ts', code: 'type Ctx = DocumentSourceContext<SourceSettings>;' },
    { relativePath: 'src/x.ts', code: 'export const g = (c: DocumentSourceContext<SourceSettings>): void => { void c; };' },
    // En assertion til en ANDEN type er ikke reglens anliggende — heller ikke via alias.
    { relativePath: 'src/x.ts', code: 'const s = value as AppSettings;' },
    { relativePath: 'src/x.ts', code: 'type T = AppSettings;\nconst s = value as T;' },
    // Historik-prosa med præcis mønsteret må ikke flages (kommentarer er ikke AST-noder).
    { relativePath: 'src/x.ts', code: '// Tidligere stod her `{} as SourceSettings`; brug projektoren.\nexport const x = 1;' },
    // De NORMALE eksporter fra samme modul er naturligvis fri.
    { relativePath: 'src/x.ts', code: "import { projectEoRowPolicy, DEFAULT_EO_ROW_POLICY } from '../settings/sourceSettings';" },
    // `define*`-fabrikker parametriseres MED settings-typen og producerer ingen værdi af den. Uden
    // denne undtagelse flagede reglen `reguleringDocumentAction` — et ægte falsk positiv.
    { relativePath: 'src/x.ts', code: 'export const a = defineDocumentAction<Req, SourceSettings, Brevhoved>({ id: "x" });' },
    { relativePath: 'src/x.ts', code: 'export const d = defineMineoDocument<void, In, SourceSettings, Key>({ id: "y" });' },
  ],
});

// --- Cellebinding: én bindingsmodel for grid-/tabelceller (§3.2, §1.11) -------

/** Modulet der ejer cellebindingen. Kun her konstrueres en celles dataidentitet. */
const CELL_BINDING_OWNER = 'src/inputCore/react/cellSpecBuilder.ts';

/** Tabelfladerne, hvis celler skal bindes gennem den fælles bygger. */
const TABLE_SURFACE_DIR = 'src/components/tables';

/**
 * PRIMÆRVÆRNET er TYPEN: `PlaceholderCell.field` er en `FieldRef`, så en celle KAN ikke længere bære
 * et ubundet descriptor + ét række-id. Reglen dækker den rest, typen ikke kan udtale sig om.
 *
 * En tabel kan fortsat kalde `descriptor.bind(rowId)` SELV og lægge resultatet i celle-spec'et. Typen
 * er tilfreds — `bind` returnerer en gyldig `FieldRef` — men ejer-id'erne mangler, og adresseariteten
 * kaster først under render i en NESTED collection. Præcis den fejl ramte EO's løntabel under et
 * ansættelsesforhold: fem tabeller havde hver sin kopi af bindingsreglen, og kun de top-level
 * varianter var dækket af integrationstests, så et manglende ejer-id var usynligt.
 *
 * Den fælles `buildCollectionCellSpec` udleder ejer-id'erne af `collection.path` — den SAMME sti,
 * `insertEntity` og readeren bruger — så ejeren ikke kan glemmes. Reglen holder tabelfladerne på den vej.
 */
export const cellBindingSingleSource = defineRule({
  id: 'input/cell-binding-single-source',
  description:
    'Tabelflader må ikke selv binde en celles dataidentitet med `descriptor.bind(...)`. Cellebindingen '
    + 'ejes af `buildCollectionCellSpec`/`useCollectionCellSpecBuilder`, som udleder ejer-id\'erne af '
    + 'collectionens sti (§3.2) — ellers kan en nested tabel binde med for få entity-led og kaste under render.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath === CELL_BINDING_OWNER
      // AST-signal, ikke tekst.
      || (entry.relativePath.startsWith(`${TABLE_SURFACE_DIR}/`) && hasIdentifier(entry, 'buildCellSpec')),
    rationale:
      'bindingsejeren OG mindst én tabelflade, der bygger celle-specs, findes stadig — forsvinder '
      + 'ejeren, er bindingen flyttet og reglen skal skrives om',
    requiredPaths: [
      CELL_BINDING_OWNER,
      'src/components/tables/useCollectionTable.ts',
      'src/components/tables/StandardLoenTable.tsx',
    ],
  },
  appliesTo: (relativePath) => relativePath.startsWith(`${TABLE_SURFACE_DIR}/`),
  allow: [],
  find: (entry) => {
    const findings: Finding[] = [];
    for (const call of collectCalls(entry)) {
      // `x.bind(...)` hvor kæden nævner en descriptor/feltkilde. `Function.prototype.bind` bruges ikke
      // i tabelfladerne, og et falsk positiv ville uanset skulle gå gennem den fælles bygger.
      if (call.calleeName !== 'bind') continue;
      findings.push({
        position: call.position,
        message:
          `\`${call.calleeText}(...)\` binder en celles dataidentitet lokalt. Brug `
          + '`useCollectionCellSpecBuilder`/`buildCollectionCellSpec`, som udleder ejer-id\'erne af '
          + 'collectionens sti — en lokal binding kan glemme ejeren i en nested collection (§3.2).',
      });
    }
    return findings;
  },
  violatingFixtures: [
    // Den konkrete fejl: kun rækkens id, uden ejerens.
    { relativePath: `${TABLE_SURFACE_DIR}/X.tsx`, code: 'const f = descriptor.bind(renderRow.rowId);' },
    // Også med ejer-id: bindingen skal stadig gå gennem den fælles bygger, ellers findes reglen to steder.
    { relativePath: `${TABLE_SURFACE_DIR}/X.tsx`, code: 'const f = fieldSet.col2.bind(afId, rowId);' },
    { relativePath: `${TABLE_SURFACE_DIR}/Y.tsx`, code: 'const spec = { kind: "existing", field: d.bind(id), location };' },
  ],
  cleanFixtures: [
    // Den ønskede vej.
    {
      relativePath: `${TABLE_SURFACE_DIR}/X.tsx`,
      code: 'const buildCellSpec = useCollectionCellSpecBuilder({ collection, createEmptyRow, locationPrefix, locationNav });',
    },
    { relativePath: `${TABLE_SURFACE_DIR}/X.tsx`, code: 'const spec = buildCellSpec(renderRow, fieldSet.col2, 2);' },
    // Læsning gennem readeren er ikke en cellebinding.
    { relativePath: `${TABLE_SURFACE_DIR}/X.tsx`, code: 'const rows = fieldSet.readRows(reader);' },
    // Historik-prosa i en kommentar er ikke en AST-node.
    { relativePath: `${TABLE_SURFACE_DIR}/X.tsx`, code: '// Tidligere stod her `descriptor.bind(rowId)`.\nexport const x = 1;' },
  ],
});

// --- Programmatisk felt-commit: handlingsknapper settler, de committer ikke immediate (§1.3) ----

/** Komponenten, hvis `onCommit` leverer en programmatisk dato til et TEKSTFELT. */
const TODAY_DATE_BUTTON = 'src/components/inputs/InsertTodayDateButton.tsx';

/**
 * Ligger noden inde i en `onCommit={...}`-JSX-attributs udtryk? Går op gennem forældrekæden frem for at
 * matche tekst, så scopet er attributtens faktiske subtree — et lovligt `commitImmediate` i en anden
 * handler i samme fil rammes derfor ikke.
 */
const isInsideOnCommitAttribute = (node: ts.Node): boolean => {
  for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
    if (!ts.isJsxAttribute(current)) continue;
    const name = ts.isIdentifier(current.name) ? current.name.text : current.name.getText();
    if (name === 'onCommit') return true;
  }
  return false;
};

/**
 * `commitImmediate` bygger `setImmediateField`, som reduceren KUN tillader for choice/toggle. Et datofelt er
 * et text-control, så et `commitImmediate(today)` kaster en uncaught systemfejl i brugerens ansigt — præcis
 * Fejlformen er den samme forkerte kommando kopieret til alle fem dags-dato-knapper.
 *
 * Den rigtige vej er `settleValue`, som sender værdien gennem feltets codec og den normale settle-motor.
 *
 * Reglen kan IKKE formuleres som "sider må ikke kalde commitImmediate": Årslønssidens omregnings-toggle er et
 * lovligt choice/toggle-immediate-commit, og et blankt forbud ville forbyde en korrekt brug. Den kan heller
 * ikke formuleres som en typegrænse uden at føre `controlKind` ind i `FieldRef<T>`s type og dermed røre 236
 * referencer — en pris, der ikke svarer til gevinsten, når reduceren allerede fejler fail-fast.
 *
 * Reglen rammer derfor præcis den påviste fejlform: en `commitImmediate` INDE I den callback, der modtager en
 * programmatisk dato. Ligger kaldet dér, er argumentet en dato, feltet er et text-control, og fejlen er sikker.
 */
export const programmaticFieldCommitUsesSettle = defineRule({
  id: 'input/programmatic-commit-uses-settle',
  description:
    'En handlingsknaps `onCommit` må ikke kalde `commitImmediate` (§1.3). `commitImmediate` bygger '
    + '`setImmediateField`, der kun er lovlig for choice/toggle; en programmatisk leveret tekst-/datoværdi '
    + 'skal gennem `settleValue`, så den parses af feltets codec som en tastet værdi.',
  liveTarget: {
    kind: 'precondition',
    // AST-signal, ikke tekst: `onCommit` skal SÆTTES som JSX-attribut, ikke blot vises i en
    // kommentar som eksempel på prop-formen.
    probe: (entry) => entry.relativePath === TODAY_DATE_BUTTON
      || hasJsxAttribute(entry, 'onCommit'),
    rationale:
      'knappen med den programmatiske `onCommit` findes stadig, og mindst én side bruger den — forsvinder '
      + 'knappen, er den programmatiske commit-vej væk, og reglen skal skrives om',
    requiredPaths: [TODAY_DATE_BUTTON],
    minimumMatches: 2,
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/components/')
    || relativePath.startsWith('src/inputCore/react/'),
  allow: [],
  find: (entry) => {
    const findings: Finding[] = [];
    // Find hver `onCommit={...}`-JSX-attribut og se, om dens udtryk indeholder et `commitImmediate`-kald.
    // Scopet er attributtens SUBTREE, så et lovligt `commitImmediate` andetsteds i filen (fx en
    // toggle-handler) ikke rammes.
    for (const call of collectCalls(entry)) {
      if (call.calleeName !== 'commitImmediate') continue;
      if (!isInsideOnCommitAttribute(call.node)) continue;
      findings.push({
        position: call.position,
        message:
          `\`${call.calleeText}(...)\` ligger i en handlingsknaps \`onCommit\`. Den command er kun lovlig `
          + 'for choice/toggle og kaster på et text-control. Brug `settleValue(...)`, så værdien går gennem '
          + 'feltets codec og den normale settle-vej (§1.3).',
      });
    }
    return findings;
  },
  violatingFixtures: [
    // Den konkrete fejl, på alle fem flader.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const C = () => <InsertTodayDateButton onCommit={(today) => { ctrl.commitImmediate(today); }} />;',
    },
    // Uden krøller om kroppen — samme fejl.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const C = () => <InsertTodayDateButton onCommit={(t) => editor.commitImmediate(t)} />;',
    },
    // Også når kaldet ligger dybere i callbacken.
    {
      relativePath: 'src/components/pages/Y.tsx',
      code: 'const C = () => <B onCommit={(d) => { if (d) { a.b.commitImmediate(d); } }} />;',
    },
  ],
  cleanFixtures: [
    // Den ønskede vej.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const C = () => <InsertTodayDateButton onCommit={(today) => { ctrl.settleValue(today); }} />;',
    },
    // Et LOVLIGT immediate-commit uden for en `onCommit` (choice/toggle) må ikke rammes — ellers ville
    // reglen forbyde Årslønssidens omregnings-toggle, som er korrekt.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const C = () => { const h = (enabled) => { ctrl.commitImmediate(enabled); }; return <Toggle onChange={h} />; };',
    },
    // Feltfamiliens egne choice/toggle-controls committer immediate — deres onChange er ikke en onCommit.
    {
      relativePath: 'src/inputCore/react/fields/ChoiceField.tsx',
      code: 'const h = (next) => { controller.commitImmediate(next); };',
    },
    // Historik-prosa i en kommentar er ikke en AST-node.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: '// Tidligere stod her `onCommit={(t) => c.commitImmediate(t)}`.\nexport const x = 1;',
    },
  ],
});

// --- Issue-capabilityen: consumers blokerer på konkrete reads (§1.10, §3.4) ----

/**
 * En bred issue-capability er rodårsagen til overblokering.
 *
 * Bærer den offentlige `InputReader` et helt `fieldIssues: FieldIssueSnapshot`, kan enhver consumer
 * filtrere `issues.all` på sektionsnavn og blokere på felter, den aldrig læser: ét stamdataissue bliver
 * en global sagsspærring, og en import kan spærre på flere urelaterede sektioner. Præcis dependency
 * skal derfor være en GRÆNSE, ikke en konvention.
 *
 * Grænsen er primært STRUKTUREL: `fieldIssues` er FJERNET fra den offentlige reader, så det brede
 * snapshot slet ikke er i hånden — et genindført sektionsfilter er nu en typefejl. Reglen lukker resten:
 * `issues.all` må ikke nås uden for inputkernen og de navngivne ejere. Den findes, fordi
 * `InputEvaluation.issues` fortsat bærer snapshottet (dokumentlivscyklussen skal have tokenet), og
 * `.all` derfra ville genåbne hullet UDEN en typefejl.
 *
 * Consumeren skal i stedet læse konkrete `FieldRef`s. En projektion, der skal samle fejl fra mange reads,
 * bruger `createTrackedInputReader`, som kun opsamler issues fra netop disse reads.
 */
const ISSUE_SNAPSHOT_OWNERS = 'src/inputCore/';

/**
 * De navngivne ejere uden for inputkernen, der legitimt aftager et helt issue-sæt.
 *
 * `eoInputIssues.ts` er EO's PRÆSENTATIONS-katalog: det modtager et allerede sektionsafgrænset
 * `FieldIssueSet` som parameter og bygger rækkevisninger af det. Det læser ikke selv et bredt snapshot
 * fra readeren, og dets output gater ingen beregning.
 */
const ISSUE_SET_CONSUMERS: readonly string[] = [
  'src/domain/erstatningsopgoerelse/eoInputIssues.ts',
];

export const issueSnapshotCapabilityBoundary = defineRule({
  id: 'input/issue-snapshot-capability-boundary',
  description:
    'Det brede feltissue-snapshot (`issues.all`) læses kun i inputkernen. Consumers uden for kernen '
    + 'blokerer på konkrete reads — `reader.read(field)` eller `createTrackedInputReader` — så en gate ikke kan blokere bredere end sine '
    + 'faktiske dependencies (§1.10, §3.4).',
  liveTarget: {
    kind: 'precondition',
    // Reglen hviler på TRE forudsætninger, og hver af dem skal kunne konstateres i kildegrafen. Proben
    // genkender derfor hver fil på SIT eget mærke — ellers ville `requiredPaths` (som kræver, at hver
    // forudsat fil selv matcher proben) være selvmodsigende, og reglen kunne stå halvt død.
    probe: (entry) => {
      // Alle tre signaler er AST-noder, ikke tekst: et `FieldIssueSet`-medlem, en erklæret
      // funktion og en member-læsning kan hver især ikke opfyldes af en kommentar eller en streng.
      //
      // 1) Den brede capability findes stadig. Forsvinder `all`, er der intet at regulere.
      if (entry.relativePath === 'src/inputCore/inputIssue.ts') {
        return hasDeclaredMember(entry, 'all');
      }
      // 2) Den navngivne, smalle erstatning findes. Uden den ville reglen forbyde den brede vej uden at
      //    efterlade en lovlig vej — og den næste consumer ville omgå grænsen i stedet.
      if (entry.relativePath === 'src/inputCore/inputReader.ts') {
        return hasIdentifier(entry, 'createTrackedInputReader');
      }
      // 3) Præsentationsundtagelsen aftager stadig et helt sæt. Gør den ikke det, skal undtagelsen væk.
      if (ISSUE_SET_CONSUMERS.includes(entry.relativePath)) return hasMemberRead(entry, 'all');
      return false;
    },
    rationale:
      'reglen forudsætter BÅDE det brede `all` på `FieldIssueSet`, den smalle '
      + '`createTrackedInputReader`-erstatning OG at præsentationsundtagelsen stadig aftager et helt sæt '
      + '— falder en af dem væk, skal reglen omskrives eller slettes',
    minimumMatches: 3,
    requiredPaths: [
      'src/inputCore/inputIssue.ts',
      'src/inputCore/inputReader.ts',
      ...ISSUE_SET_CONSUMERS,
    ],
  },
  allow: [],
  find: (entry) => {
    if (entry.relativePath.startsWith(ISSUE_SNAPSHOT_OWNERS)) return [];
    if (ISSUE_SET_CONSUMERS.includes(entry.relativePath)) return [];
    const findings: Finding[] = [];
    for (const ref of collectMemberAccess(entry)) {
      // Vi måler AST-medlemskæden, ikke tekst: en kommentar om `issues.all` er ikke en adgang, og
      // `result.all` på noget andet end et issue-sæt rammes ikke (kæden skal ende på `.issues.all`).
      if (!/(?:^|\.)issues\.all$/.test(ref.chainText)) continue;
      findings.push({
        position: ref.position,
        message:
          'Bred issue-adgang uden for inputCore — blokér på konkrete reads via `reader.read(field)`, '
          + 'og saml flerfeltsissues med `createTrackedInputReader` (§1.10).',
      });
    }
    return findings;
  },
  violatingFixtures: [
    // Den ene overblokeringsform: en sektionsvis blokering.
    {
      relativePath: 'src/domain/x/xImportPort.ts',
      code: 'const bad = evaluation.issues.all.some((i) => i.field.address.section === "stamdata");',
    },
    // …og den anden: en global fail-closed på hele snapshottet.
    {
      relativePath: 'src/domain/y/ySnapshot.ts',
      code: 'const blocked = ev.issues.all.length > 0;',
    },
  ],
  cleanFixtures: [
    // Den ønskede vej: ét konkret felt.
    { relativePath: 'src/domain/x/y.ts', code: 'const r = reader.read(field);' },
    // En tracked projektion opsamler kun de konkrete refs, den selv læser.
    {
      relativePath: 'src/domain/x/y.ts',
      code: 'const tracked = createTrackedInputReader(reader); tracked.reader.read(field);',
    },
    // Inputkernen ejer selv den brede form.
    {
      relativePath: 'src/inputCore/inputReader.ts',
      code: 'const all = options.issues.all.filter((i) => i.field.address.section === section);',
    },
    // Præsentationskataloget aftager et allerede afgrænset sæt som parameter.
    {
      relativePath: 'src/domain/erstatningsopgoerelse/eoInputIssues.ts',
      code: 'export const f = (issues) => issues.all.find((i) => i.code === "x");',
    },
    // `.all` på noget andet end et issue-sæt er ikke reglens ærinde.
    { relativePath: 'src/domain/x/y.ts', code: 'const n = results.all.length;' },
    // Prosa i en kommentar er ingen AST-node og må ikke kunne udløse et fund.
    {
      relativePath: 'src/domain/x/y.ts',
      code: '// Consumeren læser konkrete FieldRefs, ikke `evaluation.issues.all.some(...)`.\nexport const x = 1;',
    },
  ],
});

// --- Afledte felter skrives i reduktionen, ikke fra en effect (§3.6) -----------

/**
 * Et AFLEDT felt er en konsekvens af brugerens valg, ikke en selvstændig handling.
 *
 * Beregnes en afledt værdi (fx EO's overenskomstbundne satser) efter render og skrives af en `useEffect`,
 * bliver den en NY autoritativ handling: én oplevet brugerhandling giver to history-trin, og et undo kan
 * straks blive skrevet tilbage af den samme effect, fordi det styrende valg stadig er aktivt. Afledte
 * værdier hører derfor i en ren domæneprojektion og materialiseres aldrig som input.
 *
 * Dette værn erstatter et tekstbaseret forbud, der var GRØNT AF TOMHED: dets fire mønstre
 * (`setValues(`, `setFormValues(`, `replaceFormValues(`, `onAnsaettelsesforholdChange(`) var alle
 * legacy-funktionsnavne, som ikke længere fandtes nogen steder i kildegrafen, og dets allowlist-markør
 * fandtes heller ikke i den fil, den fritog. Reglen kunne derfor ikke fejle — heller ikke på den effect,
 * den var skrevet for at bevogte.
 *
 * Reglen måler nu den AKTUELLE skrivevej: et `edit.dispatch(...)`/`dispatchInput(...)`-kald inde i et
 * `useEffect`-vindue. Det er den ene vej, en effect faktisk KAN skrive sagsinput ad, efter at hele den
 * parallelle legacy-inputklynge er slettet.
 */
const DISPATCH_CALLEES: readonly string[] = ['dispatch', 'dispatchInput'];

/** Moduler der legitimt dispatcher fra en effect: shell-bootstrap og hel-sags-replacement, ikke feltafledning. */
const EFFECT_DISPATCH_OWNERS: readonly string[] = [
  // Preflight/PWA-load afslutter en HEL-SAGS-erstatning, som brugeren selv startede uden for React —
  // den er ikke en feltafledning og har ingen anden mulig placering end en effect.
  'src/hooks/useFileSaveLoad.ts',
];

const isInsideUseEffect = (node: ts.Node): boolean => {
  for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
    if (!ts.isCallExpression(current)) continue;
    const { expression } = current;
    const name = ts.isIdentifier(expression)
      ? expression.text
      : ts.isPropertyAccessExpression(expression) ? expression.name.text : '';
    if (name === 'useEffect' || name === 'useLayoutEffect') return true;
  }
  return false;
};

export const derivedValuesNotWrittenFromEffects = defineRule({
  id: 'input/derived-values-are-not-input-writes',
  description:
    'En afledt værdi bygges i en domæneprojektion og må ikke skrives som sagsinput fra en React-effect.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => hasIdentifier(entry, 'useEffect'),
    rationale:
      'React-effects findes fortsat i komponentlaget og må ikke bruges som skjult inputskrivevej',
    requiredPaths: ['src/components/reports/ContentBoxReportDialog.tsx'],
    minimumMatches: 1,
  },
  appliesTo: (relativePath) => (
    relativePath.startsWith('src/components/') || relativePath.startsWith('src/hooks/')
  ) && !EFFECT_DISPATCH_OWNERS.includes(relativePath),
  allow: [],
  find: (entry) => {
    const findings: Finding[] = [];
    for (const call of collectCalls(entry)) {
      if (!DISPATCH_CALLEES.includes(call.calleeName)) continue;
      if (!isInsideUseEffect(call.node)) continue;
      findings.push({
        position: call.position,
        message:
          `\`${call.calleeText}(...)\` skriver sagsinput fra en React-effect. Er værdien AFLEDT af andre `
          + 'felter, skal den udledes i consumerens typed domæneprojektion — ellers bliver afledt state '
          + 'fejlagtigt til persisteret brugerinput og et selvstændigt history-trin.',
      });
    }
    return findings;
  },
  violatingFixtures: [
    // Den konkrete fejl: satserne skrevet efter render.
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/loenindkomst/useX.ts',
      code: 'const f = () => { React.useEffect(() => { edit.dispatch(inputTransaction(steps)); }, [x]); };',
    },
    // Uden React-præfiks — samme fejl.
    {
      relativePath: 'src/hooks/useY.ts',
      code: 'const f = () => { useEffect(() => { if (n) edit.dispatch(cmd); }, [n]); };',
    },
    // Et layout-effect er samme problem: skrivningen er stadig en selvstændig handling.
    {
      relativePath: 'src/components/pages/Z.tsx',
      code: 'const f = () => { React.useLayoutEffect(() => { dispatchInput(store, catalog, cmd); }, []); };',
    },
  ],
  cleanFixtures: [
    // En dispatch fra en brugerudløst handler er hele pointen — den må ikke rammes.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const f = () => { const h = () => { edit.dispatch(cmd); }; return h; };',
    },
    // En effect uden en input-dispatch (fx scroll) er ikke reglens ærinde.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const f = () => { React.useEffect(() => { scrollTargetIntoView(el); }, [el]); };',
    },
    // En anden slags dispatch i en effect (fx en ren UI-reducer) er ikke en sagsinput-skrivning …
    // men reglen kan ikke se forskel på navnet alene, så den fanger den bevidst: alternativet ville være
    // en type-baseret sondring, som ikke findes i AST'et. Derfor dækker cleanFixture kun det ANDET navn.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const f = () => { React.useEffect(() => { setLocalState(1); }, []); };',
    },
    // Prosa i en kommentar er ingen AST-node og må ikke kunne udløse et fund.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: '// Afledte værdier hører i en ren domæneprojektion, ikke i en effect-skrivning.\nexport const x = 1;',
    },
  ],
});

// --- Fortegns-politik: feltets descriptor bestemmer, ikke komponenten ---------------------------

/** Modulet der ejer opslaget fra descriptor til fortegns-politik. */
const SIGN_POLICY_OWNER = 'src/inputCore/react/fields/signPolicy.ts';

/** Modulet der ejer tegnfiltrene. Her ER `allowNegative` en parameter og ikke en beslutning. */
const KEY_FILTER_OWNER = 'src/components/inputs/inputKeyFilters.ts';

/**
 * De tegnfiltre, hvis `allowNegative` skal komme fra feltets descriptor. `filterFractionKeyDown` er
 * bevidst UDE: brøkfamilien har ingen `signPolicy`, og dens fortegn er en egenskab ved brøk-formatet.
 */
const SIGN_SENSITIVE_KEY_FILTERS = new Set<string>([
  'filterIntegerKeyDown',
  'filterPercentKeyDown',
  'filterAmountExpressionKeyDown',
]);

/**
 * Er `allowNegative` sat til en LITERAL (`true`/`false`) i dette objekt-argument?
 *
 * En literal er netop den fejlform, fundet handlede om: komponenten svarer på feltets vegne. En variabel,
 * en property-adgang eller et kald er tilladt — de kan bære politikken fra descriptoren.
 */
const hasLiteralAllowNegative = (argument: ts.Expression): ts.Node | undefined => {
  if (!ts.isObjectLiteralExpression(argument)) return undefined;
  for (const property of argument.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = ts.isIdentifier(property.name) ? property.name.text : undefined;
    if (name !== 'allowNegative') continue;
    const value = property.initializer;
    if (value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword) {
      return property;
    }
  }
  return undefined;
};

/**
 * Et felts FORTEGNS-politik ejes af dens descriptor, ikke af den komponent der tegner den.
 *
 * **Fejlformen, reglen forhindrer.** `allowNegative` var erklæret på hvert numerisk codec i
 * produktionskataloget — og honoreret af INGENTING. Hver feltkomponent hardkodede sit eget svar, og de var
 * indbyrdes uenige for de SAMME descriptorer: `GridPercentCell` blokerede minus, `PercentField` tillod det.
 * Brugeren kunne derfor taste et minustegn i et procentfelt, der ikke må være negativt.
 *
 * Typen kan ikke lukke resten: `allowNegative` er en almindelig `boolean` i filter-optionerne, så en literal
 * `true` kompilerer fint. Reglen holder derfor callsitene på den fælles vej — `fieldAllowsNegative(field)` /
 * `codecAllowsNegative(descriptor.codec)` — så en NY numerisk feltkomponent ikke kan vælge selv.
 *
 * Scopet er bevidst bredt (hele `src/`, ikke kun feltmapperne): drifterne stod netop i en sidekomponent
 * (`MenberegningTab`) og en tabel (`BeregnetRenteTable`), ikke i den fælles feltfamilie.
 */
export const fieldSignPolicyFromDescriptor = defineRule({
  id: 'input/sign-policy-from-descriptor',
  description:
    'Et tegnfilters `allowNegative` må ikke være en hardkodet literal i en komponent. Fortegns-politikken '
    + 'erklæres på feltets codec og læses med `fieldAllowsNegative(field)` / `codecAllowsNegative(codec)` '
    + '— ellers kan to flader af samme feltfamilie svare forskelligt for den samme descriptor.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath === SIGN_POLICY_OWNER
      || collectCalls(entry).some((ref) => SIGN_SENSITIVE_KEY_FILTERS.has(ref.calleeName)),
    rationale:
      'politik-opslaget OG mindst ét fortegns-følsomt tegnfilter-callsite findes stadig — forsvinder '
      + 'opslaget, er politikken flyttet og reglen skal skrives om',
    requiredPaths: [
      SIGN_POLICY_OWNER,
      'src/inputCore/react/fields/PercentField.tsx',
      'src/inputCore/react/fields/gridCells.tsx',
    ],
  },
  // Filter-ejeren undtages: dér ER `allowNegative` parameteren, og dens defaults hører i implementeringen.
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/') && relativePath !== KEY_FILTER_OWNER,
  allow: [],
  find: (entry) => {
    const findings: Finding[] = [];
    for (const call of collectCalls(entry)) {
      if (!SIGN_SENSITIVE_KEY_FILTERS.has(call.calleeName)) continue;
      for (const argument of call.node.arguments) {
        const offender = hasLiteralAllowNegative(argument);
        if (offender === undefined) continue;
        const { line, character } = entry.ast.getLineAndCharacterOfPosition(offender.getStart(entry.ast));
        findings.push({
          // 1-baseret som resten af manifestet, så fil:linje:kolonne kan klikkes.
          position: { line: line + 1, column: character + 1 },
          message:
            `\`${call.calleeName}\` får en hardkodet \`allowNegative\`-literal. Fortegns-politikken ejes af `
            + 'feltets codec — brug `fieldAllowsNegative(field)` eller `codecAllowsNegative(descriptor.codec)`, '
            + 'så formular og grid ikke kan svare forskelligt for samme descriptor.',
        });
      }
    }
    return findings;
  },
  violatingFixtures: [
    // Den konkrete fejl: brugerens symptom.
    {
      relativePath: 'src/inputCore/react/fields/X.tsx',
      code: 'const f = (e) => filterPercentKeyDown(e, { allowNegative: true, allowDecimals: true });',
    },
    // Også en KORREKT literal er forbudt: den er en anden samtidig sandhed om feltets politik.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const f = (e) => filterIntegerKeyDown(e, { allowNegative: false });',
    },
    {
      relativePath: 'src/components/tables/X.tsx',
      code: 'const f = (e) => filterAmountExpressionKeyDown(e, { allowNegative: true, allowDecimals: true });',
    },
  ],
  cleanFixtures: [
    // Den ønskede vej: politikken læses af feltet.
    {
      relativePath: 'src/inputCore/react/fields/X.tsx',
      code: 'const a = fieldAllowsNegative(field);\nconst f = (e) => filterPercentKeyDown(e, { allowNegative: a, allowDecimals: true });',
    },
    // Modulniveau-konstant udledt af descriptorens codec er samme vej.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const A = codecAllowsNegative(mengradField.codec);\nconst f = (e) => filterIntegerKeyDown(e, { allowNegative: A });',
    },
    // Brøkfilteret er ikke fortegns-følsomt i denne forstand (ingen `signPolicy` i familien).
    {
      relativePath: 'src/inputCore/react/fields/X.tsx',
      code: 'const f = (e) => filterFractionKeyDown(e, { maxDigits: 4, allowNegative: false });',
    },
    // En kommentar, der blot NÆVNER literalen, er ikke en AST-node.
    {
      relativePath: 'src/inputCore/react/fields/X.tsx',
      code: '// Tidligere: `filterPercentKeyDown(e, { allowNegative: true })`.\nexport const x = 1;',
    },
  ],
});
