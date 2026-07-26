import type { PersistedSectionKey } from '../../../config/persistenceRegistry';
import { isValidStorageKey } from '../../../config/storageManifest';
import ts from 'typescript';
import { collectCalls, collectImports, collectTypeAssertions, resolveRelativeImport } from './astQueries';
import type { SourceEntry } from './sourceGraph';
import {
  defineRule,
  forbidCalls,
  forbidElementAccess,
  forbidImports,
  forbidMemberAccess,
  forbidTypeAssertions,
  type ArchitectureRule,
  type Finding,
} from './ruleKit';

/**
 * Deklarativt manifest af de AST-baserede arkitekturgrænser (greenfield #48).
 *
 * Hver regel er én post her — scope, forbudt mønster, auditeret allowlist og
 * positive/negative fixtures samlet ét sted. `architectureRules.test.ts` kører
 * manifestet mod den kanoniske kilde-graf (forventer nul overtrædelser), beviser
 * hver regel ikke er inert (fixtures) og håndhæver anti-rot generisk.
 *
 * Reglerne erstatter de tidligere håndrullede directory-walk + regex/substring-
 * scannere, hvis egne kommentarer indrømmede silent-pass-huller (aliasing,
 * destrukturering, bracket-notation) — huller AST'en lukker strukturelt.
 */

// --- Storage-globaler: al adgang skal gå gennem de kanoniske wrappere ---------

const isDirectLocalStorageAccess = (chainText: string, rootName: string): boolean =>
  rootName === 'localStorage' || /^(?:window|globalThis)\.localStorage(?:\.|$)/.test(chainText);

const isDirectSessionStorageAccess = (chainText: string, rootName: string): boolean =>
  rootName === 'sessionStorage' || /^(?:window|globalThis)\.sessionStorage(?:\.|$)/.test(chainText);

const localStorageBoundary = forbidMemberAccess({
  id: 'storage/local-storage-boundary',
  description:
    'Direkte window.localStorage-adgang er kun tilladt i den kanoniske safeLocalStorage-wrapper.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => /\blocalStorage\b/.test(entry.text),
    rationale: 'mindst én fil rører localStorage — ellers har grænsen ingen trafik at regulere',
  },
  allow: ['src/utils/safeLocalStorage.ts'],
  forbidden: (ref) => isDirectLocalStorageAccess(ref.chainText, ref.rootName),
  message: (ref) => `Rå localStorage-adgang (${ref.chainText}) — brug safeLocalStorage-wrapperen.`,
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'const x = localStorage.getItem("k");' },
    { relativePath: 'src/x.ts', code: 'window.localStorage.setItem("k", "v");' },
    { relativePath: 'src/x.ts', code: 'const ls = window.localStorage;' },
  ],
  cleanFixtures: [
    { relativePath: 'src/x.ts', code: '// merge af settings fra localStorage' },
    { relativePath: 'src/x.ts', code: 'const s = config.localStorage;' },
  ],
});

const sessionStorageBoundary = forbidMemberAccess({
  id: 'storage/session-storage-boundary',
  description:
    'Direkte sessionStorage-adgang er kun tilladt i persistence-infrastrukturen og den kanoniske helper.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => /\bsessionStorage\b/.test(entry.text),
    rationale: 'mindst én fil rører sessionStorage — ellers har grænsen ingen trafik at regulere',
  },
  // Kun den kanoniske helper tilbage: de øvrige poster var stale efter greenfield-cutoveren (filerne er
  // slettet, eller de rører ikke længere sessionStorage direkte). Anti-rot-testen håndhæver, at hver post
  // stadig udløser reglen, så listen ikke stille kan vokse til død konfiguration.
  allow: [
    'src/utils/safeSessionStorage.ts',
  ],
  forbidden: (ref) => isDirectSessionStorageAccess(ref.chainText, ref.rootName),
  message: (ref) =>
    `Rå sessionStorage-adgang (${ref.chainText}) uden for persistence-infrastrukturen.`,
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'const x = sessionStorage.getItem("k");' },
    { relativePath: 'src/x.ts', code: 'window.sessionStorage.removeItem("k");' },
  ],
  cleanFixtures: [
    { relativePath: 'src/x.ts', code: 'const ok = typeof sessionStorage !== "undefined";' },
    { relativePath: 'src/x.ts', code: 'const s = store.sessionStorage;' },
  ],
});

/**
 * Skrivning må kun ske til en manifest-registreret nøgle.
 *
 * PRIMÆRVÆRNET er typen, ikke denne regel: `writeSessionStorageValue`/
 * `writeOptionalSessionStorageValue` tager en `ManifestStorageKey`, som kun `storageManifest` kan
 * producere. Det fanger også ikke-literale nøgler (`const k = 'mineo_invalidDrafts'`), som en
 * AST-regel principielt ikke kan se.
 *
 * Reglen bevares som SEKUNDÆR diagnostik med en præcis fejlbesked, og dækker begge skriveveje —
 * ikke kun den rå. En regel, der udelukkende matchede `sessionStorage.setItem`, ville være inert,
 * fordi `storage/session-storage-boundary` allerede forbyder den vej uden for helperen.
 */
const SESSION_STORAGE_WRITE_HELPERS = new Set([
  'writeSessionStorageValue',
  'writeOptionalSessionStorageValue',
]);

const sessionStorageManifestKey = forbidCalls({
  id: 'storage/session-storage-manifest-key',
  description:
    'sessionStorage-skrivning må kun ske til en manifest-registreret literal storage-key — både rå og via safeSessionStorage-helperne.',
  // Sekundært værn (primærværnet er `ManifestStorageKey`-typen), men ikke en fraværsregel: den
  // kontrollerer ægte skrive-callsites, og forsvinder de, er reglen uden mål.
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      collectCalls(entry).some(
        (ref) => SESSION_STORAGE_WRITE_HELPERS.has(ref.calleeName) || ref.calleeText.endsWith('sessionStorage.setItem')
      ),
    rationale: 'mindst ét sessionStorage-skrive-callsite (rå eller via helper) findes',
  },
  forbidden: (ref) =>
    ((ref.calleeName === 'setItem' &&
      (ref.calleeText === 'sessionStorage.setItem' ||
        ref.calleeText === 'window.sessionStorage.setItem' ||
        ref.calleeText === 'globalThis.sessionStorage.setItem')) ||
      SESSION_STORAGE_WRITE_HELPERS.has(ref.calleeName)) &&
    ref.firstArgStringLiteral !== null &&
    !isValidStorageKey(ref.firstArgStringLiteral),
  message: (ref) =>
    `sessionStorage-skrivning med ikke-registreret literal key: ${ref.firstArgStringLiteral}`,
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem("ikke-en-key", v);' },
    { relativePath: 'src/x.ts', code: 'window.sessionStorage.setItem("random", v);' },
    // De slettede legacy-nøgler må ikke kunne skrives igen (greenfield trin 13): sagsinput ligger i
    // ÉN envelope, og per-sektion-persistering/`invalidDrafts` er ikke længere en skrivegrænse.
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem("mineo_stamdata", v);' },
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem("mineo_invalidDrafts", v);' },
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem("mineo_input", v);' },
    // Helper-vejen — den ENESTE vej produktionskoden faktisk må bruge, og derfor den, en genindført
    // legacy-nøgle ville komme ind ad.
    { relativePath: 'src/x.ts', code: 'writeSessionStorageValue("mineo_invalidDrafts", v);' },
    { relativePath: 'src/x.ts', code: 'writeOptionalSessionStorageValue("mineo_stamdata", v);' },
  ],
  cleanFixtures: [
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem("mineo_input_v2", v);' },
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem("mineo_sideMenuExpanded", v);' },
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem(dynamicKey, v);' },
    { relativePath: 'src/x.ts', code: 'writeSessionStorageValue("mineo_input_v2", v);' },
    { relativePath: 'src/x.ts', code: 'writeOptionalSessionStorageValue(UI_STORAGE_KEYS.pendingOverlay, v);' },
    { relativePath: 'src/x.ts', code: 'sessionStorage.getItem("hvad-som-helst");' },
    { relativePath: 'src/x.ts', code: 'other.setItem("ikke-en-key", v);' },
  ],
});

// --- Persistence-import-grænser ----------------------------------------------

/**
 * Modulstierne for den slettede legacy-inputarkitektur.
 *
 * Præcisionskrav: `Styled*Field` rammer den gamle feltvej, men IKKE de bevarede UI-primitiver
 * (`StyledTextFieldBase`/`StyledTextAreaBase`) eller de øvrige bevarede kontroller (dropdown/toggle/radio/
 * checkbox). `criticalActions/` rammer den gamle mappe, men ikke greenfields egen
 * `inputCore/runtime/criticalActionCoordinator`.
 */
const DELETED_LEGACY_INPUT_MODULES =
  /(?:stores\/(?:formPersistenceStore|formPersistenceReadModel|inputRuntimeStore|undoRedoStore)|contexts\/(?:FormPersistenceContext(?:\.shared|\.internal)?|useFormPersistence)|hooks\/(?:useFormPersistence|useFormPersistenceSelectors|useFormFieldErrors|usePersistedForm|useDraftField|useStyledFieldAdapter|useTwoStageInputActivation|useUndoRedo(?:Shortcuts)?)|hooks\/fieldState\/|hooks\/tableInput|input\/(?:inputTransactionRunner|legacyInputCompatibility|legacyGridTransactionBridge)|criticalActions\/|rowDrafts\/|types\/fieldErrors|utils\/(?:invalidDraftsStorage|saveBlockedFocus|historyTargetRestore)|components\/inputs\/table\/Table|components\/inputs\/Styled(?:Text|Amount|Date|Integer|Percent|Fraction|Week|Year)Field$)/;

/**
 * De konkrete modul-STIER regexen ovenfor forbyder — eksplicit opregnet, fordi et regex ikke kan
 * opremse sig selv.
 *
 * Fase 6: en fraværsregel kan ikke bevise sin egen liveness ved at ramme noget (nul hits ER målet).
 * I stedet beviser `deletedLegacyAbsence.test.ts`, at hver af disse stier faktisk ER fraværende i
 * kilde-grafen. Uden det kunne reglen stille skifte fra "forbyder noget, der findes" til "forbyder
 * en stavefejl" — og fremstå som dækning, mens den rigtige fil lever videre ved siden af.
 * `LEGACY_MODULE_PATH_SELFTEST` nedenfor pinner, at listen og regexen beskriver samme mængde.
 */
const DELETED_LEGACY_INPUT_MODULE_PATHS: readonly string[] = [
  'src/stores/formPersistenceStore',
  'src/stores/formPersistenceReadModel',
  'src/stores/inputRuntimeStore',
  'src/stores/undoRedoStore',
  'src/contexts/FormPersistenceContext',
  'src/contexts/useFormPersistence',
  'src/hooks/useFormPersistence',
  'src/hooks/useFormPersistenceSelectors',
  'src/hooks/useFormFieldErrors',
  'src/hooks/usePersistedForm',
  'src/hooks/useDraftField',
  'src/hooks/useStyledFieldAdapter',
  'src/hooks/useTwoStageInputActivation',
  'src/hooks/useUndoRedo',
  'src/hooks/useUndoRedoShortcuts',
  'src/hooks/fieldState/',
  'src/hooks/tableInput',
  'src/input/inputTransactionRunner',
  'src/input/legacyInputCompatibility',
  'src/input/legacyGridTransactionBridge',
  'src/criticalActions/',
  'src/rowDrafts/',
  'src/types/fieldErrors',
  'src/utils/invalidDraftsStorage',
  'src/utils/saveBlockedFocus',
  'src/utils/historyTargetRestore',
  'src/components/inputs/table/Table',
  'src/components/inputs/StyledTextField',
  'src/components/inputs/StyledAmountField',
  'src/components/inputs/StyledDateField',
  'src/components/inputs/StyledIntegerField',
  'src/components/inputs/StyledPercentField',
  'src/components/inputs/StyledFractionField',
  'src/components/inputs/StyledWeekField',
  'src/components/inputs/StyledYearField',
];

/**
 * Selvtest-data: hver sti ovenfor SKAL matche regexen. Fanger den ene måde listen og regexen kan
 * drifte fra hinanden på — at nogen tilføjer et forbud ét sted og glemmer det andet.
 */
export const LEGACY_MODULE_PATH_SELFTEST = {
  paths: DELETED_LEGACY_INPUT_MODULE_PATHS,
  pattern: DELETED_LEGACY_INPUT_MODULES,
} as const;

/**
 * Den slettede legacy-inputarkitektur må ikke genopstå.
 *
 * Efter greenfield-cutoveren findes der ÉN autoritativ inputtilstand (§3.1), ÉN editor (§3.5) og ÉN
 * write-grænse (§3.6). Den gamle store-/editor-/fejl-/command-klynge er slettet — ikke deaktiveret. Denne regel
 * forbyder ethvert import af dens moduler, så en ny feature ikke kan genindføre en parallel inputvej (heller
 * ikke ved at genskabe en fil med samme navn). Der er BEVIDST ingen allowlist: en undtagelse ville være en
 * anden samtidig sandhed.
 */
