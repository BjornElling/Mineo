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
import type { HistoryFrameOrigin } from '../stores/undoRedoStore';

export type ReplaceAllPersistedData = (snapshot: PersistedSectionsSnapshot) => void;

export type FormPersistenceContextValue = {
  // Imperative snapshot-read af committed sektion.
  // Reaktive UI-callsites skal som udgangspunkt bruge selector-hooks i stedet.
  getPersistedData: <K extends StorageKey>(pageKey: K) => PersistedSectionMap[K] | null;
  // Autoritativ commit af én sektion. Returnerer false hvis persistence afvises eller fejler.
  persistData: <K extends StorageKey>(pageKey: K, data: PersistedSectionMap[K], options?: { undoOrigin?: HistoryFrameOrigin }) => boolean;
  clearPageData: (pageKey: StorageKey) => void;
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
    error: { message: string; severity: FieldErrorSeverity; blocksSave?: boolean; invalidDraft?: string } | null
  ) => void;
  clearFieldErrors: (pageKey: StorageKey) => void;
  clearAllFieldErrors: () => void;
  getSectionRevision: (pageKey: StorageKey) => number;
  getFieldErrorRevision: (pageKey: StorageKey) => number;
  replaceAllPersistedData: ReplaceAllPersistedData;
  lastNotice: { message: string; type: 'warning' | 'error' } | null;
  lastNoticeEpoch: number;
};
