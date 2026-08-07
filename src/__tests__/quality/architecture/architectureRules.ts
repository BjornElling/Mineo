import type { ArchitectureRule } from './ruleKit';
import {
  caseResetPolicyOwnership,
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
  documentGeneratorCursorAccess,
  documentGeneratorCursorElementAccess,
  documentGeneratorImportBoundary,
  documentGeneratorWriterImport,
  documentLifecycleBypass,
  eetDifferencekravCompositionBoundary,
  eoFieldVisibilitySingleSource,
  persistenceCommittedMirror,
  focusDestinationOwnedByLocationRule,
  restoreAttributesCarryDestinationRule,
  persistedPageHasViewModelRule,
  singleFieldIdentityInDomRule,
  persistedControlsUseFieldFamilyRule,
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

/**
 * Registry for de AST-baserede arkitekturgrænser (greenfield #48).
 *
 * Reglerne selv bor i `rules/`, opdelt efter KONCERN — storage, domæne, dokument, form og
 * inputgrænser. Denne fil samler dem til den ene liste, `architectureRules.test.ts` kører:
 * nul overtrædelser i kilde-grafen, ingen inert regel (fixtures + dødt-værn-detektoren) og
 * generisk anti-rot på hver allowlist.
 *
 * **Hvorfor opdelt (Fase 6, genåbnet):** manifestet var vokset til 2.133 linjer med storage-,
 * input-, domæne-, UI- og dokumentregler i samme fil. Filen var dermed hverken læsbar som helhed
 * eller navigerbar pr. koncern, og to naboregler kunne have intet med hinanden at gøre. Opdelingen
 * ændrer INGEN regel — kun hvor den bor — og registryet nedenfor er fortsat ét sted at se dem alle.
 *
 * Reglerne erstatter de tidligere håndrullede directory-walk + regex/substring-scannere, hvis egne
 * kommentarer indrømmede silent-pass-huller (aliasing, destrukturering, bracket-notation) — huller
 * AST'en lukker strukturelt.
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
  deletedLegacyInputArchitectureImport,
  // Domæne- og laggrænser
  failOpenDisplayLookupImport,
  aslAarsloensmaksimumRawSubscript,
  inspektionLayerImport,
  moneyOreTypeAssertion,
  pageSectionAccessBoundary,
  crossDomainDescriptorPort,
  calculationDataCatalogLazyBoundary,
  // Dokument og standalone
  pdfDownloadCommittedState,
  documentActivationShowsOutcome,
  documentHeaderlessPseudoTableRule,
  minprocesrenteStandaloneImport,
  // Shell og desktop-only-grænse
  ...RESPONSIVE_STYLING_RULES,
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
  focusDestinationOwnedByLocationRule,
  restoreAttributesCarryDestinationRule,
  persistedPageHasViewModelRule,
  singleFieldIdentityInDomRule,
  persistedControlsUseFieldFamilyRule,
  popupSemanticsSingleSourceRule,
  messageBoxGuardedByPageMessageRule,
  deletableCollectionTableOwnershipRule,
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
