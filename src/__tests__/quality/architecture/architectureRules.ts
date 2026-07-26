import type { ArchitectureRule } from './ruleKit';
import {
  deletedLegacyInputArchitectureImport,
  localStorageBoundary,
  sessionStorageBoundary,
  sessionStorageManifestKey,
} from './rules/storageRules';
import {
  aslAarsloensmaksimumRawSubscript,
  crossDomainDescriptorPort,
  failOpenDisplayLookupImport,
  inspektionLayerImport,
  moneyOreTypeAssertion,
  pageSectionAccessBoundary,
} from './rules/domainRules';
import {
  minprocesrenteStandaloneImport,
  pdfDownloadCommittedState,
} from './rules/documentRules';
import {
  criticalActionNoDomScanOrFrameWait,
  documentGeneratorCursorAccess,
  documentGeneratorCursorElementAccess,
  documentGeneratorImportBoundary,
  documentGeneratorWriterImport,
  documentLifecycleBypass,
  eetDifferencekravCompositionBoundary,
  eoFieldVisibilitySingleSource,
  persistenceCommittedMirror,
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
  forbiddenLegacyIdentifier,
  inputWriteBoundary,
  rawSectionAccessBoundary,
  internalRuntimeCapabilityBoundary,
  transientCannotWriteCaseData,
} from './rules/inputBoundaryRules';

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
  // Storage og persistens
  localStorageBoundary,
  sessionStorageBoundary,
  sessionStorageManifestKey,
  deletedLegacyInputArchitectureImport,
  // Domæne- og laggrænser
  failOpenDisplayLookupImport,
  aslAarsloensmaksimumRawSubscript,
  inspektionLayerImport,
  moneyOreTypeAssertion,
  pageSectionAccessBoundary,
  crossDomainDescriptorPort,
  // Dokument og standalone
  pdfDownloadCommittedState,
  minprocesrenteStandaloneImport,
  // Form, felt og critical action
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
  // Inputgrænser og legacy-fravær
  inputWriteBoundary,
  rawSectionAccessBoundary,
  internalRuntimeCapabilityBoundary,
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
