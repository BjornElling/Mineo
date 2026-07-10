import { isValidStorageKey } from '../../../config/storageManifest';
import { resolveRelativeImport } from './astQueries';
import {
  forbidCalls,
  forbidElementAccess,
  forbidImports,
  forbidMemberAccess,
  type ArchitectureRule,
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
  allow: [
    'src/components/layout/MainLayout.tsx',
    'src/hooks/useFormFieldErrors.ts',
    'src/hooks/usePersistedForm.ts',
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
  allow: [
    'src/App.tsx',
    'src/apps/minprocesrente/MinProcesrenteApp.tsx',
    'src/contexts/FormPersistenceContext.tsx',
    'src/contexts/FormPersistenceContext.internal.ts',
    'src/contexts/FormPersistenceContext.shared.ts',
    'src/contexts/useFormPersistence.ts',
    'src/hooks/useFileSaveLoad.ts',
    'src/utils/persistenceLoadApply.ts',
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
    'src/contexts/FormPersistenceContext.tsx',
    'src/hooks/useFormPersistenceSelectors.ts',
    'src/hooks/useUndoRedo.ts',
    // Domæne-specifik read model: abonnerer direkte på storen for ét cachet tværsektion-snapshot.
    'src/hooks/useMidlertidigtEetInsertSource.ts',
    'src/stores/undoRedoStore.ts',
    'src/utils/persistenceSnapshotStorage.ts',
    // Type-only import af InvalidDraftsCache (slice-typen bor i storen).
    'src/utils/invalidDraftsStorage.ts',
    'src/utils/persistenceSessionHydration.ts',
    // Fælles capture/restore af committed-tier runtime-state (delt af alle atomiske skrive-/restore-flows).
    'src/utils/persistenceStoreRollback.ts',
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
    'src/components/pages/Satser.tsx',
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
];