const deletedLegacyInputArchitectureImport = forbidImports({
  id: 'input/deleted-legacy-architecture-import',
  description:
    'Den slettede legacy-inputarkitektur (formPersistence*, inputRuntimeStore, FormPersistenceContext, '
    + 'inputTransactionRunner, criticalActions/, rowDrafts/, tableInput/, useDraftField, Styled*Field-vejen) '
    + 'må ikke importeres eller genindføres.',
  liveTarget: {
    kind: 'absence',
    forbids: DELETED_LEGACY_INPUT_MODULE_PATHS,
    rationale:
      'nul hits ER målet: modulerne er slettet. `deletedLegacyAbsence.test.ts` beviser omvendt, at '
      + 'hvert forbudt modulnavn faktisk er fraværende i grafen — reglen må ikke stille skifte til at '
      + 'forbyde noget, der aldrig fandtes, fordi mønsteret er stavet forkert.',
  },
  allow: [],
  forbidden: (ref) => DELETED_LEGACY_INPUT_MODULES.test(ref.moduleSpecifier),
  message: (ref) =>
    `Import af slettet legacy-inputarkitektur (${ref.moduleSpecifier}). Brug greenfield-inputCore: `
    + 'reader/projektion til læsning, `dispatch`/`useFieldEditor` til skrivning.',
  violatingFixtures: [
    { relativePath: 'src/foo.ts', code: "import { x } from '../stores/formPersistenceStore';" },
    { relativePath: 'src/foo.ts', code: "import type { T } from '../stores/inputRuntimeStore';" },
    { relativePath: 'src/foo.ts', code: "import { FormPersistenceContext } from '../contexts/FormPersistenceContext';" },
    { relativePath: 'src/foo.ts', code: "import { x } from '../input/inputTransactionRunner';" },
    { relativePath: 'src/foo.ts', code: "import { useDraftField } from '../hooks/useDraftField';" },
    { relativePath: 'src/foo.ts', code: "import { useRowDrafts } from '../rowDrafts/useRowDrafts';" },
    { relativePath: 'src/foo.ts', code: "import { useTableInputCore } from '../hooks/tableInput';" },
    { relativePath: 'src/foo.ts', code: "import { useCriticalActionParticipant } from '../criticalActions/CriticalActionContext';" },
    { relativePath: 'src/foo.ts', code: "import StyledAmountField from '../components/inputs/StyledAmountField';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/foo.ts', code: "import { slimInputStore } from '../inputCore/runtime/slimInputStore';" },
    { relativePath: 'src/foo.ts', code: "import { useFieldEditor } from '../inputCore/react/useFieldEditor';" },
    // De bevarede UI-primitiver (`*Base`) og de transiente felter er IKKE den gamle feltvej.
    { relativePath: 'src/foo.ts', code: "import StyledTextFieldBase from '../components/inputs/StyledTextFieldBase';" },
    { relativePath: 'src/foo.ts', code: "import TransientDateInput from '../components/inputs/transient/TransientDateInput';" },
    { relativePath: 'src/foo.ts', code: "import { CriticalActionCoordinator } from '../inputCore/runtime/criticalActionCoordinator';" },
  ],
});

// --- Fail-open display-opslag må ikke koble til beregning ---------------------

const failOpenDisplayLookupImport = forbidImports({
  id: 'satser/fail-open-display-lookup-import',
  description:
    'Det fail-open getSatserForYear (lovbestemteRates) må kun importeres af display-/dokument-lag — aldrig en beregningssti.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.text.includes('getSatserForYear'),
    rationale: 'det fail-open opslag findes stadig og importeres af mindst én fil',
  },
  allow: [
    // Den typed reader-projektion er display-/dokument-grænsen for Satser og kalder kun opslaget på ready-grenen.
    'src/domain/satser/satserProjection.ts',
    'src/document/generators/satser/satserDocument.ts',
  ],
  forbidden: (ref) =>
    ref.moduleSpecifier.includes('lovbestemteRates') && ref.namedBindings.includes('getSatserForYear'),
  message: (ref) => `Import af fail-open getSatserForYear (${ref.moduleSpecifier}) uden for display/dokument.`,
  violatingFixtures: [
    { relativePath: 'src/foo.ts', code: "import { getSatserForYear } from '../../data/lovbestemteRates';" },
    { relativePath: 'src/foo.ts', code: "import { getSatserForYear as x } from '../data/lovbestemteRates';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/foo.ts', code: "import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';" },
    { relativePath: 'src/foo.ts', code: "import { getSatserForYear } from './someOtherModule';" },
    { relativePath: 'src/foo.ts', code: "import { andetSymbol } from '../../data/lovbestemteRates';" },
  ],
});

// --- ASL-årslønsmaksimum: rå subscript-opslag skal gå gennem gateway'en ------

const aslAarsloensmaksimumRawSubscript = forbidElementAccess({
  id: 'satser/asl-aarsloensmaksimum-raw-subscript',
  description:
    'Rå aarsloenAslMax[år]-opslag skal gå gennem resolveAslAarsloensmaksimumForAar (gateway); kun datakilde + gateway må subscripte.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.text.includes('aarsloenAslMax'),
    rationale: 'datatabellen `aarsloenAslMax` findes stadig og kan subscriptes',
  },
  // Kun datakilden tilbage: gateway'en (`aslAarsloensmaksimum.ts`) subscripter ikke længere selv — den går
  // gennem `YearlyRate`-helperne — så dens allowlist-post var død konfiguration.
  allow: ['src/data/lovbestemteRates.ts'],
  forbidden: (ref) => ref.objectName === 'aarsloenAslMax',
  message: (ref) => `Rå ASL-maks-opslag (${ref.chainText}) — brug resolveAslAarsloensmaksimumForAar().`,
  violatingFixtures: [
    { relativePath: 'src/foo.ts', code: 'const v = aarsloenAslMax[year];' },
    { relativePath: 'src/foo.ts', code: 'const v = aarsloenAslMax[skadesaar];' },
  ],
  cleanFixtures: [
    { relativePath: 'src/foo.ts', code: 'const idx = aarsloenAslMax;' },
    { relativePath: 'src/foo.ts', code: 'getYearBoundsForYearlyRate(aarsloenAslMax);' },
    { relativePath: 'src/foo.ts', code: 'resolveAslAarsloensmaksimumForAar(year);' },
  ],
});

// --- Lag-grænse: domæne må ikke importere inspektions-/kontrollaget ----------

const INSPEKTION_LAYER = 'src/domain/eoInspektion';

const importPointsIntoInspektion = (moduleSpecifier: string, fromRelativePath: string): boolean => {
  if (moduleSpecifier.startsWith('.')) {
    const resolved = resolveRelativeImport(fromRelativePath, moduleSpecifier);
    return resolved !== null && (resolved === INSPEKTION_LAYER || resolved.startsWith(`${INSPEKTION_LAYER}/`));
  }
  // Ikke-relative (alias/absolut/bart modul): match på segmentet, så en fremtidig path-alias også fanges.
  return moduleSpecifier.includes('domain/eoInspektion');
};

const inspektionLayerImport = forbidImports({
  id: 'layer/inspektion-import-boundary',
  description:
    'Kun de to sanktionerede snapshot-bro-filer må importere src/domain/eoInspektion; den autoritative motor + kontrol-kerne skal være inspektionsfri (B9).',
  liveTarget: {
    kind: 'scoped',
    roots: [INSPEKTION_LAYER, 'src/domain'],
    rationale: 'både inspektionslaget (det beskyttede mål) og domænelaget (scopet) skal findes',
  },
  // Alle domæne-filer uden for selve inspektionslaget kontrolleres (dækker eoRowEvaluation, canonicalOutput, controlMismatch m.fl.).
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/domain/') && !relativePath.startsWith(`${INSPEKTION_LAYER}/`),
  allow: [
    'src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts',
    'src/domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView.ts',
  ],
  forbidden: (ref, fromRelativePath) => importPointsIntoInspektion(ref.moduleSpecifier, fromRelativePath),
  message: (ref) => `Import af inspektions-/kontrollaget (${ref.moduleSpecifier}) uden for de sanktionerede broer.`,
  violatingFixtures: [
    {
      relativePath: 'src/domain/erstatningsopgoerelse/engines/foo.ts',
      code: "import { buildEOInspektionSnapshot } from '../../eoInspektion/eoInspektionSnapshot';",
    },
    { relativePath: 'src/domain/x/y.ts', code: "import { x } from '@/domain/eoInspektion/eoInspektionSnapshot';" },
    { relativePath: 'src/domain/x/y.ts', code: "import { x } from 'src/domain/eoInspektion/eoInspektionSnapshot';" },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/domain/erstatningsopgoerelse/engines/foo.ts',
      code: "import { collectAllEoRows } from '../../eoRowEvaluation/eoRowAggregator';",
    },
    { relativePath: 'src/domain/x/y.ts', code: "import { z } from '@mui/material';" },
  ],
});

// --- EET-domæne: intet tværside-persisted-opslag ind i erhvervsevnetab -------

// `domain/eet-cross-domain-persisted-lookup` er SLETTET i Fase 6.
//
// Reglen forbød `getPersistedData`/`usePersistedSection`/`commitSection` med `'erhvervsevnetab'` som
// literal-argument. Dødt-værn-detektoren afslørede, at ingen af de tre callees findes i grafen længere:
// `usePersistedSection` og `commitSection` har nul forekomster overhovedet, og `getPersistedData` lever
// kun som devtools-monitoreringens callback (`useDevtoolsMonitoring.ts`), som ikke er en sektionsadgang.
// Reglen var altså grøn af tomhed.
//
// Intentionen — EET må ikke kobles til af et fremmed domæne — er IKKE opgivet: den håndhæves nu af
// `domain/page-section-access-boundary`, som efter Fase 6 måler den kobling, greenfield faktisk har
// (hvilket descriptor-katalog en side importerer), mod den samme autorisationstabel. Det er en STÆRKERE
// kontrol end den slettede, fordi den dækker alle sektioner og ikke kun literal-argumenter.

// --- Pengeenhed: kun den kanoniske konstruktor må skabe MoneyOre -------------

const moneyOreTypeAssertion = forbidTypeAssertions({
  id: 'money/money-ore-type-assertion',
  description:
    'MoneyOre må ikke konstrueres med type-assertion; brug den validerede pengealgebra.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.text.includes('MoneyOre'),
    rationale: 'MoneyOre-typen findes stadig og kan asserteres til',
  },
  forbidden: (ref) => /(?:^|\.)MoneyOre$/.test(ref.typeText),
  message: (ref) =>
    `Type-assertion til ${ref.typeText} omgår MoneyOre-valideringen — brug domain/money.`,
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'const x = 100 as MoneyOre;' },
    { relativePath: 'src/x.ts', code: 'const x = <MoneyOre>100;' },
    { relativePath: 'src/x.ts', code: 'const x = value as unknown as MoneyOre;' },
  ],
  cleanFixtures: [
    { relativePath: 'src/x.ts', code: 'const x = moneyOre(100);' },
    { relativePath: 'src/x.ts', code: 'const x = value as number;' },
  ],
});

// --- Page-lag: persisteret sektionsadgang må kun ramme autoriserede domæner ---

/**
 * Hvilket persisteret domæne hvert descriptor-katalog giver adgang til.
 *
 * **Fase 6 omskrev denne regel fra kald til imports.** Første udgave målte string-literal-argumenter
 * til sektions-hooks (`usePersistedForm('aarsloen')` …). Dødt-værn-detektoren afslørede, at ALLE de
 * hooks er væk efter greenfield-cutoveren: `usePersistedSection`/`commitSection` har nul forekomster,
 * og de øvrige lever kun som historik-kommentarer i page-filerne. Reglen kontrollerede altså en
 * adgangsform, produktionen ikke længere har — grøn af tomhed, mens den fremstod som §9/§10-dækning.
 *
 * Greenfield kobler en side til et domæne ét sted: ved at importere domænets FELTDESCRIPTORER fra
 * `src/inputCore/catalog/`. Descriptoren bærer selv sin `section`, og uden en descriptor kan siden
 * hverken læse eller skrive sektionen. Import af kataloget ER derfor koblingen — og i modsætning til
 * literal-argumenter kan den ikke omgås ved at føre sektionsnavnet gennem en variabel.
 *
 * Autorisationstabellen (`PAGE_BOUNDARY_RULES`) er UÆNDRET: det er domain-boundary-contract §9/§10's
 * beslutning om hvem der må røre hvad, og den er stadig gyldig. Kun målemetoden er skiftet til den,
 * arkitekturen faktisk bruger.
 */
