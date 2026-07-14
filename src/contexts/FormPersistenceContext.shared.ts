// .shared.ts: offentlige persistence-typer uden context-implementering.
// React-context-objektet ligger i FormPersistenceContext.internal.ts for at holde denne fil type-only.
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap, PersistedSectionsSnapshot } from '../config/persistenceRegistry';
import type {
  FieldErrorsForSection,
  FormFieldError,
  FieldErrorSeverity,
  FieldErrorSource,
} from '../types/fieldErrors';
import type { HistoryFrameOrigin } from '../stores/inputRuntimeStore';
import type { InvalidDraftClear } from '../types/invalidDrafts';

export type ReplaceAllPersistedData = (snapshot: PersistedSectionsSnapshot) => void;

export type FormPersistenceContextValue = {
  // Imperative snapshot-read af committed sektion.
  // Reaktive UI-callsites skal som udgangspunkt bruge selector-hooks i stedet.
  getPersistedData: <K extends StorageKey>(pageKey: K) => PersistedSectionMap[K] | null;
  // Autoritativ commit af én sektion. Returnerer false hvis persistence afvises eller fejler.
  // `clearInvalidDraft(s)` (valgfri): ryd et eller flere `invalidDrafts`-entries ATOMISK i samme
  // finalize-transaktion (greenfield draft/commit §4.4) — ét undo-frame, én revisionsprogression.
  // Storage-fieldPath, ikke undo-DOM-path.
  persistData: <K extends StorageKey>(
    pageKey: K,
    data: PersistedSectionMap[K],
    options?: {
      undoOrigin?: HistoryFrameOrigin;
      clearInvalidDraft?: InvalidDraftClear;
      clearInvalidDrafts?: readonly InvalidDraftClear[];
    }
  ) => boolean;
  clearPageData: (pageKey: StorageKey, options?: { undoOrigin?: HistoryFrameOrigin }) => boolean;
  clearAllData: () => void;
  hasAnyData: () => boolean;
  getFieldErrors: <K extends StorageKey>(
    pageKey: K
  ) => Partial<Record<string, FormFieldError>>;
  // Snapshot-/selector-API'er nedenfor findes primært for tests, devtools og imperative reads.
  // Nye reaktive callsites skal som udgangspunkt bruge store-selectors i hooks-laget.
  getFieldErrorsBySource: <K extends StorageKey>(pageKey: K) => FieldErrorsForSection<K>;
  getFieldError: <K extends StorageKey>(
    pageKey: K,
    fieldName: string
  ) => FormFieldError | undefined;
  setFieldError: <K extends StorageKey>(
    pageKey: K,
    fieldName: string,
    source: FieldErrorSource,
    error: { message: string; severity: FieldErrorSeverity; blocksSave?: boolean } | null
  ) => void;
  clearFieldErrors: (pageKey: StorageKey) => void;
  clearAllFieldErrors: () => void;
  // `invalidDrafts`-recovery-kanal (afsluttet ugyldigt input, jf. form-contract.md §2.4 / persistence-contract.md §11).
  // commitInvalidDraft skrives ved fejlende commit; clearInvalidDraft ved rydning. Begge tager undoOrigin
  // (opretter en undo-frame, når ændringen ikke er en no-op), så både ugyldigt input og rydning kan undo'es.
  commitInvalidDraft: (pageKey: StorageKey, fieldPath: string, rawDraft: string, options?: { undoOrigin?: HistoryFrameOrigin }) => boolean;
  clearInvalidDraft: (pageKey: StorageKey, fieldPath: string, options?: { undoOrigin?: HistoryFrameOrigin }) => boolean;
  getInvalidDraft: (pageKey: StorageKey, fieldPath: string) => string | undefined;
  getInvalidDraftsForSection: (pageKey: StorageKey) => Record<string, string>;
  // Ryd forældreløse celle-`invalidDrafts` i én sektion atomisk (storage + store, fail-closed rollback).
  // `isOrphan` afgør pr. fieldPath om nøglen skal fjernes (typisk: hører til et slettet rækkescope og
  // peger på en række/scope der ikke længere lever). Fanger BEVIDST ingen undo-frame (housekeeping).
  // Returnerer false ved intern fejl. No-op (returnerer true) når ingen nøgler matcher.
  reconcileInvalidDrafts: (pageKey: StorageKey, isOrphan: (fieldPath: string) => boolean) => boolean;
  getSectionRevision: (pageKey: StorageKey) => number;
  getFieldErrorRevision: (pageKey: StorageKey) => number;
  replaceAllPersistedData: ReplaceAllPersistedData;
  lastNotice: { message: string; type: 'warning' | 'error' } | null;
  lastNoticeEpoch: number;
};
