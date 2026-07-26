/**
 * Storage- og persistensgrænser.
 *
 * Adgang til browser-globaler og til den persisterede sektionsform: alt skal gennem de kanoniske
 * wrappere og manifestets nøgler, og den slettede legacy-inputarkitektur må ikke genopstå.
 *
 * Del af det opdelte arkitekturmanifest (Fase 6, genåbnet): manifestet var 2.133 linjer og blandede
 * storage-, input-, domæne-, UI- og dokumentregler i én fil, hvor en regel og dens nabo intet havde
 * med hinanden at gøre. `architectureRules.ts` samler nu de fem koncern-moduler til ét registry.
 */
import { isValidStorageKey } from '../../../../config/storageManifest';
import { collectCalls, collectImports } from '../astQueries';
import { forbidCalls, forbidImports, forbidMemberAccess } from '../ruleKit';

// --- Storage-globaler: al adgang skal gå gennem de kanoniske wrappere ---------

const isDirectLocalStorageAccess = (chainText: string, rootName: string): boolean =>
  rootName === 'localStorage' || /^(?:window|globalThis)\.localStorage(?:\.|$)/.test(chainText);

const isDirectSessionStorageAccess = (chainText: string, rootName: string): boolean =>
  rootName === 'sessionStorage' || /^(?:window|globalThis)\.sessionStorage(?:\.|$)/.test(chainText);

export const localStorageBoundary = forbidMemberAccess({
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

export const sessionStorageBoundary = forbidMemberAccess({
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

export const sessionStorageManifestKey = forbidCalls({
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
export const deletedLegacyInputArchitectureImport = forbidImports({
  id: 'input/deleted-legacy-architecture-import',
  description:
    'Den slettede legacy-inputarkitektur (formPersistence*, inputRuntimeStore, FormPersistenceContext, '
    + 'inputTransactionRunner, criticalActions/, rowDrafts/, tableInput/, useDraftField, Styled*Field-vejen) '
    + 'må ikke importeres eller genindføres.',
  liveTarget: {
    kind: 'absence',
    forbids: DELETED_LEGACY_INPUT_MODULE_PATHS,
    rationale: 'nul hits ER målet: modulerne er slettet',
    // Fraværet af et MODUL bevises på to måder: filen findes ikke i grafen, og ingen fil importerer
    // stien. Anden retning (harnesset kalder samme prædikat på en syntetisk importfil) beviser, at
    // regexen faktisk matcher stien — et forbud mod en forkert stavet sti er vakuøst.
    verifyAbsent: (modulePath, entries) => {
      // En MODULsti er fraværende, når hverken modulfilen selv eller en fil under en forbudt MAPPE
      // findes. Sammenligningen sker på hele stisegmenter — ellers ville `StyledTextField` "findes"
      // på grund af `StyledTextFieldBase.tsx`, som er en bevidst bevaret UI-primitiv, og fraværet
      // ville rapportere en overtrædelse, der ikke er der.
      const isDirectory = modulePath.endsWith('/');
      const fileExists = entries.some((entry) => isDirectory
        ? entry.relativePath.startsWith(modulePath)
        : /^(?:\.tsx?|\/index\.tsx?)$/.test(entry.relativePath.slice(modulePath.length))
          && entry.relativePath.startsWith(modulePath));
      if (fileExists) return false;
      const importedBy = entries.some((entry) => collectImports(entry).some(
        (ref) => DELETED_LEGACY_INPUT_MODULES.test(ref.moduleSpecifier)
      ));
      return !importedBy;
    },
    absenceProbeCode: (modulePath) => {
      const specifier = modulePath.replace(/^src\//, '../').replace(/\/$/, '/Thing');
      return `import { x } from '${specifier}';`;
    },
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