const DESCRIPTOR_CATALOG_SECTIONS: ReadonlyMap<string, PersistedSectionKey> = new Map([
  ['aarsloenDescriptors', 'aarsloen'],
  ['erhvervsevnetabDescriptors', 'erhvervsevnetab'],
  ['erstatningsopgoerelseDescriptors', 'erstatningsopgoerelse'],
  ['erstatningsopgoerelseLoenDescriptors', 'erstatningsopgoerelse'],
  ['faellesAarsloenDescriptors', 'faellesAarsloen'],
  ['forsoergertabDescriptors', 'forsoergertab'],
  ['renteberegningDescriptors', 'renteberegning'],
  ['satserDescriptors', 'satser'],
  ['stamdataDescriptors', 'stamdata'],
  ['varigeMenDescriptors', 'varigemen'],
]);

/**
 * Descriptor-katalogets mappe. Eksporteret, så `deletedLegacyAbsence.test.ts` kan bevise, at
 * `DESCRIPTOR_CATALOG_SECTIONS` dækker HVERT katalogmodul: et nyt domænekatalog, der ikke står i
 * kortet, ville ellers være usynligt for page-grænsen — reglen ville se en uovervåget kobling som
 * "ingen kobling" og være tavs, præcis den slags tomhed Fase 6 lukker.
 */
export const CATALOG_DIR = 'src/inputCore/catalog';

/** De katalogmoduler der IKKE er et domæne (fælles infrastruktur) og derfor ingen sektion har. */
export const NON_DOMAIN_CATALOG_MODULES: readonly string[] = ['boundsValidators', 'productionCatalog'];

/** Til completeness-testen: hvilke katalogmoduler kortet kender. */
export const DESCRIPTOR_CATALOG_MODULE_NAMES: readonly string[] = [...DESCRIPTOR_CATALOG_SECTIONS.keys()];

/** Descriptor-katalogets sektion, hvis importen peger på ét — ellers null. */
const catalogSectionForImport = (moduleSpecifier: string): PersistedSectionKey | null => {
  const normalized = moduleSpecifier.replaceAll('\\', '/');
  const match = /(?:^|\/)inputCore\/catalog\/([A-Za-z]+)$/.exec(normalized);
  if (match === null) return null;
  return DESCRIPTOR_CATALOG_SECTIONS.get(match[1]) ?? null;
};

const PAGES_ROOT = 'src/components/pages';

export type PageBoundaryRule = Readonly<{
  label: string;
  /** Repo-relativ rod (fil eller mappe) med `src/`-præfiks, matcher `SourceEntry.relativePath`. */
  root: string;
  allowedSections: readonly PersistedSectionKey[];
}>;

/**
 * Domain-boundary-contract §9/§10: hvilke persisterede sektioner hver page-rod må
 * tilgå. Erstatningsopgørelse/Erhvervsevnetab har autoriserede cross-domain-læsninger
 * (delt forligsgrad + midlertidigt EET) — resten er strengt eget domæne + stamdata.
 */
export const PAGE_BOUNDARY_RULES: readonly PageBoundaryRule[] = [
  { label: 'Årslønsberegning', root: 'src/components/pages/Aarsloen.tsx', allowedSections: ['aarsloen', 'stamdata'] },
  {
    label: 'Erhvervsevnetab',
    root: 'src/components/pages/Erhvervsevnetab.tsx',
    allowedSections: ['erhvervsevnetab', 'faellesAarsloen', 'stamdata', 'erstatningsopgoerelse'],
  },
  {
    label: 'Erhvervsevnetab tabs',
    root: 'src/components/pages/erhvervsevnetab',
    allowedSections: ['erhvervsevnetab', 'faellesAarsloen', 'stamdata', 'erstatningsopgoerelse'],
  },
  {
    label: 'Erstatningsopgørelse',
    root: 'src/components/pages/Erstatningsopgoerelse.tsx',
    allowedSections: ['erstatningsopgoerelse', 'stamdata', 'erhvervsevnetab', 'faellesAarsloen'],
  },
  {
    label: 'Erstatningsopgørelse tabs',
    root: 'src/components/pages/erstatningsopgoerelse',
    allowedSections: ['erstatningsopgoerelse', 'stamdata'],
  },
  { label: 'Forsørgertab', root: 'src/components/pages/Forsoergertab.tsx', allowedSections: ['forsoergertab', 'faellesAarsloen', 'stamdata'] },
  { label: 'Renteberegning', root: 'src/components/pages/Renteberegning.tsx', allowedSections: ['renteberegning', 'stamdata'] },
  {
    // Delte renteberegning-faner (bruges af både hovedapp og standalone minProcesrente). RenteberegningTab
    // binder beregningsdato til invalidDrafts og læser sektionens afsluttede ugyldige inputs (greenfield
    // draft/commit-design, Fase 7), så filen tilgår `renteberegning`-sektionen.
    label: 'Renteberegning-faner',
    root: 'src/components/pages/renteberegning',
    allowedSections: ['renteberegning'],
  },
  { label: 'Satser', root: 'src/components/pages/Satser.tsx', allowedSections: ['satser', 'stamdata'] },
  { label: 'Stamdata', root: 'src/components/pages/Stamdata.tsx', allowedSections: ['stamdata'] },
  { label: 'Varige mén', root: 'src/components/pages/VarigeMen.tsx', allowedSections: ['stamdata', 'varigemen'] },
  { label: 'Varige mén tabs', root: 'src/components/pages/varigemen', allowedSections: ['stamdata', 'varigemen'] },
  {
    label: 'MinProcesrente (standalone)',
    root: 'src/components/pages/minprocesrente',
    allowedSections: ['renteberegning'],
  },
];

const boundaryRuleForPath = (relativePath: string): PageBoundaryRule | undefined =>
  PAGE_BOUNDARY_RULES.find(
    (rule) => relativePath === rule.root || relativePath.startsWith(`${rule.root}/`)
  );

type SectionAccess = Readonly<{ section: PersistedSectionKey; position: Finding['position'] }>;

/** En page-fils koblinger til persisterede domæner: hvilke descriptor-kataloger importerer den? */
const collectSectionAccesses = (entry: SourceEntry): SectionAccess[] =>
  collectImports(entry).flatMap((ref) => {
    const section = catalogSectionForImport(ref.moduleSpecifier);
    // Også type-only imports tæller: en side, der kender domænets felttyper, er koblet til domænet,
    // og en type-import er desuden ét tegn fra at blive en værdi-import.
    return section === null ? [] : [{ section, position: ref.position }];
  });

const pageSectionAccessBoundary = defineRule({
  id: 'domain/page-section-access-boundary',
  description:
    'Enhver page-fil der importerer et domænes feltdescriptorer skal ligge under en PAGE_BOUNDARY_RULE-rod (coverage) og må kun koble til rodens autoriserede sektioner (domain-boundary-contract §9/§10).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      entry.relativePath.startsWith(`${PAGES_ROOT}/`) && collectSectionAccesses(entry).length > 0,
    rationale:
      'mindst én page-fil importerer et descriptor-katalog — dvs. koblingen, reglen regulerer, findes '
      + 'stadig i den form, greenfield bruger',
  },
  appliesTo: (relativePath) => relativePath.startsWith(`${PAGES_ROOT}/`),
  find: (entry) => {
    const accesses = collectSectionAccesses(entry);
    if (accesses.length === 0) return [];

    const boundary = boundaryRuleForPath(entry.relativePath);
    if (!boundary) {
      // Coverage-completeness: en page-fil med domænekobling uden en regel-rod er uovervåget.
      return accesses.map((access) => ({
        position: access.position,
        message: `Uovervåget page-fil med domænekobling (${access.section}) — tilføj en PAGE_BOUNDARY_RULE-rod.`,
      }));
    }

    return accesses
      .filter((access) => !boundary.allowedSections.includes(access.section))
      .map((access) => ({
        position: access.position,
        message: `${boundary.label}: kobling til ikke-autoriseret sektion '${access.section}' via descriptor-katalog.`,
      }));
  },
  violatingFixtures: [
    // Under en rod, men uautoriseret sektion.
    {
      relativePath: 'src/components/pages/Aarsloen.tsx',
      code: "import { x } from '../../inputCore/catalog/erhvervsevnetabDescriptors';",
    },
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx',
      code: "import { x } from '../../../inputCore/catalog/renteberegningDescriptors';",
    },
    // Ingen rod (uovervåget) med domænekobling.
    {
      relativePath: 'src/components/pages/NyUovervaagetSide.tsx',
      code: "import { x } from '../../inputCore/catalog/stamdataDescriptors';",
    },
    // Type-only kobling til et uautoriseret domæne tæller også.
    {
      relativePath: 'src/components/pages/Satser.tsx',
      code: "import type { X } from '../../inputCore/catalog/varigeMenDescriptors';",
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/pages/Aarsloen.tsx',
      code: "import { aarsloenFeriePctField } from '../../inputCore/catalog/aarsloenDescriptors';",
    },
    // Autoriseret cross-domain-læsning (EO ↔ EET, delt forligsgrad).
    {
      relativePath: 'src/components/pages/Erhvervsevnetab.tsx',
      code: "import { x } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';",
    },
    // Descriptorfri page-fil er uinteressant, selv uden rod.
    { relativePath: 'src/components/pages/NyUovervaagetSide.tsx', code: 'const x = useMemo(() => 1, []);' },
    // Ikke-katalog-import fra inputCore er ikke en domænekobling.
    {
      relativePath: 'src/components/pages/NyUovervaagetSide.tsx',
      code: "import { useFieldEditor } from '../../inputCore/react/useFieldEditor';",
    },
    // Fælles infrastruktur i kataloget (bounds-validatorer) er ikke et domæne.
    {
      relativePath: 'src/components/pages/NyUovervaagetSide.tsx',
      code: "import { dateBounds } from '../../inputCore/catalog/boundsValidators';",
    },
  ],
});

// `form/persisted-styled-field-error-reporter` er SLETTET i Fase 6.
//
// Reglen krævede en `onFieldError`-prop på parse-kompetente `Styled*Field`-komponenter på
// produktionssider. Trin 13 slettede hele den feltvej, og dødt-værn-detektoren afslørede, at reglen
// derfor ikke havde ét eneste mål tilbage: `grep '<Styled[A-Za-z]*Field'` under `src/components/pages/`
// giver nul træffere.
//
// Invarianten — "et persisteret parse-felt må ikke fejle åbent" — er ikke opgivet; den er blevet
// STRUKTUREL og kan derfor ikke længere brydes af en udeladt prop:
//
//   - Greenfield-feltvejen (`src/inputCore/react/fields/`) tager `field: FieldRef<T>` og
//     `location: EditorLocation` som PÅKRÆVEDE props. Uden dem kompilerer feltet ikke.
//   - Fejlvisningen afledes af `useFormFieldSurface`/`useGridCellSurface` fra det tokenbundne
//     issue-snapshot (§1.8) — ikke af en valgfri callback. Der er intet `onFieldError` at udelade;
//     et felt kan ikke opt-out af sin egen fejltilstand.
//
// Fase 6's krav "persisted controls kræver konkrete refs" er dermed opfyldt af TYPEN frem for af en
// regel — samme rangorden som `ManifestStorageKey` etablerede
// ([[project_typed_write_boundary_over_ast_guard]]). En pro forma-regel oven på en compiler-håndhævet
// invariant ville være regel-antal uden dækning, og ville selv være det næste døde værn.

// --- Dokument-downloads må ikke læse committed state undervejs -----------------

/**
 * Fase 6 omskrev denne regel fra `download*Dokument` til livscyklussens faktiske entrypoints.
 *
 * Reglens INTENTION — "render-from-argument": en fil, der udløser en dokument-download, må ikke læse
 * autoritativ tilstand undervejs, men skal danne dokumentet ud fra det ÉNE snapshot, gaten godkendte
 * — er uændret gyldig. Målet skiftede blot navn: Fase 5 slettede alle 18 `download*Dokument`, så
 * reglens forudsætning kunne ikke længere opfyldes af nogen fil, og dødt-værn-detektoren rapporterede
 * den som inert. Første version af denne kommentar er dermed også dokumentationen for, hvorfor
 * reglen ikke bare blev slettet: den havde et levende mål, den bare ikke pegede på længere.
 *
 * De nuværende trigger-punkter er katalogets React-flade (`useMineoDocument*`) og handlings-hooket
 * `useReguleringDocumentAction`. Den forbudte læsning er tilsvarende skiftet fra de afskaffede
 * `usePersistedSection`/`getPersistedData` til den ene escape hatch, der faktisk findes i greenfield:
 * `slimInputStore.getState()` — en ugated, ikke-tokenbundet læsning af den autoritative store.
 */
const DOCUMENT_TRIGGER_CALLEES = new Set<string>([
  'useMineoDocumentOutput',
  'useMineoDocumentActionOutput',
  'useMineoDocumentOutputWithContext',
  'useMineoDocumentCatalogEntry',
  'useReguleringDocumentAction',
  'executeDocumentDownload',
  'triggerDocumentDownload',
]);

