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
  collectCalls,
  collectElementAccess,
  collectIdentifiers,
  collectImports,
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
 * Rettelsen er at fjerne muligheden i stedet for at bevogte den: `SlimInputStore` er nu en HANDLE med
 * navngivne, validerede transaktioner (`applyCommit`/`hydrate`/`restore`/`bumpSettingsRevision`), og
 * Zustands `StoreApi` forlader aldrig `slimInputStore.ts`. Der findes ikke længere et `setState` at
 * kalde, et vidne at forfalske eller en udsteder at aliasere.
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
    'Kun runneren skriver input (§3.6). Grænsen er STRUKTUREL: `SlimInputStore` er en handle med '
    + 'navngivne transaktioner, og Zustands `StoreApi` (og dermed `setState`) forlader aldrig '
    + '`slimInputStore.ts`. Reglen dækker resterne: en nyimporteret rå Zustand-store til input, og '
    + 'produktionsbrug af den isolerede testfabrik.',
  liveTarget: {
    kind: 'precondition',
    // Proben rammer store-ejeren og enhver fil, der kalder en af handlens SKRIVE-transaktioner.
    // `hydrate` er med, fordi hydreringsvejen er en autoritativ skriver på lige fod med commit-vejen.
    probe: (entry) => entry.relativePath === INPUT_STORE_OWNER
      || /\.(?:applyCommit|hydrate|restore)\(/.test(entry.text),
    rationale:
      'skrivegrænsens moduler (store-ejeren + de autoritative skriveveje der kalder `applyCommit`) '
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

    // Testfabrikken bygger en ISOLERET runtime. I produktionsgrafen ville et kald betyde, at to
    // runtimes kunne repræsentere hver sin sag samtidig.
    for (const ref of collectCalls(entry)) {
      if (ref.calleeName === '__createSlimInputTestStore') {
        findings.push({
          position: ref.position,
          message:
            'Produktionskode må ikke bygge en isoleret test-runtime (`__createSlimInputTestStore`) — '
            + 'brug den monterede binding, så al kode ser den samme sag (§3.10).',
        });
      }
    }

    return findings;
  },
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: "import { createStore } from 'zustand/vanilla';" },
    { relativePath: 'src/components/x.tsx', code: "import { create } from 'zustand';" },
    // Også inde i inputCore — men uden for det ene modul der ejer storen.
    { relativePath: 'src/inputCore/react/x.ts', code: "import { createStore } from 'zustand/vanilla';" },
    { relativePath: 'src/components/x.tsx', code: 'const s = __createSlimInputTestStore();' },
  ],
  cleanFixtures: [
    // Ejeren må naturligvis importere Zustand.
    {
      relativePath: 'src/inputCore/runtime/slimInputStore.ts',
      code: "import { createStore } from 'zustand/vanilla';",
    },
    // De autoritative skriveveje bruger handlens navngivne transaktioner.
    {
      relativePath: 'src/inputCore/runtime/dispatchInput.ts',
      code: 'store.applyCommit(commit);',
    },
    {
      relativePath: 'src/inputCore/runtime/initializeInputRuntime.ts',
      code: 'store.hydrate(input);',
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

// --- Systemporten: kun composition roots må mutere hele sagen ------------------

/**
 * `useInputSystemPort` bærer sektionsreset, hel-sags-replacement, history og de kritiske handlinger.
 * De operationer kan ikke udtrykkes som en feltredigering, og en celle må aldrig kunne formulere dem.
 *
 * Grænsen er primært STRUKTUREL: porten er skilt ud fra `InputEditPort`, så en editor-flade slet ikke
 * har `replaceCase` i hånden. Reglen holder PRODUCENTLISTEN lukket — hvem der overhovedet henter
 * systemporten — for ellers kunne en ny celleflade tilføje kaldet lydløst, og adskillelsen ville være
 * tilbage til en aftale.
 */
const SYSTEM_PORT_COMPOSITION_ROOTS: readonly string[] = [
  // Case-/persistence-porten: load, save, reset, `Slet alt`.
  'src/inputCore/react/useCaseOperations.ts',
  // Læse-/evalueringsbroen henter kun den kritiske handlingsbarriere videre til shellen.
  'src/inputCore/react/useInputEvaluation.ts',
  // Shellens globale undo/redo-genveje.
  'src/inputCore/react/useUndoRedoShortcuts.ts',
  // En sidesektions eksplicitte "Slet alle indtastninger" (renteberegning).
  'src/components/pages/renteberegning/RenteberegningTab.tsx',
];

export const systemPortCompositionRoot = defineRule({
  id: 'input/system-port-composition-root',
  description:
    'Systemporten (sektionsreset, hel-sags-replacement, history, kritiske handlinger) hentes kun af '
    + 'composition roots. En felt-/celleflade bruger `useInputEditPort` og kan derfor pr. konstruktion '
    + 'ikke udstede en hel-sagsmutation (§3.6).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => hasIdentifier(entry, 'useInputSystemPort'),
    rationale:
      'systemporten findes stadig og hentes af mindst én composition root — forsvinder den, er '
      + 'capability-opdelingen ændret og reglen skal skrives om',
    requiredPaths: [
      'src/inputCore/react/inputRuntimeContext.tsx',
      ...SYSTEM_PORT_COMPOSITION_ROOTS,
    ],
  },
  allow: [],
  find: (entry) => {
    // Definitionsstedet er ikke en kalder.
    if (entry.relativePath === 'src/inputCore/react/inputRuntimeContext.tsx') return [];
    if (SYSTEM_PORT_COMPOSITION_ROOTS.includes(entry.relativePath)) return [];
    return collectCalls(entry)
      .filter((ref) => ref.calleeName === 'useInputSystemPort')
      .map((ref) => ({
        position: ref.position,
        message:
          'Systemporten hentes uden for en composition root — en felt-/celleflade må ikke kunne '
          + 'nulstille en sektion eller erstatte hele sagen. Brug `useInputEditPort` (§3.6).',
      }));
  },
  violatingFixtures: [
    { relativePath: 'src/components/inputs/X.tsx', code: 'const s = useInputSystemPort();' },
    { relativePath: 'src/components/pages/erstatningsopgoerelse/Y.tsx', code: 'const { replaceCase } = useInputSystemPort();' },
  ],
  cleanFixtures: [
    { relativePath: 'src/inputCore/react/useCaseOperations.ts', code: 'const system = useInputSystemPort();' },
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
const FORBIDDEN_LEGACY_IDENTIFIERS: readonly string[] = [
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
