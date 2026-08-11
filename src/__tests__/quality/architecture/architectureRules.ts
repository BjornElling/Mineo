import type { ArchitectureRule } from './ruleKit';
import {
  caseResetPolicyOwnership,
  defaultDirectoryNameSingleSource,
  deletedLegacyInputArchitectureImport,
  localStorageBoundary,
  noFullPageReloadInShell,
  sessionStorageBoundary,
  sessionStorageManifestKey,
} from './rules/storageRules';
import {
  aslAarsloensmaksimumRawSubscript,
  calculationDataCatalogLazyBoundary,
  crossDomainDescriptorPort,
  engineCallOwnedByProjectionRule,
  failOpenDisplayLookupImport,
  inspektionLayerImport,
  moneyOreTypeAssertion,
  pageSectionAccessBoundary,
  seriesCoverageEndpointsViaPrimitive,
} from './rules/domainRules';
import {
  documentActivationShowsOutcome,
  documentHeaderlessPseudoTableRule,
  minprocesrenteStandaloneImport,
  pdfDownloadCommittedState,
} from './rules/documentRules';
import {
  criticalActionNoDomScanOrFrameWait,
  deletableCollectionTableOwnershipRule,
  rowDeleteLaneCellRule,
  choiceFieldValueTypeInferredRule,
  documentGeneratorCursorAccess,
  documentGeneratorCursorElementAccess,
  documentGeneratorImportBoundary,
  documentGeneratorWriterImport,
  documentLifecycleBypass,
  eetDifferencekravCompositionBoundary,
  eoFieldVisibilitySingleSource,
  persistenceCommittedMirror,
  contextualFieldLabelSingleAuthorityRule,
  focusDestinationOwnedByLocationRule,
  restoreAttributesCarryDestinationRule,
  persistedPageHasViewModelRule,
  singleFieldIdentityInDomRule,
  persistedControlsUseFieldFamilyRule,
  standardLoenColumnLabelsSingleSourceRule,
  testStoreHydrationActBoundaryRule,
  popupSemanticsSingleSourceRule,
  messageBoxGuardedByPageMessageRule,
  placeholderIdentityOwnershipRule,
  promiseTickBoundary,
  queueMicrotaskBoundary,
  reguleringCanonicalForloebBoundary,
  restoreTargetAttributesRule,
  rowCommandDestinationRule,
  sfggAnsaettelsesforholdImportBoundary,
  sfggEngineImportBoundary,
  sfggSegmenteringImportBoundary,
  sfggWarningsImportBoundary,
} from './rules/formRules';
import {
  cellBindingSingleSource,
  eoSurfaceOnAuthoritativeEditorPath,
  fieldSignPolicyFromDescriptor,
  forbiddenLegacyIdentifier,
  inputWriteBoundary,
  derivedValuesNotWrittenFromEffects,
  issueSnapshotCapabilityBoundary,
  rawSectionAccessBoundary,
  internalRuntimeCapabilityBoundary,
  programmaticFieldCommitUsesSettle,
  sourceSettingsProjectionBoundary,
  transientCannotWriteCaseData,
} from './rules/inputBoundaryRules';
import { DATE_RULES } from './rules/dateRules';
import { NUMERIC_RULES } from './rules/numericRules';
import { RESPONSIVE_STYLING_RULES } from './rules/responsiveStylingRules';
import { FOCUS_NAVIGATION_RULES } from './rules/focusNavigationRules';
import { ACCESSIBILITY_RULES } from './rules/accessibilityRules';
import { TABLE_ORDER_RULES } from './rules/tableOrderRules';

