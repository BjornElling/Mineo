/**
 * Fase-3-kompatibilitetsindgang. Den autoritative store bor i `inputRuntimeStore`; dette modul
 * bevarer importstien for de endnu ikke migrerede read-/fejl-callsites og slettes i fase 4–5.
 */
export {
  assignFormPersistenceSection,
  createEmptyFormPersistenceSections,
  createEmptyInvalidDraftsCache,
  inputRuntimeStore as formPersistenceStore,
  __createInputRuntimeTestStore as __createTestStore,
} from './inputRuntimeStore';

export type {
  FieldErrorCache,
  FieldErrorRevisionMap,
  FormPersistenceMeta,
  FormPersistenceSections,
  InvalidDraftRevisionMap,
  InvalidDraftsCache,
  InvalidDraftsForSection,
  SectionKeyedRevisions,
  SectionRevisionMap,
} from './inputRuntimeStore';
