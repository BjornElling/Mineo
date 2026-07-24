import { PERSISTED_SECTION_KEYS } from '../../../config/persistenceRegistry';
import { isValidStorageKey, type StorageKey } from '../../../config/storageManifest';
import ts from 'typescript';
import { collectCalls, resolveRelativeImport } from './astQueries';
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
  allow: [
    'src/config/storageManifest.ts',
    'src/contexts/FormPersistenceContext.tsx',
    'src/utils/dataCollection.ts',
    'src/utils/persistenceSessionHydration.ts',
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

const sessionStorageManifestKey = forbidCalls({
  id: 'storage/session-storage-manifest-key',
  description:
    'sessionStorage.setItem må kun kaldes med en manifest-registreret literal storage-key.',
  forbidden: (ref) =>
    ref.calleeName === 'setItem' &&
    (ref.calleeText === 'sessionStorage.setItem' ||
      ref.calleeText === 'window.sessionStorage.setItem' ||
      ref.calleeText === 'globalThis.sessionStorage.setItem') &&
    ref.firstArgStringLiteral !== null &&
    !isValidStorageKey(ref.firstArgStringLiteral),
  message: (ref) =>
    `sessionStorage.setItem med ikke-registreret literal key: ${ref.firstArgStringLiteral}`,
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem("ikke-en-key", v);' },
    { relativePath: 'src/x.ts', code: 'window.sessionStorage.setItem("random", v);' },
  ],
  cleanFixtures: [
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem("mineo_stamdata", v);' },
    { relativePath: 'src/x.ts', code: 'sessionStorage.setItem(dynamicKey, v);' },
    { relativePath: 'src/x.ts', code: 'sessionStorage.getItem("hvad-som-helst");' },
    { relativePath: 'src/x.ts', code: 'other.setItem("ikke-en-key", v);' },
  ],
});

// --- Persistence-import-grænser ----------------------------------------------