/**
 * De afskaffede persisterede sektionsopslag. Beholdt i forbuddet, selv om de ikke findes i grafen
 * længere: skulle nogen genindføre et af dem, ville en download-triggende fil være det værste sted at
 * gøre det. Reglens LIVENESS hviler ikke på dem — den hviler på trigger-siden (`liveTarget` nedenfor).
 */
const PERSISTED_READ_CALLEES = new Set<string>(['usePersistedSection', 'getPersistedData']);

/** Ugated læsning af autoritativ tilstand uden om det tokenbundne snapshot. */
const isRawAuthoritativeRead = (calleeText: string): boolean =>
  /(?:^|\.)slimInputStore\.getState$/.test(calleeText)
  || PERSISTED_READ_CALLEES.has(calleeText);

const pdfDownloadCommittedState = defineRule({
  id: 'document/download-committed-state',
  description:
    'En fil, der udløser en dokument-download, må ikke samtidig læse autoritativ inputtilstand ugated '
    + '(slimInputStore.getState()) — dokumentet skal dannes fra det snapshot, gaten godkendte '
    + '(build-once/render-from-argument-invarianten).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      collectCalls(entry).some((ref) => DOCUMENT_TRIGGER_CALLEES.has(ref.calleeName)),
    rationale:
      'mindst én fil udløser en dokument-download gennem livscyklussens entrypoints — reglens '
      + 'forudsætning findes altså stadig',
  },
  find: (entry) => {
    const calls = collectCalls(entry);
    const hasDownloadTrigger = calls.some((ref) => DOCUMENT_TRIGGER_CALLEES.has(ref.calleeName));
    if (!hasDownloadTrigger) return [];

    return calls
      .filter((ref) => isRawAuthoritativeRead(ref.calleeText))
      .map((ref) => ({
        position: ref.position,
        message:
          `Ugated læsning af autoritativ tilstand (${ref.calleeText}) i en fil, der udløser en `
          + 'dokument-download — dokumentet skal dannes fra det gatede snapshot, ikke fra live state.',
      }));
  },
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'useMineoDocumentOutput(entry); slimInputStore.getState();' },
    {
      relativePath: 'src/x.ts',
      code: 'const a = useReguleringDocumentAction(r); const s = slimInputStore.getState().input;',
    },
    { relativePath: 'src/x.ts', code: "useMineoDocumentActionOutput(e); getPersistedData('stamdata');" },
  ],
  cleanFixtures: [
    // Download uden ugated læsning — den normale, korrekte form.
    { relativePath: 'src/x.ts', code: 'const out = useMineoDocumentOutput(entry); const v = out.snapshot;' },
    // Ugated læsning uden nogen download-trigger er en anden regels ansvar.
    { relativePath: 'src/x.ts', code: 'const s = slimInputStore.getState();' },
    // Et andet stores getState er ikke den autoritative inputtilstand.
    { relativePath: 'src/x.ts', code: 'useMineoDocumentOutput(entry); uiStore.getState();' },
  ],
});

// --- MinProcesrente-standalone: ingen import af Mineos tværgående flows --------

const STANDALONE_SCOPE_PREFIXES = ['src/apps/minprocesrente/', 'src/components/pages/minprocesrente/'];
const STANDALONE_SCOPE_FILES = new Set<string>();

const isStandaloneScope = (relativePath: string): boolean =>
  STANDALONE_SCOPE_FILES.has(relativePath) ||
  STANDALONE_SCOPE_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const FORBIDDEN_STANDALONE_MODULE_SUBSTRINGS = [
  'AuthGate',
  'BrowserRouter',
  'pwaLaunchQueue',
  'usePwaLaunchQueue',
  'serviceWorker',
  'systemIssueReporter',
  'AppSettings',
  'useAppSettings',
  'BugReport',
];
const FORBIDDEN_STANDALONE_BINDINGS = new Set<string>([
  'AuthGate',
  'BrowserRouter',
  'useAppSettings',
  'AppSettingsProvider',
  'systemIssueReporter',
  'reportSystemIssue',
  'BugReportButton',
  'logStorage',
]);

const isMineoAppRootImport = (moduleSpecifier: string): boolean =>
  /(?:^|\/)App$/.test(moduleSpecifier) && !moduleSpecifier.includes('minprocesrente');

const minprocesrenteStandaloneImport = forbidImports({
  id: 'layer/minprocesrente-standalone-import-boundary',
  description:
    'Den isolerede MinProcesrente-standalone må ikke importere Mineos auth-/route-/PWA-/settings-/diagnose-flows (den deler kun renteberegning-sektionen).',
  liveTarget: {
    kind: 'scoped',
    roots: STANDALONE_SCOPE_PREFIXES,
    rationale: 'standalone-appen findes stadig som et selvstændigt scope, der skal holdes isoleret',
  },
  appliesTo: isStandaloneScope,
  forbidden: (ref) =>
    isMineoAppRootImport(ref.moduleSpecifier) ||
    FORBIDDEN_STANDALONE_MODULE_SUBSTRINGS.some((needle) => ref.moduleSpecifier.includes(needle)) ||
    ref.namedBindings.some((binding) => FORBIDDEN_STANDALONE_BINDINGS.has(binding)),
  message: (ref) => `MinProcesrente-standalone importerer forbudt Mineo-flow (${ref.moduleSpecifier}).`,
  violatingFixtures: [
    { relativePath: 'src/apps/minprocesrente/x.ts', code: "import { AuthGate } from '../../components/AuthGate';" },
    { relativePath: 'src/apps/minprocesrente/x.ts', code: "import App from '../../App';" },
    { relativePath: 'src/apps/minprocesrente/x.ts', code: "import { useAppSettings } from '../../contexts/AppSettingsContext';" },
    { relativePath: 'src/apps/minprocesrente/document/x.ts', code: "import { reportSystemIssue } from '../../../utils/systemIssueReporter';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/apps/minprocesrente/x.ts', code: "import { computeRente } from '../../domain/renteberegning/renteEngine';" },
    // Standalone-appens eget App-modul (indeholder ikke det bare `App`-segment) er tilladt.
    { relativePath: 'src/apps/minprocesrente/minprocesrenteMain.tsx', code: "import MinProcesrenteApp from './MinProcesrenteApp';" },
  ],
});

// --- Ingen lokal React-state-spejling af committed persisterede sektioner ------

const isNamedCall = (node: ts.CallExpression, identifier: string): boolean => {
  const { expression } = node;
  return (
    (ts.isIdentifier(expression) && expression.text === identifier) ||
    (ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === 'React' &&
      expression.name.text === identifier)
  );
};

const collectBindingIdentifiers = (name: ts.BindingName): string[] => {
  if (ts.isIdentifier(name)) return [name.text];
  const result: string[] = [];
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    if (element.dotDotDotToken) continue;
    result.push(...collectBindingIdentifiers(element.name));
  }
  return result;
};

const referencesTrackedCommittedSource = (
  node: ts.Node,
  trackedSectionVars: ReadonlySet<string>,
  trackedValuesVars: ReadonlySet<string>,
  trackedFormVars: ReadonlySet<string>
): boolean => {
  let found = false;
  const visit = (current: ts.Node): void => {
    if (found) return;
    if (
      ts.isIdentifier(current) &&
      (trackedSectionVars.has(current.text) || trackedValuesVars.has(current.text))
    ) {
      found = true;
      return;
    }
    if (
      ts.isPropertyAccessExpression(current) &&
      ts.isIdentifier(current.expression) &&
      trackedFormVars.has(current.expression.text) &&
      current.name.text === COMMITTED_MEMBER
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

/**
 * Fase 6 retargetede denne regel til greenfields faktiske læse-grænse.
 *
 * Mekanikken — spor en variabel fra den committede kilde, og flag den, hvis den flyder ind i en
 * `useState`-initializer eller en setter i en `useEffect` — er uændret og fanger stadig præcis det,
 * den skal. Men KILDERNE var `usePersistedSectionSelector`/`getPersistedSectionSnapshot`/
 * `usePersistedForm`, som alle tre er afskaffet: dødt-værn-detektoren viste nul kald i grafen, så
 * reglen returnerede tomt på første linje for hver eneste fil.
 *
 * Greenfields ene læse-grænse er `useInputEvaluation()` (§3.4), hvis `reader` fodrer de rene
 * reader-projektioner. Spejles dét i lokal React-state, genopstår præcis den divergens mellem
 * committed sandhed og lokal kopi, reglen blev skrevet for at forhindre.
 */
const COMMITTED_MIRROR_MARKERS = ['useInputEvaluation'];
/** Evalueringens committede medlem: `const { reader } = useInputEvaluation()`. */
const COMMITTED_MEMBER = 'reader';
/** Projektions-byggere: `buildXReaderProjection(evaluation.reader)` er også en committed kilde. */
const READER_PROJECTION_BUILDER = /^build[A-Za-z]*(?:Reader)?Projection$/;

/** Nævner filen overhovedet en committed kilde — evalueringen eller en reader-projektion? */
const mentionsCommittedSource = (text: string): boolean =>
  COMMITTED_MIRROR_MARKERS.some((marker) => text.includes(marker))
  || /\bbuild[A-Za-z]*(?:Reader)?Projection\s*\(/.test(text);

const findCommittedMirrorViolations = (entry: SourceEntry): Finding[] => {
  if (!entry.text.includes('useState')) return [];
  if (!mentionsCommittedSource(entry.text)) return [];

  const sourceFile = entry.ast;
  const trackedSectionVars = new Set<string>();
  const trackedValuesVars = new Set<string>();
  const trackedFormVars = new Set<string>();
  const localStateSetters = new Set<string>();

  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      // `const p = buildXReaderProjection(reader)` — projektionen ER den committede afledning.
      if (
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        READER_PROJECTION_BUILDER.test(node.initializer.expression.text)
      ) {
        for (const identifier of collectBindingIdentifiers(node.name)) {
          trackedSectionVars.add(identifier);
        }
      }

      if (ts.isCallExpression(node.initializer) && isNamedCall(node.initializer, 'useInputEvaluation')) {
        if (ts.isIdentifier(node.name)) trackedFormVars.add(node.name.text);
        if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            if (element.dotDotDotToken) continue;
            const propertyName = element.propertyName ?? element.name;
            if (ts.isIdentifier(propertyName) && propertyName.text === COMMITTED_MEMBER) {
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
          if (ts.isIdentifier(propertyName) && propertyName.text === COMMITTED_MEMBER) {
            trackedValuesVars.add(element.name.getText(sourceFile));
          }
        }
      }

      if (
        ts.isIdentifier(node.name) &&
        ts.isPropertyAccessExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        trackedFormVars.has(node.initializer.expression.text) &&
        node.initializer.name.text === COMMITTED_MEMBER
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

  const findings: Finding[] = [];
  const positionOf = (node: ts.Node): Finding['position'] => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return { line: line + 1, column: character + 1 };
  };

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
        referencesTrackedCommittedSource(firstArgument, trackedSectionVars, trackedValuesVars, trackedFormVars)
      ) {
        findings.push({ position: positionOf(node), message: 'useState-initializer spejler en committed persisteret sektion.' });
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
              referencesTrackedCommittedSource(arg, trackedSectionVars, trackedValuesVars, trackedFormVars)
            )
          ) {
            findings.push({
              position: positionOf(effectNode),
              message: `useEffect spejler en committed persisteret sektion via ${effectNode.expression.text}(...).`,
            });
          }
          ts.forEachChild(effectNode, visitEffect);
        };
        visitEffect(effectCallback.body);
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(sourceFile);

  return findings;
};

const persistenceCommittedMirror = defineRule({
  id: 'persistence/committed-section-mirror',
  description:
    'Ingen lokal React-state (useState-initializer eller useEffect-setter) må spejle en committed persisteret sektion i pages/hooks — committed state er den ene kilde.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      (entry.relativePath.startsWith('src/components/pages/') || entry.relativePath.startsWith('src/hooks/'))
      && mentionsCommittedSource(entry.text),
    rationale:
      'mindst én page/hook læser committed state gennem greenfields læse-grænse — kilden, der kan '
      + 'spejles, findes altså stadig',
  },
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/components/pages/') || relativePath.startsWith('src/hooks/'),
  find: findCommittedMirrorViolations,
  violatingFixtures: [
    {
      relativePath: 'src/hooks/useX.ts',
      code: 'const p = buildStamdataReaderProjection(r); const [local, setLocal] = useState(p);',
    },
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const { reader } = useInputEvaluation(); const [l, setL] = useState(0); useEffect(() => { setL(reader); }, [reader]);',
    },
    {
      relativePath: 'src/components/pages/Y.tsx',
      code: 'const e = useInputEvaluation(); const [l, setL] = useState(e.reader);',
    },
  ],
  cleanFixtures: [
    // Afledning via useMemo er den ØNSKEDE form — ingen spejling.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const p = buildStamdataReaderProjection(r); const derived = useMemo(() => p.x, [p]);',
    },
    { relativePath: 'src/hooks/useX.ts', code: 'const [l, setL] = useState(0); useEffect(() => { setL(1); }, []);' },
    // Lokal UI-state, der ikke rører den committede kilde.
    {
      relativePath: 'src/components/pages/X.tsx',
      code: 'const e = useInputEvaluation(); const [open, setOpen] = useState(false);',
    },
  ],
});

