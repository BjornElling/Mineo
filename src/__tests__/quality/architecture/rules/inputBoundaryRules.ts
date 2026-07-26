/**
 * Inputgrænser og legacy-fravær.
 *
 * Skrivegrænsen, den rå sektionsadgang, systemportens producentliste, de transiente controls og
 * forbudt-identifier-gaten. Kernen i §3.6's capability-opdeling.
 *
 * Del af det opdelte arkitekturmanifest (Fase 6, genåbnet): manifestet var 2.133 linjer og blandede
 * storage-, input-, domæne-, UI- og dokumentregler i én fil, hvor en regel og dens nabo intet havde
 * med hinanden at gøre. `architectureRules.ts` samler nu de fem koncern-moduler til ét registry.
 */
import {
  collectCallTypeArguments,
  collectElementAccess,
  collectIdentifiers,
  collectImports,
  collectLocalTypeAliases,
  collectTypeAssertions,
  hasIdentifier,
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
    probe: (entry) => entry.relativePath === INPUT_STORE_OWNER
      || /\b(?:registerSlimInputStoreInternals|hydrateInputStoreOnce|dispatchInput)\b/.test(entry.text),
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
 * Reglen blev tilføjet efter Fase 6's genåbning: der fandtes præcis ét sådant opslag uden for
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
const RAW_SECTION_SERIALIZERS: readonly string[] = ['src/persistence/eoSaveProjection.ts'];

export const rawSectionAccessBoundary = defineRule({
  id: 'domain/raw-section-access-boundary',
  description:
    'Rå `…input.sections[...]`-opslag hører i `src/inputCore/` (readeren + den navngivne '
    + 'diagnostikprojektion). Alle andre lag læser gennem `InputReader`/projektionen (§3.4), så en '
    + 'værdi bag en rød feltfejl forbliver skjult og gates blokerer korrekt.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => (entry.relativePath.startsWith(RAW_SECTION_OWNERS)
      || RAW_SECTION_SERIALIZERS.includes(entry.relativePath))
      && /\.sections\b/.test(entry.text),
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
  find: (entry) => {
    if (entry.relativePath.startsWith(RAW_SECTION_OWNERS)) return [];
    if (RAW_SECTION_SERIALIZERS.includes(entry.relativePath)) return [];
    return collectElementAccess(entry)
      // `chainText` er hele udtrykket inkl. subscript; vi matcher på objektet FØR `[`, så både
      // `x.input.sections[k]` og `sections[k]` rammes, men `rows[i]` ikke gør.
      .filter((ref) => /(?:^|\.)sections$/.test(ref.chainText.split('[')[0]?.trim() ?? ''))
      .map((ref) => ({
        position: ref.position,
        message:
          'Rå sektionsadgang uden for inputCore — læs gennem `useInputEvaluation`/en domæneprojektion, '
          + 'eller (til diagnostik) gennem `useInputDiagnostics` (§3.4).',
      }));
  },
  violatingFixtures: [
    {
      relativePath: 'src/components/layout/X.tsx',
      code: 'const s = runtime.getSettled().input.sections[pageKey];',
    },
    { relativePath: 'src/domain/x/y.ts', code: 'const v = snapshot.input.sections["satser"];' },
  ],
  cleanFixtures: [
    // Inputkernen selv ejer den rå form.
    {
      relativePath: 'src/inputCore/react/inputDiagnosticsProjection.ts',
      code: 'const s = read.getSettled().input.sections[pageKey];',
    },
    // Læsning gennem readeren/projektionen er hele pointen.
    { relativePath: 'src/domain/x/y.ts', code: 'const v = reader.read(field);' },
    // Et element-opslag på noget ANDET end `sections` er ikke reglens ærinde.
    { relativePath: 'src/domain/x/y.ts', code: 'const v = rows[index];' },
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
 * parallelle inputvej, greenfield-cutoveren slettede ("genindfør ALDRIG en Styled*Field-familie").
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
 * Fase 6's forbudt-symbol-gate, med planens liste KORRIGERET mod den faktiske kildetilstand.
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
 * `usePersistedForm` og `useSliceRowDrafts` blev afklaret i WI-012's pass 1: begge har NUL identifiers
 * i produktionen (og `usePersistedForm` har ingen definition overhovedet), så de hører hjemme på listen.
 *
 * `EoInputIssueSource`/`EoFieldIssuesBySource` er tilføjet efter Fase 6's genåbning: EO's parallelle
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
        `Genindført legacy-symbol '${ref.text}' — mekanismen er slettet i greenfield-cutoveren. `
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
      code: '// Nøglen `mineo_invalidDrafts` findes ikke: invalidDrafts-kanalen er slettet (trin 13).',
    },
    {
      relativePath: 'src/x.ts',
      code: '/** Erstatter `usePersistedForm`/`useDraftField`-vejen med den ene write-grænse. */\nexport const x = 1;',
    },
    // Strengliterale (fx i et manifest eller en fejlbesked) er heller ikke identifiers.
    { relativePath: 'src/x.ts', code: 'const names = ["useRowDrafts", "invalidDrafts"];' },
    // Levende greenfield-vokabular må ikke rammes: `fieldErrors` er det nuværende feltnavn i
    // snapshot-/projektionskontrakterne. (`blocksSave` stod tidligere i denne fixture som "levende" —
    // det var netop fejlklassifikationen Fase 6's genåbning rettede; navnet er nu forbudt.)
    { relativePath: 'src/x.ts', code: 'const { fieldErrors } = snapshot;' },
    // En KOMMENTAR om den slettede boolean skal fortsat bevares.
    { relativePath: 'src/x.ts', code: '// INGEN blocksSave-booleans: konsekvensen udledes strukturelt.\nexport const x = 1;' },
  ],
});

// --- Source-settings-snapshottet: kun projektoren konstruerer det (WI-009) ----

/** Modulet der ejer de to nominelle settings-snapshots og deres projektorer. */
const SOURCE_SETTINGS_OWNER = 'src/settings/sourceSettings.ts';

/** De brandede settings-typer, kun projektorerne må stemple. */
const BRANDED_SETTINGS_TYPE_NAMES = ['SourceSettings', 'EoRowPolicy'] as const;
const BRANDED_SETTINGS_TYPES: ReadonlySet<string> = new Set(BRANDED_SETTINGS_TYPE_NAMES);

/** Typernes eneste konstruktører. Deres fravær betyder, at grænsen er flyttet. */
const PROJECTOR_NAMES = ['projectSourceSettings', 'projectEoRowPolicy'] as const;

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
 * flyde ind i evaluering, rækkepolitik eller dokumentcapture — hvilket var WI-009's hul: en læsning
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
    + `${SOURCE_SETTINGS_OWNER} (WI-009). Grænsen er STRUKTUREL: begge typer er nominelle, så hele `
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
          + 'gøre et optaget `EvaluationSourceToken` stale (WI-009).',
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
          + 'værdien med `projectSourceSettings`/`projectEoRowPolicy` (WI-009).',
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
            + 'projicere det committede `AppSettings` (WI-009).',
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