/**
 * Registry for de AST-baserede arkitekturgrænser.
 *
 * Reglerne selv bor i `rules/`, opdelt efter KONCERN — storage, domæne, dokument, form og
 * inputgrænser. Denne fil samler dem til den ene liste, `architectureRules.test.ts` kører:
 * nul overtrædelser i kilde-grafen, ingen inert regel (fixtures + dødt-værn-detektoren) og
 * generisk anti-rot på hver allowlist.
 *
 * **Hvorfor opdelt pr. koncern:** som én fil voksede manifestet til godt 2.000 linjer, hvor storage-,
 * input-, domæne-, UI- og dokumentregler lå mellem hinanden. Det gør filen hverken læsbar som helhed
 * eller navigerbar pr. koncern, og to naboregler kan have intet med hinanden at gøre. Opdelingen
 * flytter kun regler, den ændrer ingen — og registryet nedenfor er fortsat ét sted at se dem alle.
 *
 * Grænserne måles som AST og ikke med directory-walk + regex/substring-scannere: en tekstscanner har
 * silent-pass-huller ved aliasing, destrukturering og bracket-notation, som AST'en lukker strukturelt.
 */
export const ARCHITECTURE_RULES: readonly ArchitectureRule[] = [
  // Dato- og numeriske kildeinvarianter
  ...DATE_RULES,
  ...NUMERIC_RULES,
  // Storage og persistens
  localStorageBoundary,
  sessionStorageBoundary,
  sessionStorageManifestKey,
  caseResetPolicyOwnership,
  noFullPageReloadInShell,
  defaultDirectoryNameSingleSource,
  deletedLegacyInputArchitectureImport,
  // Domæne- og laggrænser
  failOpenDisplayLookupImport,
  aslAarsloensmaksimumRawSubscript,
  inspektionLayerImport,
  moneyOreTypeAssertion,
  pageSectionAccessBoundary,
  crossDomainDescriptorPort,
  calculationDataCatalogLazyBoundary,
  seriesCoverageEndpointsViaPrimitive,
  // Dokument og standalone
  pdfDownloadCommittedState,
  documentActivationShowsOutcome,
  documentHeaderlessPseudoTableRule,
  minprocesrenteStandaloneImport,
  // Shell og desktop-only-grænse
  ...RESPONSIVE_STYLING_RULES,
  ...FOCUS_NAVIGATION_RULES,
  // Tilgængeligt navn på interaktive kontroller
  ...ACCESSIBILITY_RULES,
  // Form, felt og critical action
  persistenceCommittedMirror,
  queueMicrotaskBoundary,
  promiseTickBoundary,
  criticalActionNoDomScanOrFrameWait,
  engineCallOwnedByProjectionRule,
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
  contextualFieldLabelSingleAuthorityRule,
  focusDestinationOwnedByLocationRule,
  restoreAttributesCarryDestinationRule,
  persistedPageHasViewModelRule,
  singleFieldIdentityInDomRule,
  persistedControlsUseFieldFamilyRule,
  standardLoenColumnLabelsSingleSourceRule,
  testStoreHydrationActBoundaryRule,
  popupSemanticsSingleSourceRule,
  messageBoxGuardedByPageMessageRule,
  deletableCollectionTableOwnershipRule,
  rowDeleteLaneCellRule,
  choiceFieldValueTypeInferredRule,
  ...TABLE_ORDER_RULES,
  placeholderIdentityOwnershipRule,
  // Inputgrænser og legacy-fravær
  inputWriteBoundary,
  cellBindingSingleSource,
  eoSurfaceOnAuthoritativeEditorPath,
  fieldSignPolicyFromDescriptor,
  programmaticFieldCommitUsesSettle,
  derivedValuesNotWrittenFromEffects,
  issueSnapshotCapabilityBoundary,
  rawSectionAccessBoundary,
  internalRuntimeCapabilityBoundary,
  sourceSettingsProjectionBoundary,
  transientCannotWriteCaseData,
  forbiddenLegacyIdentifier,
];

// De data-eksporter, andre quality-tests bruger til completeness-/fraværskontroller. De bor sammen
// med deres regel; manifestet videregiver dem, så consumers har én importsti at kende.
export {
  LEGACY_MODULE_PATH_SELFTEST,
} from './rules/storageRules';
export {
  CATALOG_DIR,
  DESCRIPTOR_CATALOG_MODULE_NAMES,
  NON_DOMAIN_CATALOG_MODULES,
  PAGE_BOUNDARY_RULES,
  type PageBoundaryRule,
} from './rules/domainRules';