// --- Form-kontrakt: ingen microtask-/Promise-tick i commit-sensitiv kode -------

// `src/rowDrafts/` og `src/criticalActions/` er FJERNET fra listen i Fase 6: begge mapper blev slettet
// i greenfield-cutoveren, så de var død konfiguration, der stille ville udvide grænsen igen, hvis en fil
// med samme sti nogensinde opstod. Greenfields egen barriere ligger i `src/inputCore/runtime/`, som er
// tilføjet i stedet — den er commit-sensitiv i præcis den forstand, reglen handler om.
const COMMIT_SENSITIVE_PREFIXES = [
  'src/components/',
  'src/hooks/',
  'src/utils/',
  'src/inputCore/',
];
const isCommitSensitive = (relativePath: string): boolean =>
  COMMIT_SENSITIVE_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const queueMicrotaskBoundary = forbidCalls({
  id: 'form/no-queue-microtask-in-commit-sensitive',
  description:
    'queueMicrotask er forbudt i commit-sensitiv kode (kan splitte en atomisk commit over to microtasks); kun auditerede infrastruktur-undtagelser.',
  liveTarget: {
    kind: 'scoped',
    roots: COMMIT_SENSITIVE_PREFIXES,
    rationale: 'de commit-sensitive lag findes stadig og kan indføre en microtask-split',
  },
  appliesTo: isCommitSensitive,
  allow: ['src/components/tables/gridCore/tableKeyboardNavigation.ts'],
  forbidden: (ref) => ref.calleeName === 'queueMicrotask' && ref.calleeText === 'queueMicrotask',
  message: () => 'queueMicrotask i commit-sensitiv kode uden auditeret undtagelse.',
  violatingFixtures: [
    { relativePath: 'src/components/x.tsx', code: 'queueMicrotask(() => commit());' },
    { relativePath: 'src/hooks/x.ts', code: 'queueMicrotask(flush);' },
  ],
  cleanFixtures: [
    { relativePath: 'src/components/x.tsx', code: 'obj.queueMicrotask(fn);' },
    { relativePath: 'src/components/x.tsx', code: 'requestAnimationFrame(fn);' },
  ],
});

const isMicrotaskTick = (node: ts.CallExpression): boolean => {
  if (node.arguments.length !== 0) return false;
  const parent = node.parent;
  if (ts.isAwaitExpression(parent)) return true;
  // Promise.resolve().then(...) — resolve()'s parent er property-access `.then`.
  return ts.isPropertyAccessExpression(parent) && parent.name.text === 'then';
};

const promiseTickBoundary = forbidCalls({
  id: 'form/no-promise-tick-in-commit-sensitive',
  description:
    'Promise-tick (await Promise.resolve() / Promise.resolve().then()) er forbudt i commit-sensitiv kode.',
  liveTarget: {
    kind: 'scoped',
    roots: COMMIT_SENSITIVE_PREFIXES,
    rationale: 'de commit-sensitive lag findes stadig og kan indføre en Promise-tick',
  },
  appliesTo: isCommitSensitive,
  allow: [],
  forbidden: (ref) => ref.calleeText === 'Promise.resolve' && isMicrotaskTick(ref.node),
  message: () => 'Promise-tick i commit-sensitiv kode.',
  violatingFixtures: [
    { relativePath: 'src/hooks/x.ts', code: 'async function f() { await Promise.resolve(); }' },
    { relativePath: 'src/components/x.tsx', code: 'Promise.resolve().then(() => commit());' },
  ],
  cleanFixtures: [
    // Promise.resolve med argument (ikke en tick) er tilladt.
    { relativePath: 'src/utils/x.ts', code: 'const p = Promise.resolve(value);' },
    // Zero-arg uden await/then (fx som initial-værdi) er ikke en tick.
    { relativePath: 'src/utils/x.ts', code: 'let queue = Promise.resolve();' },
  ],
});

// --- Critical-action-barriere: ingen DOM-scanning eller frame-/timeout-venten -----

/**
 * critical-action-contract.md §2 lover normativt, at deltagere ALDRIG opdages via DOM-scanning, og
 * at klargøring aldrig venter Promise-ticks, animation frames eller timeouts — barrieren afventer kun
 * deltagernes eksplicitte commit-/persistence-promises. Promise-tick + queueMicrotask er allerede
 * dækket af de commit-sensitive regler (nu inkl. `src/criticalActions/`); denne regel lukker
 * resten af §2's løfte, så en fremtidig regression ikke kan genindføre det gamle timing-baserede
 * mønster inde i selve barrieren. `document.activeElement` (fokus-mål-capture, ikke deltager-
 * opdagelse) er en property-access og rammes derfor ikke.
 */
// Fase 6: scopet var `src/criticalActions/` — en mappe, greenfield-cutoveren slettede. Dødt-værn-
// detektorens scan-rod-kontrol fangede det: reglen scannede en tom rod og var inert, selv om dens
// fixtures (som lå på syntetiske `src/criticalActions/`-stier) blev ved med at bestå. Barrieren bor nu
// i `criticalActionCoordinator.ts` under greenfield-runtimen, og kontrakt §2's løfte gælder den.
const CRITICAL_ACTION_MODULE = 'src/inputCore/runtime/criticalActionCoordinator.ts';

const isCriticalActionModule = (relativePath: string): boolean =>
  relativePath === CRITICAL_ACTION_MODULE;

const criticalActionNoDomScanOrFrameWait = forbidCalls({
  id: 'criticalAction/no-dom-scan-or-frame-wait',
  description:
    'critical-action-barrieren må ikke DOM-scanne (querySelector*/getElementsBy*) eller vente på frames/timeouts (requestAnimationFrame/setTimeout/setInterval) — den afventer kun eksplicitte deltager-promises (kontrakt §2).',
  liveTarget: {
    kind: 'scoped',
    roots: [CRITICAL_ACTION_MODULE],
    rationale: 'critical-action-barrieren findes stadig som modul og kan regressere til timing-venten',
  },
  appliesTo: isCriticalActionModule,
  forbidden: (ref) =>
    ref.calleeName === 'requestAnimationFrame' ||
    ref.calleeName === 'setTimeout' ||
    ref.calleeName === 'setInterval' ||
    ref.calleeName === 'querySelector' ||
    ref.calleeName === 'querySelectorAll' ||
    ref.calleeName === 'getElementById' ||
    ref.calleeName === 'getElementsByClassName' ||
    ref.calleeName === 'getElementsByTagName',
  message: (ref) =>
    `${ref.calleeText} i critical-action-barrieren — DOM-scanning/frame-venten er forbudt (kontrakt §2); afvent eksplicitte deltager-promises.`,
  violatingFixtures: [
    { relativePath: CRITICAL_ACTION_MODULE, code: 'requestAnimationFrame(() => flush());' },
    { relativePath: CRITICAL_ACTION_MODULE, code: 'setTimeout(commit, 0);' },
    { relativePath: CRITICAL_ACTION_MODULE, code: 'const el = document.querySelector("[data-editor]");' },
  ],
  cleanFixtures: [
    { relativePath: CRITICAL_ACTION_MODULE, code: 'await participant.commit();' },
    { relativePath: CRITICAL_ACTION_MODULE, code: 'const el = document.activeElement;' },
    // Uden for barrieren er frame-planlægning fortsat tilladt (fx kosmetisk fokus).
    { relativePath: 'src/components/x.tsx', code: 'requestAnimationFrame(() => focus());' },
  ],
});

// --- EO felt-synlighed: governed felter må ikke bruges i inline render-gates -----

/**
 * Felter hvis synlighed OG beregnings-relevans ejes af et relevans-prædikat i
 * eoInputRelevance.ts (ét sandt sted). En inline render-gate på et sådant felt lader
 * "skjult i UI" og "ignoreret i beregning" divergere igen — derfor forbudt. Kontrol-
 * bindinger (`checked={getChecked(values.X)}` / `value={values.X}`) er tilladt, fordi
 * feltet dér ikke gater andet indhold.
 */
const GOVERNED_VISIBILITY_FIELDS: ReadonlyMap<string, string> = new Map([
  ['varigeMenAfgorelse', 'erVarigeMenAfgoerelseAktiv'],
  ['midlertidigtEETAfgorelse', 'erMidlertidigtEETAfgoerelseAktiv / erEETKlageRelevant'],
  ['endeligtEETAfgorelse', 'erEndeligtEETAfgoerelseAktiv / erEETKlageRelevant'],
  ['kravPaaSvieSmerteGodtgoerelse', 'erSvieSmerteSektionAktiv'],
  ['tidligereSsMax', 'erSvieSmertePeriodeInputRelevant'],
  ['kravPaaTabtArbejdsfortjeneste', 'erTabtArbejdsfortjenesteSektionAktiv'],
  ['kravPaaOevrigeErstatningskrav', 'erOevrigeKravSektionAktiv'],
  ['visBilagsnumre', 'erBilagsnumreRelevant'],
]);

const EO_OPLYSNINGER_SECTIONS_DIR = 'src/components/pages/erstatningsopgoerelse/eoOplysninger/sections';

/** `values.FIELD`-medlemsadgang på et governed felt → feltnavn, ellers null. */
const governedValuesFieldName = (node: ts.Node): string | null => {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'values' &&
    GOVERNED_VISIBILITY_FIELDS.has(node.name.text)
  ) {
    return node.name.text;
  }
  return null;
};

/**
 * Klatrer op gennem parenteser og `!` for at se, om `node` (evt. negeret/parenteseret)
 * er en operand i en logisk (`&&`/`||` hvis `allowOr`, ellers kun `&&`) binær-udtryk —
 * dvs. fungerer som en render-gate. Stopper ved alt andet (JSX-attribut, tildeling …).
 */
const isLogicalGateOperand = (node: ts.Node, allowOr: boolean): boolean => {
  let current: ts.Node = node;
  while (current.parent) {
    const parent = current.parent;
    if (ts.isBinaryExpression(parent)) {
      const op = parent.operatorToken.kind;
      return op === ts.SyntaxKind.AmpersandAmpersandToken || (allowOr && op === ts.SyntaxKind.BarBarToken);
    }
    if (
      ts.isParenthesizedExpression(parent) ||
      (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken)
    ) {
      current = parent;
      continue;
    }
    return false;
  }
  return false;
};

const findEoFieldVisibilityGates = (entry: SourceEntry): Finding[] => {
  const findings: Finding[] = [];
  const positionOf = (node: ts.Node): Finding['position'] => {
    const { line, character } = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
    return { line: line + 1, column: character + 1 };
  };

  const walk = (node: ts.Node): void => {
    // Case A: getChecked(values.FIELD) brugt som (evt. negeret) operand i && / ||.
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'getChecked' &&
      node.arguments.length === 1
    ) {
      const field = governedValuesFieldName(node.arguments[0]);
      if (field !== null && isLogicalGateOperand(node, /* allowOr */ true)) {
        findings.push({
          position: positionOf(node),
          message: `Inline synligheds-gate på values.${field} — brug relevans-prædikatet ${GOVERNED_VISIBILITY_FIELDS.get(field)} fra eoInputRelevance.ts.`,
        });
      }
    }

    // Case B: values.FIELD === '...' / !== '...' brugt som operand i &&.
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
        const field = governedValuesFieldName(node.left) ?? governedValuesFieldName(node.right);
        const otherSide = governedValuesFieldName(node.left) !== null ? node.right : node.left;
        if (field !== null && ts.isStringLiteralLike(otherSide) && isLogicalGateOperand(node, /* allowOr */ false)) {
          findings.push({
            position: positionOf(node),
            message: `Inline synligheds-gate på values.${field} — brug relevans-prædikatet ${GOVERNED_VISIBILITY_FIELDS.get(field)} fra eoInputRelevance.ts.`,
          });
        }
      }
    }

    ts.forEachChild(node, walk);
  };
  walk(entry.ast);
  return findings;
};