const useFormPersistenceImport = forbidImports({
  id: 'persistence/use-form-persistence-import',
  description:
    'useFormPersistence må kun importeres af infrastruktur og de kanoniske imperative hooks.',
  // MainLayout og usePersistedForm er væk efter greenfield-cutoveren (WI-002); kun det bevarede
  // useFormFieldErrors (Styled*Field-vejen, Fase 5) importerer stadig useFormPersistence.
  allow: [
    'src/hooks/useFormFieldErrors.ts',
  ],
  forbidden: (ref) => ref.moduleSpecifier.endsWith('contexts/useFormPersistence'),
  message: (ref) => `Import af useFormPersistence (${ref.moduleSpecifier}) uden for allowlisten.`,
  violatingFixtures: [
    { relativePath: 'src/foo.ts', code: "import { useFormPersistence } from '../../contexts/useFormPersistence';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/foo.ts', code: "import { x } from '../../contexts/useFormPersistenceSelectors';" },
    { relativePath: 'src/foo.ts', code: "import { x } from './somethingElse';" },
  ],
});

const formPersistenceContextImport = forbidImports({
  id: 'persistence/form-persistence-context-import',
  description:
    'Direkte import af FormPersistenceContext(.shared/.internal) er kun tilladt i contexts-infrastrukturen.',
  // Efter greenfield-cutoveren (WI-002) er Provideren (`FormPersistenceContext.tsx`) slettet; kun
  // `.internal`/`.shared` og de bevarede context-frit-degraderende infrastrukturhooks (Styled*Field- +
  // celle-invalidDraft-vejen, Fase 5) importerer stadig context-objektet/typerne direkte.
  allow: [
    'src/contexts/FormPersistenceContext.internal.ts',
    'src/contexts/FormPersistenceContext.shared.ts',
    'src/contexts/useFormPersistence.ts',
    // Celle-invalidDrafts-kanalen er persistence-infrastruktur: den læser context direkte for at
    // kunne degradere context-frit uden at kaste, når en tabel rendres uden provider (tests).
    'src/hooks/tableInput/useCellInvalidDraftChannel.ts',
    // Samme infrastruktur-rolle: reconcile af forældreløse celle-invalidDrafts mod levende rækker.
    'src/hooks/tableInput/useReconcileInvalidDraftsToLiveRows.ts',
  ],
  forbidden: (ref) => /FormPersistenceContext(?:\.shared|\.internal)?$/.test(ref.moduleSpecifier),
  message: (ref) =>
    `Direkte import af FormPersistenceContext (${ref.moduleSpecifier}) uden for infrastrukturen.`,
  violatingFixtures: [
    { relativePath: 'src/foo.ts', code: "import { FormPersistenceContext } from '../contexts/FormPersistenceContext';" },
    { relativePath: 'src/foo.ts', code: "import { x } from '../contexts/FormPersistenceContext.internal';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/foo.ts', code: "import { useFormPersistence } from '../contexts/useFormPersistence';" },
    { relativePath: 'src/foo.ts', code: "import { x } from './FormPersistenceHelpers';" },
  ],
});

const formPersistenceStoreImport = forbidImports({
  id: 'persistence/form-persistence-store-import',
  description:
    'Direkte import af stores/formPersistenceStore er kun tilladt i de kanoniske adgangspunkter.',
  allow: [
    'src/hooks/useFormPersistenceSelectors.ts',
    // Domæne-specifik read model: abonnerer direkte på storen for ét cachet tværsektion-snapshot.
    'src/hooks/useMidlertidigtEetInsertSource.ts',
  ],
  forbidden: (ref) => ref.moduleSpecifier.endsWith('stores/formPersistenceStore'),
  message: (ref) =>
    `Direkte import af formPersistenceStore (${ref.moduleSpecifier}) uden for kanoniske adgangspunkter.`,
  violatingFixtures: [
    { relativePath: 'src/foo.ts', code: "import { useStore } from '../../stores/formPersistenceStore';" },
    { relativePath: 'src/foo.ts', code: "import type { T } from '../../stores/formPersistenceStore';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/foo.ts', code: "import { x } from '../../stores/undoRedoStore';" },
    { relativePath: 'src/foo.ts', code: "import { x } from './formPersistenceStoreHelpers';" },
  ],
});

// --- Fail-open display-opslag må ikke koble til beregning ---------------------

const failOpenDisplayLookupImport = forbidImports({
  id: 'satser/fail-open-display-lookup-import',
  description:
    'Det fail-open getSatserForYear (lovbestemteRates) må kun importeres af display-/dokument-lag — aldrig en beregningssti.',
  allow: [
    // Den typed reader-projektion er display-/dokument-grænsen for Satser og kalder kun opslaget på ready-grenen.
    'src/domain/satser/satserProjection.ts',
    'src/document/generators/satser/satserDocument.ts',
    'src/document/service/documentService.ts',
  ],
  antiRot: true,
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
  allow: ['src/data/lovbestemteRates.ts', 'src/domain/satser/aslAarsloensmaksimum.ts'],
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
  // Alle domæne-filer uden for selve inspektionslaget kontrolleres (dækker eoRowEvaluation, canonicalOutput, controlMismatch m.fl.).
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/domain/') && !relativePath.startsWith(`${INSPEKTION_LAYER}/`),
  allow: [
    'src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts',
    'src/domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView.ts',
  ],
  antiRot: true,
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

const eetCrossDomainPersistedLookup = forbidCalls({
  id: 'domain/eet-cross-domain-persisted-lookup',
  description:
    'Ingen persisted tværside-opslag (getPersistedData/usePersistedSection/commitSection) ind i erhvervsevnetab-sektionen.',
  forbidden: (ref) =>
    (ref.calleeName === 'getPersistedData' ||
      ref.calleeName === 'usePersistedSection' ||
      ref.calleeName === 'commitSection') &&
    ref.firstArgStringLiteral === 'erhvervsevnetab',
  message: (ref) => `Persisted tværside-opslag ${ref.calleeText}('erhvervsevnetab') — forbudt cross-domain kobling.`,
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: "const d = getPersistedData('erhvervsevnetab');" },
    { relativePath: 'src/x.ts', code: "const s = usePersistedSection('erhvervsevnetab');" },
    { relativePath: 'src/x.ts', code: "commitSection('erhvervsevnetab', values);" },
  ],
  cleanFixtures: [
    { relativePath: 'src/x.ts', code: "const d = getPersistedData('erstatningsopgoerelse');" },
    { relativePath: 'src/x.ts', code: "const s = usePersistedForm('erhvervsevnetab');" },
    { relativePath: 'src/x.ts', code: "const v = sections.erhvervsevnetab;" },
  ],
});

// --- Pengeenhed: kun den kanoniske konstruktor må skabe MoneyOre -------------

const moneyOreTypeAssertion = forbidTypeAssertions({
  id: 'money/money-ore-type-assertion',
  description:
    'MoneyOre må ikke konstrueres med type-assertion; brug den validerede pengealgebra.',
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
 * De hooks/funktioner der giver en page-fil adgang til en persisteret sektion (læse
 * ELLER skrive). En sektions-key som string-literal-argument til ét af disse kald
 * betyder, at filen kobler til det domæne. Row-id/felt-navne er aldrig sektions-keys,
 * så et sektions-valued literal-argument er utvetydigt en sektionsadgang.
 */
const SECTION_ACCESS_HOOKS = new Set<string>([
  'usePersistedForm',
  'usePersistedSectionSelector',
  'usePersistedSection',
  'useFormFieldErrors',
  'useFormFieldErrorReporter',
  'useKeyedFieldErrorReporter',
  'useDynamicFormFieldErrorReporter',
  'useInvalidDraftForFieldSelector',
  'useInvalidDraftsForSectionSelector',
  'getPersistedSectionSnapshot',
  'getPersistedData',
  'getFieldErrorsBySourceSnapshot',
  'getSectionRevisionSnapshot',
  'getFieldErrorRevisionSnapshot',
  'useSectionRevisionSelector',
  'useFieldErrorRevisionSelector',
  'commitSection',
]);

const SECTION_KEY_SET = new Set<string>(PERSISTED_SECTION_KEYS);
const PAGES_ROOT = 'src/components/pages';

export type PageBoundaryRule = Readonly<{
  label: string;
  /** Repo-relativ rod (fil eller mappe) med `src/`-præfiks, matcher `SourceEntry.relativePath`. */
  root: string;
  allowedSections: readonly StorageKey[];
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

type SectionAccess = Readonly<{ section: StorageKey; position: Finding['position'] }>;

const collectSectionAccesses = (entry: SourceEntry): SectionAccess[] =>
  collectCalls(entry)
    .filter((ref) => SECTION_ACCESS_HOOKS.has(ref.calleeName))
    .flatMap((ref) =>
      ref.stringArgs
        .filter((arg): arg is StorageKey => SECTION_KEY_SET.has(arg))
        .map((section) => ({ section, position: ref.position }))
    );

const pageSectionAccessBoundary = defineRule({
  id: 'domain/page-section-access-boundary',
  description:
    'Enhver page-fil der tilgår en persisteret sektion skal ligge under en PAGE_BOUNDARY_RULE-rod (coverage) og må kun ramme rodens autoriserede sektioner (domain-boundary-contract §9/§10).',
  appliesTo: (relativePath) => relativePath.startsWith(`${PAGES_ROOT}/`),
  find: (entry) => {
    const accesses = collectSectionAccesses(entry);
    if (accesses.length === 0) return [];

    const boundary = boundaryRuleForPath(entry.relativePath);
    if (!boundary) {
      // Coverage-completeness: en page-fil med sektionsadgang uden en regel-rod er uovervåget.
      return accesses.map((access) => ({
        position: access.position,
        message: `Uovervåget page-fil med persisteret sektionsadgang (${access.section}) — tilføj en PAGE_BOUNDARY_RULE-rod.`,
      }));
    }

    return accesses
      .filter((access) => !boundary.allowedSections.includes(access.section))
      .map((access) => ({
        position: access.position,
        message: `${boundary.label}: adgang til ikke-autoriseret sektion '${access.section}'.`,
      }));
  },
  violatingFixtures: [
    // Under en rod, men uautoriseret sektion.
    { relativePath: 'src/components/pages/Aarsloen.tsx', code: "usePersistedForm('erhvervsevnetab');" },
    { relativePath: 'src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx', code: "getPersistedData('renteberegning');" },
    // Ingen rod (uovervåget) med sektionsadgang.
    { relativePath: 'src/components/pages/NyUovervaagetSide.tsx', code: "usePersistedSection('stamdata');" },
  ],
  cleanFixtures: [
    { relativePath: 'src/components/pages/Aarsloen.tsx', code: "usePersistedForm('aarsloen');" },
    { relativePath: 'src/components/pages/Erhvervsevnetab.tsx', code: "commitSection('erstatningsopgoerelse', values);" },
    // Sektionsfri page-fil er uinteressant, selv uden rod.
    { relativePath: 'src/components/pages/NyUovervaagetSide.tsx', code: "const x = useMemo(() => 1, []);" },
    // Ikke-sektions string-argument til et adgangs-hook flages ikke.
    { relativePath: 'src/components/pages/Aarsloen.tsx', code: "useFormFieldErrorReporter('aarsloen', 'etFeltNavn');" },
  ],
});

// --- Persisterede parse-felter skal rapportere deres afsluttede fejltilstand ---

const PARSE_CAPABLE_STYLED_FIELDS = new Set([
  'StyledAmountField',
  'StyledDateField',
  'StyledFractionField',
  'StyledIntegerField',
  'StyledPercentField',
  'StyledWeekField',
  'StyledYearField',
]);

const jsxAttribute = (
  node: ts.JsxOpeningLikeElement,
  name: string
): ts.JsxAttribute | undefined =>
  node.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property)
      && ts.isIdentifier(property.name)
      && property.name.text === name
  );

const isExplicitUndefinedJsxAttribute = (attribute: ts.JsxAttribute | undefined): boolean =>
  attribute?.initializer !== undefined
  && ts.isJsxExpression(attribute.initializer)
  && attribute.initializer.expression !== undefined
  && ts.isIdentifier(attribute.initializer.expression)
  && attribute.initializer.expression.text === 'undefined';

const persistedStyledFieldErrorReporter = defineRule({
  id: 'form/persisted-styled-field-error-reporter',
  description:
    'Parse-kompetente Styled-felter på produktionssider skal have onFieldError, medmindre feltet eksplicit er read-only via onCommit={undefined}.',
  appliesTo: (relativePath) =>
    relativePath.startsWith(`${PAGES_ROOT}/`)
    && relativePath.endsWith('.tsx')
    && !relativePath.endsWith('/StamdataTestTab.tsx'),
  find: (entry) => {
    const findings: Finding[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const componentName = node.tagName.getText(entry.ast);
        if (PARSE_CAPABLE_STYLED_FIELDS.has(componentName)) {
          const onCommit = jsxAttribute(node, 'onCommit');
          const onFieldError = jsxAttribute(node, 'onFieldError');
          if (!isExplicitUndefinedJsxAttribute(onCommit) && onFieldError === undefined) {
            const position = entry.ast.getLineAndCharacterOfPosition(node.getStart(entry.ast));
            findings.push({
              position: { line: position.line + 1, column: position.character + 1 },
              message: `${componentName} mangler onFieldError og kan derfor fejle åbent efter blur.`,
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(entry.ast);
    return findings;
  },
  violatingFixtures: [{
    relativePath: 'src/components/pages/X.tsx',
    code: '<StyledDateField name="dato" onCommit={handleCommit} />;',
  }],
  cleanFixtures: [
    {
      relativePath: 'src/components/pages/X.tsx',
      code: '<StyledDateField name="dato" onCommit={handleCommit} onFieldError={reportError} />;',
    },
    {
      relativePath: 'src/components/pages/X.tsx',
      code: '<StyledYearField name="aar" onCommit={undefined} />;',
    },
    {
      relativePath: 'src/components/pages/StamdataTestTab.tsx',
      code: '<StyledAmountField name="test" onCommit={handleCommit} />;',
    },
  ],
});

// --- PDF-download-filer må ikke læse committed EO/stamdata-state ---------------

const isDownloadTriggerCall = (calleeName: string): boolean =>
  /^download[A-Za-z]+(?:Pdf|Dokument)$/.test(calleeName);

const EO_PDF_DOWNLOAD_FUNCTIONS = new Set<string>([
  'downloadErstatningsopgoerelseDokument',
  'downloadTafFordeltPaaAarDokument',
  'downloadTafOpreguleretPaaAarDokument',
  'downloadTafKravGrafDokument',
]);

const PERSISTED_READ_CALLEES = new Set<string>(['usePersistedSection', 'getPersistedData']);

const pdfDownloadCommittedState = defineRule({
  id: 'pdf/download-committed-state',
  description:
    'En fil der udløser en PDF/dokument-download må ikke samtidig læse committed EO-state; EO-PDF-downloads må heller ikke læse committed stamdata (build-once/render-from-argument-invarianten).',
  find: (entry) => {
    const calls = collectCalls(entry);
    const hasDownloadTrigger = calls.some((ref) => isDownloadTriggerCall(ref.calleeName));
    const hasEoPdfDownload = calls.some((ref) => EO_PDF_DOWNLOAD_FUNCTIONS.has(ref.calleeName));
    if (!hasDownloadTrigger && !hasEoPdfDownload) return [];

    const findings: Finding[] = [];
    for (const ref of calls) {
      if (!PERSISTED_READ_CALLEES.has(ref.calleeName)) continue;
      const section = ref.firstArgStringLiteral;
      if (section === 'erstatningsopgoerelse' && (hasDownloadTrigger || hasEoPdfDownload)) {
        findings.push({ position: ref.position, message: `Committed EO-read (${ref.calleeText}('erstatningsopgoerelse')) i download-triggende fil.` });
      } else if (section === 'stamdata' && hasEoPdfDownload) {
        findings.push({ position: ref.position, message: `Committed stamdata-read (${ref.calleeText}('stamdata')) i EO-PDF-download-fil.` });
      }
    }
    return findings;
  },
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: "downloadSatserDokument(); usePersistedSection('erstatningsopgoerelse');" },
    { relativePath: 'src/x.ts', code: "downloadErstatningsopgoerelseDokument(); getPersistedData('stamdata');" },
  ],
  cleanFixtures: [
    // Download uden committed EO/stamdata-read.
    { relativePath: 'src/x.ts', code: "downloadSatserDokument(); usePersistedSection('renteberegning');" },
    // Stamdata-read med en ikke-EO download er tilladt.
    { relativePath: 'src/x.ts', code: "downloadSatserDokument(); getPersistedData('stamdata');" },
    // EO-read uden nogen download-trigger.
    { relativePath: 'src/x.ts', code: "usePersistedSection('erstatningsopgoerelse');" },
  ],
});

// --- MinProcesrente-standalone: ingen import af Mineos tværgående flows --------

const STANDALONE_SCOPE_PREFIXES = ['src/apps/minprocesrente/', 'src/components/pages/minprocesrente/'];
const STANDALONE_SCOPE_FILES = new Set<string>(['src/pdf/infrastructure/standaloneRentePdfService.ts']);

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
    { relativePath: 'src/pdf/infrastructure/standaloneRentePdfService.ts', code: "import { reportSystemIssue } from '../../utils/systemIssueReporter';" },
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
      current.name.text === 'values'
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

const COMMITTED_MIRROR_MARKERS = ['usePersistedSectionSelector', 'getPersistedSectionSnapshot', 'usePersistedForm'];

const findCommittedMirrorViolations = (entry: SourceEntry): Finding[] => {
  if (!entry.text.includes('useState')) return [];
  if (!COMMITTED_MIRROR_MARKERS.some((marker) => entry.text.includes(marker))) return [];

  const sourceFile = entry.ast;
  const trackedSectionVars = new Set<string>();
  const trackedValuesVars = new Set<string>();
  const trackedFormVars = new Set<string>();
  const localStateSetters = new Set<string>();

  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (
        ts.isCallExpression(node.initializer) &&
        (isNamedCall(node.initializer, 'usePersistedSectionSelector') ||
          isNamedCall(node.initializer, 'getPersistedSectionSnapshot'))
      ) {
        for (const identifier of collectBindingIdentifiers(node.name)) {
          trackedSectionVars.add(identifier);
        }
      }

      if (ts.isCallExpression(node.initializer) && isNamedCall(node.initializer, 'usePersistedForm')) {
        if (ts.isIdentifier(node.name)) trackedFormVars.add(node.name.text);
        if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            if (element.dotDotDotToken) continue;
            const propertyName = element.propertyName ?? element.name;
            if (ts.isIdentifier(propertyName) && propertyName.text === 'values') {
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
          if (ts.isIdentifier(propertyName) && propertyName.text === 'values') {
            trackedValuesVars.add(element.name.getText(sourceFile));
          }
        }
      }

      if (
        ts.isIdentifier(node.name) &&
        ts.isPropertyAccessExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        trackedFormVars.has(node.initializer.expression.text) &&
        node.initializer.name.text === 'values'
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
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/components/pages/') || relativePath.startsWith('src/hooks/'),
  find: findCommittedMirrorViolations,
  violatingFixtures: [
    {
      relativePath: 'src/hooks/useX.ts',
      code: "const s = usePersistedSectionSelector('stamdata'); const [local, setLocal] = useState(s);",
    },
    {
      relativePath: 'src/components/pages/X.tsx',
      code: "const { values } = usePersistedForm('stamdata'); const [l, setL] = useState(0); useEffect(() => { setL(values); }, [values]);",
    },
  ],
  cleanFixtures: [
    { relativePath: 'src/components/pages/X.tsx', code: "const s = usePersistedSectionSelector('stamdata'); const derived = useMemo(() => s.x, [s]);" },
    { relativePath: 'src/hooks/useX.ts', code: "const [l, setL] = useState(0); useEffect(() => { setL(1); }, []);" },
  ],
});

// --- Form-kontrakt: ingen microtask-/Promise-tick i commit-sensitiv kode -------

const COMMIT_SENSITIVE_PREFIXES = ['src/components/', 'src/hooks/', 'src/utils/', 'src/rowDrafts/', 'src/criticalActions/'];
const isCommitSensitive = (relativePath: string): boolean =>
  COMMIT_SENSITIVE_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const queueMicrotaskBoundary = forbidCalls({
  id: 'form/no-queue-microtask-in-commit-sensitive',
  description:
    'queueMicrotask er forbudt i commit-sensitiv kode (kan splitte en atomisk commit over to microtasks); kun auditerede infrastruktur-undtagelser.',
  appliesTo: isCommitSensitive,
  allow: ['src/components/tables/gridCore/tableKeyboardNavigation.ts'],
  antiRot: true,
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
  appliesTo: isCommitSensitive,
  allow: [],
  antiRot: true,
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
const isCriticalActionModule = (relativePath: string): boolean =>
  relativePath.startsWith('src/criticalActions/');

const criticalActionNoDomScanOrFrameWait = forbidCalls({
  id: 'criticalAction/no-dom-scan-or-frame-wait',
  description:
    'critical-action-barrieren må ikke DOM-scanne (querySelector*/getElementsBy*) eller vente på frames/timeouts (requestAnimationFrame/setTimeout/setInterval) — den afventer kun eksplicitte deltager-promises (kontrakt §2).',
  appliesTo: isCriticalActionModule,
  antiRot: true,
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
    { relativePath: 'src/criticalActions/x.ts', code: 'requestAnimationFrame(() => flush());' },
    { relativePath: 'src/criticalActions/x.ts', code: 'setTimeout(commit, 0);' },
    { relativePath: 'src/criticalActions/x.ts', code: 'const el = document.querySelector("[data-editor]");' },
  ],
  cleanFixtures: [
    { relativePath: 'src/criticalActions/x.ts', code: 'await participant.commit();' },
    { relativePath: 'src/criticalActions/x.ts', code: 'const el = document.activeElement;' },
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
  allow: ['src/domain/erstatningsopgoerelse/engines/tafNettoBeregning.ts'],
  antiRot: true,
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
  allow: ['src/domain/erstatningsopgoerelse/engines/sfggEngine.ts'],
  antiRot: true,
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
  allow: [
    'src/domain/erstatningsopgoerelse/engines/sfggAnsaettelsesforhold.ts',
    'src/domain/erstatningsopgoerelse/engines/sfggEngine.ts',
  ],
  antiRot: true,
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
  allow: [
    'src/domain/eoRowEvaluation/eoRowSygeferiegodtgoerelseRows.ts',
    'src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts',
  ],
  antiRot: true,
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

const documentGeneratorWriterImport = forbidImports({
  id: 'document/generator-writer-import-boundary',
  description: 'Dokumentgeneratorer må kun bygge DocumentModel og må ikke importere writer-targets, kanaler eller den imperative modelrenderer.',
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
  appliesTo: (relativePath) => relativePath.startsWith('src/document/generators/'),
  forbidden: (ref) => DOCUMENT_GENERATOR_CURSOR_MEMBERS.has(ref.chainText.split('.').at(-1) ?? ''),
  message: (ref) => `Imperativ dokumentadgang (${ref.chainText}) — brug en deklarativ DocumentBlock.`,
  violatingFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'const y = writer.getY();' }],
  cleanFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'document.addTable(spec);' }],
});

const documentGeneratorCursorElementAccess = forbidElementAccess({
  id: 'document/generator-cursor-element-access-boundary',
  description: 'Bracket-notation må ikke omgå dokumentgeneratorernes cursorgrænse.',
  appliesTo: (relativePath) => relativePath.startsWith('src/document/generators/'),
  forbidden: (ref) => Array.from(DOCUMENT_GENERATOR_CURSOR_MEMBERS).some((member) => ref.chainText.endsWith(`["${member}"]`) || ref.chainText.endsWith(`['${member}']`)),
  message: (ref) => `Imperativ dokumentadgang (${ref.chainText}) — brug en deklarativ DocumentBlock.`,
  violatingFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'writer["getDoc"]();' }],
  cleanFixtures: [{ relativePath: 'src/document/generators/x/xDocument.ts', code: 'const value = data["value"];' }],
});

export const ARCHITECTURE_RULES: readonly ArchitectureRule[] = [
  localStorageBoundary,
  sessionStorageBoundary,
  sessionStorageManifestKey,
  useFormPersistenceImport,
  formPersistenceContextImport,
  formPersistenceStoreImport,
  failOpenDisplayLookupImport,
  aslAarsloensmaksimumRawSubscript,
  inspektionLayerImport,
  eetCrossDomainPersistedLookup,
  moneyOreTypeAssertion,
  pageSectionAccessBoundary,
  persistedStyledFieldErrorReporter,
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
  documentGeneratorWriterImport,
  documentGeneratorCursorAccess,
  documentGeneratorCursorElementAccess,
];
