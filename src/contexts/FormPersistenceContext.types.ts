import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import type {
  FieldErrorsForSection,
  FormFieldError,
  FieldErrorSeverity,
  FieldErrorSource,
} from '../types/fieldErrors';

export type FormPersistenceContextValue = {
  getPersistedData: <K extends StorageKey>(pageKey: K) => PersistedSectionMap[K] | null;
  persistData: <K extends StorageKey>(pageKey: K, data: PersistedSectionMap[K]) => void;
  clearPageData: (pageKey: StorageKey) => void;
  clearAllData: () => void;
  hasAnyData: () => boolean;
  getFieldErrors: <K extends StorageKey>(
    pageKey: K
  ) => Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>>;
  getFieldErrorsBySource: <K extends StorageKey>(pageKey: K) => FieldErrorsForSection<K>;
  getFieldError: <K extends StorageKey>(
    pageKey: K,
    fieldName: Extract<keyof PersistedSectionMap[K], string>
  ) => FormFieldError | undefined;
  setFieldError: <K extends StorageKey>(
    pageKey: K,
    fieldName: Extract<keyof PersistedSectionMap[K], string>,
    source: FieldErrorSource,
    error: { message: string; severity: FieldErrorSeverity } | null
  ) => void;
  clearFieldErrors: (pageKey: StorageKey) => void;
  clearAllFieldErrors: () => void;
  getLoenindkomstManuelReguleringInputErrors: () => Readonly<Record<string, true>>;
  setLoenindkomstManuelReguleringInputError: (ansaettelsesforholdId: string, hasError: boolean) => void;
  clearLoenindkomstManuelReguleringInputErrors: () => void;
  authoritativeSnapshotEpoch: number;
  getSectionRevision: (pageKey: StorageKey) => number;
  getFieldErrorRevision: (pageKey: StorageKey) => number;
  replaceAllPersistedData: (snapshot: Record<StorageKey, unknown | undefined>) => void;
  lastNotice: { message: string; type: 'warning' | 'error' } | null;
  lastNoticeEpoch: number;
};