const eoFieldVisibilitySingleSource = defineRule({
  id: 'domain/eo-field-visibility-single-source',
  description:
    'Governed EO-input-felter (synlighed ejet af eoInputRelevance-prædikater) må ikke bruges i inline render-gates i eoOplysninger-sektionerne — ellers kan UI-synlighed og beregnings-neutralisering divergere.',
  liveTarget: {
    kind: 'scoped',
    roots: [EO_OPLYSNINGER_SECTIONS_DIR],
    rationale: 'EO-oplysningssektionerne findes stadig og kan indføre en inline synligheds-gate',
  },
  appliesTo: (relativePath) => relativePath.startsWith(`${EO_OPLYSNINGER_SECTIONS_DIR}/`),
  find: findEoFieldVisibilityGates,
  violatingFixtures: [
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <>{getChecked(values.varigeMenAfgorelse) && <A />}</>;' },
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: "const n = <>{values.kravPaaTabtArbejdsfortjeneste === 'Ja' && <A />}</>;" },
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <>{!getChecked(values.tidligereSsMax) && <A />}</>;' },
    {
      relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`,
      code: 'const n = <>{(getChecked(values.midlertidigtEETAfgorelse) || getChecked(values.endeligtEETAfgorelse)) && <A />}</>;',
    },
  ],
  cleanFixtures: [
    // Kontrol-bindinger (ingen efterfølgende boolsk gate).
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <Toggle checked={getChecked(values.varigeMenAfgorelse)} />;' },
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <Field value={values.kravPaaTabtArbejdsfortjeneste} />;' },
    // Ikke-governed felt i en gate er tilladt.
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <>{getChecked(values.oevrigtFravaerUdenLoen) && <A />}</>;' },
    // Prædikat-baseret gate (den ønskede form).
    { relativePath: `${EO_OPLYSNINGER_SECTIONS_DIR}/X.tsx`, code: 'const n = <>{erSvieSmerteSektionAktiv(values) && <A />}</>;' },
  ],
});

const RAW_REGULERING_SERIES_BINDINGS = new Set([
  'statistiskLoenudvikling',
  'getStatistiskLoenudvikling',
  'klLoenaftalerRaekker',
]);

const reguleringCanonicalForloebBoundary = forbidImports({
  id: 'domain/regulering-canonical-forloeb-boundary',
  description:
    'Reguleringspræsentation og -kontrol må ikke genindlæse statistik-, KRL-, KL- eller manuel-procentsatsserier; de skal læse motorens kanoniske forløb.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      entry.relativePath === 'src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts'
      || entry.relativePath === 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
    rationale: 'begge de regulerede præsentations-/kontrolmoduler findes stadig',
  },
  appliesTo: (relativePath) =>
    relativePath === 'src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts'
    || relativePath === 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
  forbidden: (ref) => {
    if (/\/(?:statistik|krl|klLoenaftaler|manuelProcentsats)Regulering$/.test(ref.moduleSpecifier)) {
      return true;
    }
    if (!/\/data\/(?:statistiskeRates|klLoenaftaler)$/.test(ref.moduleSpecifier)) {
      return false;
    }
    // Namespace/default/dynamic/require kan omgå en named-binding-liste og forbydes derfor helt.
    return (!ref.typeOnly && ref.namedBindings.length === 0)
      || ref.namedBindings.some((binding) => RAW_REGULERING_SERIES_BINDINGS.has(binding));
  },
  message: (ref) => `Direkte import af reguleringsserie (${ref.moduleSpecifier}) — brug ReguleringForloeb fra motor-modellen.`,
  violatingFixtures: [
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import { buildKrlIndexEntries } from '../erstatningsopgoerelse/engines/krlRegulering';",
    },
    {
      relativePath: 'src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts',
      code: "import { statistiskLoenudvikling } from '../../../data/statistiskeRates';",
    },
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import { klLoenaftalerRaekker } from '../../data/klLoenaftaler';",
    },
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "const rawRates = await import('../../data/statistiskeRates');",
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import type { ReguleringForloeb } from '../erstatningsopgoerelse/engines/reguleringForloeb';",
    },
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import { getReguleringsDatoIntervalForStatistikModel } from '../../data/statistiskeRates';",
    },
    {
      relativePath: 'src/domain/eoInspektion/eoInspektionRegulationCore.ts',
      code: "import { getReguleringsDatoIntervalForKlLoenaftaler } from '../../data/klLoenaftaler';",
    },
  ],
});

const eetDifferencekravCompositionBoundary = forbidImports({
  id: 'domain/eet-differencekrav-composition-boundary',
  description:
    'Differencekrav-aggregatoren må ikke starte EET-søsterberegninger; den eksplicitte beregningsgraf ejer kompositionen.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath === 'src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts',
    rationale: 'differencekrav-aggregatoren findes stadig som selvstændigt modul',
  },
  appliesTo: (relativePath) =>
    relativePath === 'src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts',
  forbidden: (ref) => ref.namedBindings.some((binding) =>
    binding === 'computeEetLoebendeYdelser'
    || binding === 'computeEetKapitaliseringCalculation'
    || binding === 'computeEetEalCalculation'
  ),
  message: (ref) =>
    `Skjult EET-søsterberegning (${ref.namedBindings.join(', ')}) — komponér i eetCalculationGraph.`,
  violatingFixtures: [{
    relativePath: 'src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts',
    code: "import { computeEetEalCalculation as runEal } from './eetEalCalculation';",
  }],
  cleanFixtures: [{
    relativePath: 'src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts',
    code: "import { resolveKapitaliseringAarsydelseBreakdown } from './eetKapitaliseringCalculation';",
  }],
});

const sfggEngineImportBoundary = forbidImports({
  id: 'domain/sfgg-engine-import-boundary',
  description:
    'Den samlede SFGG-engine må kun kaldes af TAF-netto-orkestreringen; øvrige lag bruger smalle SFGG-moduler eller resultattypen.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath.endsWith('/sfggEngine.ts'),
    rationale: 'den samlede SFGG-engine findes stadig som modul, der kan importeres uden om grænsen',
  },
  allow: ['src/domain/erstatningsopgoerelse/engines/tafNettoBeregning.ts'],
  forbidden: (ref) => ref.moduleSpecifier.endsWith('/sfggEngine') || ref.moduleSpecifier === './sfggEngine',
  message: (ref) => `Bred SFGG-engine-import (${ref.moduleSpecifier}) uden for TAF-netto-orkestreringen.`,
  violatingFixtures: [{
    relativePath: 'src/validators/x.ts',
    code: "import { computeSygeferiegodtgoerelse } from '../domain/erstatningsopgoerelse/engines/sfggEngine';",
  }],
  cleanFixtures: [{
    relativePath: 'src/validators/x.ts',
    code: "import { resolveSfggReferenceperiodeDayCount } from '../domain/erstatningsopgoerelse/engines/sfggReferencesats';",
  }],
});

const sfggAnsaettelsesforholdImportBoundary = forbidImports({
  id: 'domain/sfgg-ansaettelsesforhold-import-boundary',
  description: 'Pr.-ansættelsesforhold-beregningen er intern for den tynde SFGG-engine.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath.endsWith('/sfggAnsaettelsesforhold.ts'),
    rationale: 'pr.-ansættelsesforhold-beregningen findes stadig som modul, der kan importeres uden om grænsen',
  },
  allow: ['src/domain/erstatningsopgoerelse/engines/sfggEngine.ts'],
  forbidden: (ref) =>
    ref.moduleSpecifier.endsWith('/sfggAnsaettelsesforhold')
    || ref.moduleSpecifier === './sfggAnsaettelsesforhold',
  message: (ref) => `Direkte import af intern SFGG-ansættelsesberegning (${ref.moduleSpecifier}).`,
  violatingFixtures: [{
    relativePath: 'src/domain/x.ts',
    code: "import { computeSfggForAnsaettelsesforhold } from './erstatningsopgoerelse/engines/sfggAnsaettelsesforhold';",
  }],
  cleanFixtures: [{
    relativePath: 'src/domain/x.ts',
    code: "import type { SygeferiegodtgoerelseResult } from './erstatningsopgoerelse/engines/sfggResult';",
  }],
});

const sfggSegmenteringImportBoundary = forbidImports({
  id: 'domain/sfgg-segmentering-import-boundary',
  description: 'SFGG-segmentmatematik må kun bruges af engine-lagets to orkestratorer.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath.endsWith('/sfggSegmentering.ts'),
    rationale: 'SFGG-segmentmatematikken findes stadig som modul, der kan importeres uden om grænsen',
  },
  allow: [
    'src/domain/erstatningsopgoerelse/engines/sfggAnsaettelsesforhold.ts',
    'src/domain/erstatningsopgoerelse/engines/sfggEngine.ts',
  ],
  forbidden: (ref) =>
    ref.moduleSpecifier.endsWith('/sfggSegmentering') || ref.moduleSpecifier === './sfggSegmentering',
  message: (ref) => `Direkte import af intern SFGG-segmentmatematik (${ref.moduleSpecifier}).`,
  violatingFixtures: [{
    relativePath: 'src/domain/x.ts',
    code: "import { buildSfggGrossOre } from './erstatningsopgoerelse/engines/sfggSegmentering';",
  }],
  cleanFixtures: [{
    relativePath: 'src/domain/x.ts',
    code: "import { buildSfggPeriode } from './erstatningsopgoerelse/engines/sfggPeriodisering';",
  }],
});

const sfggWarningsImportBoundary = forbidImports({
  id: 'domain/sfgg-warnings-import-boundary',
  description: 'SFGG-seksmånedersadvarslen forbruges kun af snapshot og den fælles row-builder.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => entry.relativePath.endsWith('/sfggWarnings.ts'),
    rationale: 'SFGG-seksmånedersadvarslen findes stadig som modul, der kan importeres uden om grænsen',
  },
  allow: [
    'src/domain/eoRowEvaluation/eoRowSygeferiegodtgoerelseRows.ts',
    'src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts',
  ],
  forbidden: (ref) => ref.moduleSpecifier.endsWith('/sfggWarnings') || ref.moduleSpecifier === './sfggWarnings',
  message: (ref) => `SFGG-warning-import (${ref.moduleSpecifier}) uden for de autoritative forbrugere.`,
  violatingFixtures: [{
    relativePath: 'src/components/x.ts',
    code: "import { findSfggSixMonthWarningEmploymentIds } from '../domain/erstatningsopgoerelse/engines/sfggWarnings';",
  }],
  cleanFixtures: [{
    relativePath: 'src/components/x.ts',
    code: "import type { SygeferiegodtgoerelseResult } from '../domain/erstatningsopgoerelse/engines/sfggResult';",
  }],
});

/**
 * Fase 5's strukturelle håndhævelse: dokument-livscyklussen er den ENE vej til et dokument.
 *
 * Før Fase 5 lå livscyklussen spredt over tre lag pr. output, og hvert af de 18 outputs havde sin
 * egen kopi af spredningen — hvorfor fem af dem manglede mindst ét trin (commit-barriere, frisk
 * kildeoptagelse, token-lighed, friskheds-recheck). Nu ejer definitionen rækkefølgen, men det
 * holder kun, hvis ingen kan gå udenom. Derfor:
 *
 *   - En UI-fil må ikke importere en dokumentgenerator direkte. Generatoren nås kun gennem
 *     definitionens `loadRenderer`, som kernen først kalder EFTER gaten har sagt ready. Importerede
 *     en side generatoren selv, ville den kunne danne et dokument uden gate.
 *   - En UI-fil må ikke importere `triggerDocumentDownload`. Det er livscyklussens IRREVERSIBLE
 *     handling, og den skal ske efter det sidste friskheds-recheck — ikke fra en callsite.
 *   - En UI-fil må ikke importere kernens interne livscyklus-modul. `executeDocumentDownload` er
 *     ganske vist det eneste eksporterede navn dér, men en direkte import ville omgå katalogets
 *     binding af definition til miljø.
 *
 * **Reglen er AUTORITETSbaseret, ikke sti-baseret.** Første udgave gjaldt kun `src/components/` og
 * kunne derfor omgås ved at lægge callsite-logik et andet sted — fx i `domain/**\/react/`, hvor
 * `useReguleringDocumentAction` bor. Nu gælder forbuddet HELE repoet, og i stedet erklæres de få
 * moduler, der HAR autoriteten, eksplicit i `allow`. Det gør listen til en beslutning man kan læse,
 * frem for en konsekvens af hvor filerne tilfældigvis ligger.
 *
 */
const DOCUMENT_GENERATOR_AUTHORITIES: readonly string[] = [
  // Definitionerne lazy-loader deres egen generator i `loadRenderer`.
  'src/domain/satser/satserDocumentDefinition.ts',
  'src/domain/renteberegning/renteberegningDocumentDefinitions.ts',
  'src/domain/erstatningsopgoerelse/eoDocumentDefinitions.ts',
  'src/domain/erstatningsopgoerelse/reguleringDocumentDefinitions.ts',
  'src/domain/erhvervsevnetab/eetDocumentDefinitions.ts',
  'src/domain/forsoergertab/forsoergertabDocumentDefinition.ts',
  'src/domain/varigemen/varigeMenDocumentDefinition.ts',
  'src/domain/aarsloen/aarsloenDocumentDefinitions.ts',
  'src/apps/minprocesrente/document/standaloneRenteDocumentDefinitions.ts',
];

const DOCUMENT_LIFECYCLE_AUTHORITIES: readonly string[] = [
  // Livscyklussen er den ENESTE der må starte fil-I/O.
  'src/document/definition/documentLifecycle.ts',
  // Katalogfabrikken binder den lukkede action til miljøet og kalder livscyklussen.
  'src/document/definition/documentCatalog.ts',
];

const documentLifecycleBypass = forbidImports({
  id: 'document/lifecycle-single-entrypoint',
  description:
    'Kun kataloget må importere kernens livscyklus, og kun livscyklussen må importere fil-I/O.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => DOCUMENT_LIFECYCLE_AUTHORITIES.includes(entry.relativePath),
    rationale: 'livscyklus-kernen og kataloget findes stadig som de moduler, alle downloads skal igennem',
  },
  allow: DOCUMENT_LIFECYCLE_AUTHORITIES,
  forbidden: (ref) => {
    const moduleSpecifier = ref.moduleSpecifier.replaceAll('\\', '/');
    // Matcher også en SØSKENDE-import (`./documentLifecycle`). Første udgave
    // krævede mappenavnet i specifieren og lod derfor et modul i samme mappe importere kernen frit.
    const importsLifecycle = /(?:^|\/)documentLifecycle$/.test(moduleSpecifier);
    const importsFileIo =
      ref.namedBindings.includes('triggerDocumentDownload')
      || (/(?:^|\/)document\/downloadArtifact$/.test(moduleSpecifier) && !ref.typeOnly && ref.namedBindings.length === 0);
    return importsLifecycle || importsFileIo;
  },
  message: (ref) =>
    `Uautoriseret omgåelse af dokument-livscyklussen (${ref.moduleSpecifier}) — aktivér outputtet gennem kataloget.`,
  violatingFixtures: [
    { relativePath: 'src/components/pages/X.tsx', code: "import { triggerDocumentDownload } from '../../document/downloadArtifact';" },
    { relativePath: 'src/components/pages/X.tsx', code: "import { executeDocumentDownload } from '../../document/definition/documentLifecycle';" },
    // Uden for components-laget gælder forbuddet nu OGSÅ — det var hullet i første udgave.
    { relativePath: 'src/domain/x/react/useXAction.ts', code: "import { executeDocumentDownload } from '../../../document/definition/documentLifecycle';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/components/pages/X.tsx', code: "import { satserDocumentDefinition } from '../../domain/satser/satserDocumentDefinition';" },
    { relativePath: 'src/components/pages/X.tsx', code: "import { useMineoDocumentOutput } from '../../document/runtime/react/useMineoDocumentOutput';" },
  ],
});

/** Generatorer er kun tilgængelige gennem en definitions lazy `loadRenderer`. */
const documentGeneratorImportBoundary = forbidImports({
  id: 'document/generator-import-boundary',
  description: 'Kun dokumentdefinitioner må importere dokumentgeneratorer.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/document/generators'],
    rationale: 'der findes stadig dokumentgeneratorer, som kan importeres uden om en definition',
  },
  allow: DOCUMENT_GENERATOR_AUTHORITIES,
  forbidden: (ref) => !ref.typeOnly && ref.moduleSpecifier.replaceAll('\\', '/').includes('document/generators/'),
  message: (ref) => `Uautoriseret generatorimport (${ref.moduleSpecifier}) — generatoren skal ligge bag definitionens loadRenderer.`,
  violatingFixtures: [
    { relativePath: 'src/components/pages/X.tsx', code: "import { generateRenteDocument } from '../../document/generators/renteberegning/renteDocument';" },
    { relativePath: 'src/document/definition/x.ts', code: "const g = await import('../../document/generators/satser/satserDocument');" },
  ],
  cleanFixtures: [
    { relativePath: 'src/components/pages/X.tsx', code: "import type { RenteOversigtRow } from '../../document/generators/renteberegning/renteOversigtDocument';" },
    { relativePath: 'src/domain/satser/satserDocumentDefinition.ts', code: "const g = await import('../../document/generators/satser/satserDocument');" },
  ],
});

const documentGeneratorWriterImport = forbidImports({
  id: 'document/generator-writer-import-boundary',
  description: 'Dokumentgeneratorer må kun bygge DocumentModel og må ikke importere writer-targets, kanaler eller den imperative modelrenderer.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/document/generators'],
    rationale: 'generatorlaget findes stadig og kan gribe ned i writer/kanal/renderer',
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/document/generators/'),
  forbidden: (ref) => {
    const moduleSpecifier = ref.moduleSpecifier.replaceAll('\\', '/');
    const importsWriter = /(?:^|\/)writer(?:\/(?:documentWriter|index))?$/.test(moduleSpecifier);
    const importsChannel = /(?:^|\/)(?:pdf|docx)(?:\/|$)/.test(moduleSpecifier);
    const importsModelNamespace =
      /(?:^|\/)model\/documentModel$/.test(moduleSpecifier)
      && !ref.typeOnly
      && ref.namedBindings.length === 0;
    const importsImperativeRenderer =
      ref.namedBindings.includes('renderDocumentModel') || importsModelNamespace;
    const createsOwnSession =
      ref.namedBindings.includes('createDocumentGenerationSession')
      || (
        /(?:^|\/)documentGenerationSession$/.test(moduleSpecifier)
        && !ref.typeOnly
        && ref.namedBindings.length === 0
      );
    return importsWriter || importsChannel || importsImperativeRenderer || createsOwnSession;
  },
  message: (ref) => `Import af intern dokumentrendering (${ref.moduleSpecifier}) — byg kun via DocumentComposer og den modtagne session.`,
  violatingFixtures: [
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import type { DocumentWriter } from '../../writer/index';" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import { renderDocumentModel } from '../../model/documentModel';" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "const model = await import('../../model/documentModel');" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import { createDocumentGenerationSession } from '../../documentGenerationSession';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import type { DocumentComposer } from '../../model/documentModel';" },
    { relativePath: 'src/document/generators/x/xDocument.ts', code: "import type { DocumentGenerationSession } from '../../documentGenerationSession';" },
  ],
});

const DOCUMENT_GENERATOR_CURSOR_MEMBERS = new Set(['getDoc', 'getY', 'setY', 'advanceY', 'ensureSpace', 'getTextWidth', 'getPageWidth', 'getContentWidthMm', 'addImageDataUrl']);

const documentGeneratorCursorAccess = forbidMemberAccess({
  id: 'document/generator-cursor-access-boundary',
  description: 'Dokumentgeneratorer må ikke observere kanal, cursor eller dokumentmål.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/document/generators'],
    rationale: 'generatorlaget findes stadig og kan tilgå cursoren imperativt',
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/document/generators/'),
  forbidden: (ref) => DOCUMENT_GENERATOR_CURSOR_MEMBERS.has(ref.chainText.split('.').at(-1) ?? ''),
  message: (ref) => `Imperativ dokumentadgang (${ref.chainText}) — brug en deklarativ DocumentBlock.`,
  violatingFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'const y = writer.getY();' }],
  cleanFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'document.addTable(spec);' }],
});

const documentGeneratorCursorElementAccess = forbidElementAccess({
  id: 'document/generator-cursor-element-access-boundary',
  description: 'Bracket-notation må ikke omgå dokumentgeneratorernes cursorgrænse.',
  liveTarget: {
    kind: 'scoped',
    roots: ['src/document/generators'],
    rationale: 'generatorlaget findes stadig og kan omgå cursorgrænsen med bracket-notation',
  },
  appliesTo: (relativePath) => relativePath.startsWith('src/document/generators/'),
  forbidden: (ref) => Array.from(DOCUMENT_GENERATOR_CURSOR_MEMBERS).some((member) => ref.chainText.endsWith(`["${member}"]`) || ref.chainText.endsWith(`['${member}']`)),
  message: (ref) => `Imperativ dokumentadgang (${ref.chainText}) — brug en deklarativ DocumentBlock.`,
  violatingFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'writer["getDoc"]();' }],
  cleanFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'const value = data["value"];' }],
});

// --- WI-003: kommitterende felt-familier skal bære undo/redo-restore-target-attributterne ----------
//
// En feltfamilie, der renderer sit EGET fokuserbare element — enten via en surface-hook
// (`useFormFieldSurface`/`useGridCellSurface`) eller ved at rendere en fokuserbar `Styled*`-kontrol
// (toggle/checkbox/radio/dropdown) — SKAL føre restore-target-attributterne igennem, så undo/redo kan re-fokusere
// PRÆCIS den editorlokation, ændringen kom fra (§3.7). De tynde preset-skaller (Integer/Percent/Amount/…), der blot
// videresender `field`/`location` til en anden feltkomponent, har intet eget fokuserbart element og er
// derfor rene UDEN attributterne — reglen flager dem ikke, fordi de hverken bruger en surface-hook eller en Styled*-kontrol.
//
// Scopet er HELE feltmappen (ikke et navnepræfiks): et nyt felt i mappen er dækket automatisk, og reglen kan
// ikke stille blive inert af en omdøbning.
const FIELDS_DIR = 'src/inputCore/react/fields';
const RESTORE_ATTR_TOKEN = /\b(?:useRestoreTargetAttributes|restoreTargetAttributes)\b/;
// De fokuserbare primitiver, en feltfamilie renderer direkte, når den ejer sit eget input-element.
const FOCUSABLE_SURFACE_SIGNAL = /\b(?:useFormFieldSurface|useGridCellSurface|StyledToggleSwitch|StyledCheckbox|StyledRadioButton|StyledDropdown)\b/;

const restoreTargetAttributesRule = defineRule({
  id: 'form/restore-target-attributes',
  description:
    'Feltfamilier, der ejer et fokuserbart element (surface-hook eller Styled*-kontrol), skal føre restore-target-attributterne igennem, så undo/redo kan re-fokusere den rette editorlokation (§3.7).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      entry.relativePath.startsWith(FIELDS_DIR + '/')
      && entry.relativePath.endsWith('.tsx')
      && FOCUSABLE_SURFACE_SIGNAL.test(entry.text),
    rationale:
      'mindst én feltfamilie ejer stadig et fokuserbart element og skal derfor bære restore-target-attributterne',
  },
  appliesTo: (relativePath) =>
    relativePath.startsWith(`${FIELDS_DIR}/`) && relativePath.endsWith('.tsx'),
  find: (entry) => {
    // Rent tekst-værn: selve tilstedeværelsen af attributterne er kontrakten (jf. guard-selvtest-princippet).
    if (!FOCUSABLE_SURFACE_SIGNAL.test(entry.text)) return [];
    if (RESTORE_ATTR_TOKEN.test(entry.text)) return [];
    return [{
      position: { line: 1, column: 1 },
      message:
        'Feltfamilien renderer et fokuserbart element, men fører ikke restore-target-attributterne igennem '
        + '(useRestoreTargetAttributes/restoreTargetAttributes) — undo/redo kan da ikke re-fokusere feltet (§3.7).',
    }];
  },
  violatingFixtures: [
    {
      relativePath: `${FIELDS_DIR}/XField.tsx`,
      code: 'const C = () => { const s = useFormFieldSurface(field, location); return <input {...s.htmlInputAttributes} />; };',
    },
    {
      relativePath: `${FIELDS_DIR}/YField.tsx`,
      code: 'const C = () => <StyledToggleSwitch checked={false} onCommit={c} />;',
    },
  ],
  cleanFixtures: [
    // Ejer et fokuserbart element OG fører attributterne igennem.
    {
      relativePath: `${FIELDS_DIR}/XField.tsx`,
      code: 'const C = () => { const rta = useRestoreTargetAttributes(field.address, location); return <StyledCheckbox restoreTargetAttributes={rta} />; };',
    },
    // Tynd preset-skal: videresender kun til en anden Greenfield-komponent → intet eget fokuserbart element.
    {
      relativePath: `${FIELDS_DIR}/ZField.tsx`,
      code: 'const C = () => <NumericTextField field={field} location={location} />;',
    },
  ],
});

// --- Rækkehandlinger skal bære en navigerbar destination (§3.7) ---------------

const ROW_COMMAND_HOOKS = new Set(['useCollectionRows', 'useCollectionRowCommands']);

/**
 * En rækkehandling (insert/delete/reorder) skal kunne navigeres tilbage til efter undo/redo.
 *
 * PRIMÆRT VÆRN er typen: `CollectionRowOrigin.route`/`tabKey` er PÅKRÆVEDE, så compileren afviser et origin
 * uden destination — også når det videreføres som en variabel. Denne AST-regel er et SEKUNDÆRT værn, der
 * fanger den ene ting typen ikke udtrykker: et literal-origin, hvor `route` er udeladt helt, giver en
 * type-fejl, men reglen giver en præcis, domænesproget besked ved det rette callsite i stedet for en generisk
 * "property missing". Den læser bevidst kun literal-argumenter; variable origins er typedækkede.
 */
const rowCommandDestinationRule = defineRule({
  id: 'input/row-command-destination',
  description:
    'useCollectionRows/useCollectionRowCommands skal kaldes med et origin, der bærer en route, så undo/redo af '
    + 'en rækkehandling kan navigere til den tabel, ændringen kom fra (§3.7).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      collectCalls(entry).some((ref) => ROW_COMMAND_HOOKS.has(ref.calleeName))
      && !entry.relativePath.endsWith('useCollectionRows.ts'),
    rationale: 'mindst ét rækkehandlings-callsite findes uden for hookens egen definition',
  },
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/components/') || relativePath.startsWith('src/inputCore/react/'),
  find: (entry) => {
    const findings: Finding[] = [];
    for (const call of collectCalls(entry)) {
      if (!ROW_COMMAND_HOOKS.has(call.calleeName)) continue;
      // Hookens egen definition/re-eksport er ikke et callsite.
      if (entry.relativePath.endsWith('useCollectionRows.ts')) continue;

      const originArgument = call.node.arguments[1];
      if (originArgument === undefined) {
        findings.push({
          position: call.position,
          message: `${call.calleeName} kaldt uden origin — rækkehandlingen får ingen destination (§3.7).`,
        });
        continue;
      }
      if (!ts.isObjectLiteralExpression(originArgument)) {
        // Et videreført origin-objekt (variabel) kan ikke inspiceres her; typen dækker tilstedeværelsen.
        continue;
      }
      const carriesRoute = originArgument.properties.some((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return property.name.text === 'route';
        if (ts.isSpreadAssignment(property)) return /\broute\b/.test(property.getText());
        if (!ts.isPropertyAssignment(property)) return false;
        return ts.isIdentifier(property.name) && property.name.text === 'route';
      });
      if (carriesRoute) continue;
      findings.push({
        position: call.position,
        message:
          `${call.calleeName} kaldt med et origin uden 'route' — undo/redo af insert/delete/reorder ville `
          + 'gendanne data, men efterlade brugeren på en vilkårlig side (§3.7).',
      });
    }
    return findings;
  },
  violatingFixtures: [
    {
      relativePath: 'src/components/tables/NyTabel.tsx',
      code: "const rows = useCollectionRows(collectionRef, { locationId: 'x.rows' });",
    },
    {
      relativePath: 'src/components/tables/NyTabel2.tsx',
      code: "const rows = useCollectionRowCommands(collectionRef, { locationId: 'x.rows', tabKey: null });",
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/tables/NyTabel.tsx',
      code: "const rows = useCollectionRows(collectionRef, { locationId: 'x.rows', route: APP_ROUTES.satser, tabKey: null });",
    },
    // Videreført kalder-navigation: route kommer fra en spread/variabel.
    {
      relativePath: 'src/components/tables/NyTabel2.tsx',
      code: "const rows = useCollectionRowCommands(collection, { locationId: p, route: locationNav.route, tabKey: locationNav.tabKey });",
    },
    // Videreført origin som variabel: typen (`CollectionRowOrigin` med påkrævet route/tabKey) er værnet her,
    // så AST-reglen springer den bevidst over frem for at gætte på variablens indhold.
    {
      relativePath: 'src/components/tables/NyTabel3.tsx',
      code: 'const rows = useCollectionRows(collection, rowOrigin);',
    },
  ],
});

// --- Skrivegrænsen: kun runneren skriver input (§3.6) -------------------------

/**
 * PRIMÆRVÆRNET er TYPEN, ikke denne regel.
 *
 * `applyCommit`/`hydrate` kræver en `InputWriteAuthority` — et `unique symbol`-brandet vidne, som kun
 * `claimInputWriteAuthority()` i `slimInputStore.ts` kan udstede. Et nyt modul, der importerer storen
 * og forsøger at skrive, får en compilerfejl. Typen dækker også den sag, en AST-regel principielt ikke
 * kan se: en store, der er ført videre gennem en variabel eller en generisk hjælper.
 *
 * Reglen lukker de to huller, typen efterlader — og `description` siger hvorfor typen ikke rakte alene
 * (jf. acceptkriteriet i WI-012):
 *
 *   1. **Type-assertion.** `{} as InputWriteAuthority` forfalsker vidnet uden en type-fejl. Det er
 *      brandede typers kendte loft, og en assertion er præcis den slags lokale, bevidste handling en
 *      AST-regel ser godt.
 *   2. **Producentlisten.** `claimInputWriteAuthority` er nødt til at være eksporteret, fordi de to
 *      autoritative skriveveje ligger i søskendemoduler. Uden en regel kunne en tredje kalder tilføjes
 *      lydløst — og skrivegrænsen ville flytte sig uden at nogen traf beslutningen.
 *
 * Allowlisten er tom med vilje: en undtagelse ville være en anden samtidig sandhed om, hvem der ejer
 * input — samme begrundelse som `input/deleted-legacy-architecture-import`.
 */
/** Modulet der UDSTEDER vidnet. Kun her giver en assertion mening — den ER konstruktionen af brandet. */
const WRITE_AUTHORITY_ISSUER = 'src/inputCore/runtime/slimInputStore.ts';

/** Modulerne der må KALDE udstederen, dvs. de autoritative skriveveje (§3.6). */
const INPUT_WRITE_AUTHORITIES: readonly string[] = [
  'src/inputCore/runtime/dispatchInput.ts',
  'src/inputCore/runtime/initializeInputRuntime.ts',
  WRITE_AUTHORITY_ISSUER,
];

const inputWriteBoundary = defineRule({
  id: 'input/write-boundary',
  description:
    'Kun runneren skriver input (§3.6). Grænsen bæres af typen `InputWriteAuthority`; denne regel lukker '
    + 'de to huller typen ikke kan: en type-assertion, der forfalsker vidnet, og en uautoriseret kalder '
    + 'af `claimInputWriteAuthority`, der ville flytte skrivegrænsen uden en beslutning.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => INPUT_WRITE_AUTHORITIES.includes(entry.relativePath),
    rationale:
      'skrivegrænsens moduler (store + de to autoritative skriveveje) findes stadig — forsvinder de, '
      + 'er grænsen flyttet og reglen skal skrives om',
  },
  allow: [],
  find: (entry) => {
    const findings: Finding[] = [];
    const authorized = INPUT_WRITE_AUTHORITIES.includes(entry.relativePath);

    // Udstederen SKAL assertere for at kunne konstruere brandet — det er selve vidnets fødsel, og den
    // hører netop hjemme ét sted. Alle andre assertions til typen er en forfalskning.
    for (const ref of entry.relativePath === WRITE_AUTHORITY_ISSUER ? [] : collectTypeAssertions(entry)) {
      if (/(?:^|\.)InputWriteAuthority$/.test(ref.typeText)) {
        findings.push({
          position: ref.position,
          message:
            'Type-assertion til InputWriteAuthority forfalsker skrive-vidnet — skriv gennem '
            + 'dispatchInput/initializeInputRuntime i stedet for at omgå §3.6.',
        });
      }
    }

    if (!authorized) {
      for (const ref of collectCalls(entry)) {
        // Også testvidnet: kilde-grafen er ren produktion, så et kald HER ville være en skrivevej,
        // der har sneget sig ind under et testnavn.
        if (ref.calleeName === 'claimInputWriteAuthority' || ref.calleeName === '__testInputWriteAuthority') {
          findings.push({
            position: ref.position,
            message:
              'Uautoriseret udstedelse af skrive-vidnet (claimInputWriteAuthority) — kun runneren og '
              + 'hydreringen må skrive input (§3.6).',
          });
        }
      }
    }

    return findings;
  },
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'const a = {} as InputWriteAuthority;' },
    { relativePath: 'src/x.ts', code: 'store.getState().hydrate(input, value as unknown as InputWriteAuthority);' },
    { relativePath: 'src/components/x.tsx', code: 'store.getState().applyCommit(c, claimInputWriteAuthority());' },
    // Også inde i inputCore — men uden for de tre autoriserede moduler.
    { relativePath: 'src/inputCore/react/x.ts', code: 'const a = claimInputWriteAuthority();' },
    // Testvidnet må ikke bruges som bagdør i produktionskoden.
    { relativePath: 'src/components/x.tsx', code: 'store.getState().hydrate(i, __testInputWriteAuthority());' },
  ],
  cleanFixtures: [
    // De autoritative skriveveje må naturligvis udstede vidnet.
    {
      relativePath: 'src/inputCore/runtime/dispatchInput.ts',
      code: 'store.getState().applyCommit(commit, claimInputWriteAuthority());',
    },
    {
      relativePath: 'src/inputCore/runtime/initializeInputRuntime.ts',
      code: 'store.getState().hydrate(input, claimInputWriteAuthority());',
    },
    // Læsning er fri.
    { relativePath: 'src/components/x.tsx', code: 'const state = slimInputStore.getState();' },
    // En anden type-assertion er ikke reglens ærinde.
    { relativePath: 'src/x.ts', code: 'const n = value as number;' },
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

const transientCannotWriteCaseData = forbidImports({
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
 * **To navne fra planens liste er UDELADT, fordi de er levende greenfield-vokabular:**
 *
 *   - `fieldErrors` bruges i ~12 produktionsmoduler (snapshots, reader-projektioner, download-gates)
 *     som det nuværende feltnavn i snapshot-/projektionskontrakterne.
 *   - `blocksSave` er EO's levende navn i `eoInputIssues.ts`.
 *
 * At forbyde dem ville tvinge en kosmetisk omdøbning igennem uden gevinst — stik imod
 * [[feedback_prefer_structural_unification]]. Planens §Fase 6 er opdateret med samme begrundelse, så
 * plan og værn ikke driver fra hinanden (exitkriterie 4).
 *
 * `usePersistedForm` og `useSliceRowDrafts` blev afklaret i WI-012's pass 1: begge har NUL identifiers
 * i produktionen (og `usePersistedForm` har ingen definition overhovedet), så de hører hjemme på listen.
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
];

const FORBIDDEN_IDENTIFIER_SET = new Set(FORBIDDEN_LEGACY_IDENTIFIERS);

const forbiddenLegacyIdentifier = defineRule({
  id: 'legacy/forbidden-identifier',
  description:
    'De slettede legacy-mekanismers navne må ikke genopstå som identifiers i produktionskoden. Gaten '
    + 'måler AST-identifiers, ikke tekst, så historik-kommentarer om de samme mekanismer bevares.',
  liveTarget: {
    kind: 'absence',
    forbids: FORBIDDEN_LEGACY_IDENTIFIERS,
    rationale:
      'nul hits ER målet: hvert navn er bevisligt dødt som identifier. `deletedLegacyAbsence.test.ts` '
      + 'holder listen ærlig ved at kræve, at navnene faktisk er fraværende — ellers kunne gaten '
      + 'stille blive en liste over stavefejl.',
  },
  find: (entry) => {
    const findings: Finding[] = [];
    const sourceFile = entry.ast;

    const visit = (node: ts.Node): void => {
      // KUN identifiers. Kommentarer er ikke en del af AST'ens node-træ og kan derfor pr. konstruktion
      // ikke flages — det er selve grunden til at gaten er AST-baseret og ikke tekstbaseret.
      if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIER_SET.has(node.text)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        findings.push({
          position: { line: line + 1, column: character + 1 },
          message:
            `Genindført legacy-symbol '${node.text}' — mekanismen er slettet i greenfield-cutoveren. `
            + 'Brug inputCore: reader/projektion til læsning, dispatch/useFieldEditor til skrivning.',
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return findings;
  },
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
    // Levende greenfield-vokabular må ikke rammes.
    { relativePath: 'src/x.ts', code: 'const { fieldErrors } = snapshot; const b = issue.blocksSave;' },
  ],
});

export const ARCHITECTURE_RULES: readonly ArchitectureRule[] = [
  localStorageBoundary,
  sessionStorageBoundary,
  sessionStorageManifestKey,
  deletedLegacyInputArchitectureImport,
  failOpenDisplayLookupImport,
  aslAarsloensmaksimumRawSubscript,
  inspektionLayerImport,
  moneyOreTypeAssertion,
  pageSectionAccessBoundary,
  pdfDownloadCommittedState,
  minprocesrenteStandaloneImport,
  persistenceCommittedMirror,
  queueMicrotaskBoundary,
  promiseTickBoundary,
  criticalActionNoDomScanOrFrameWait,
  eoFieldVisibilitySingleSource,
  reguleringCanonicalForloebBoundary,
  eetDifferencekravCompositionBoundary,
  sfggEngineImportBoundary,
  sfggAnsaettelsesforholdImportBoundary,
  sfggSegmenteringImportBoundary,
  sfggWarningsImportBoundary,
  documentLifecycleBypass,
  documentGeneratorImportBoundary,
  documentGeneratorWriterImport,
  documentGeneratorCursorAccess,
  documentGeneratorCursorElementAccess,
  restoreTargetAttributesRule,
  rowCommandDestinationRule,
  inputWriteBoundary,
  transientCannotWriteCaseData,
  forbiddenLegacyIdentifier,
];
