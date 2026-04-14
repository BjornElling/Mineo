// .shared.ts: context-definition og types uden implementering.
// Adskilt fra .tsx for at tillade import fra test og domænelag uden React-komponent-afhængigheder.
import React from 'react';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import type {
  FieldErrorsForSection,
  FormFieldError,
  FieldErrorSeverity,
  FieldErrorSource,
} from '../types/fieldErrors';

export type ReplaceAllPersistedData = (snapshot: Record<StorageKey, unknown | undefined>) => void;

export type FormPersistenceContextValue = {
  // Imperative snapshot-read af committed sektion.
  // Reaktive UI-callsites skal som udgangspunkt bruge selector-hooks i stedet.
  getPersistedData: <K extends StorageKey>(pageKey: K) => PersistedSectionMap[K] | null;
  // Autoritativ commit af én sektion. Returnerer false hvis persistence afvises eller fejler.
  persistData: <K extends StorageKey>(pageKey: K, data: PersistedSectionMap[K]) => boolean;
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
    error: { message: string; severity: FieldErrorSeverity; blocksSave?: boolean } | null
  ) => void;
  clearFieldErrors: (pageKey: StorageKey) => void;
  clearAllFieldErrors: () => void;
  getSectionRevision: (pageKey: StorageKey) => number;
  getFieldErrorRevision: (pageKey: StorageKey) => number;
  replaceAllPersistedData: ReplaceAllPersistedData;
  lastNotice: { message: string; type: 'warning' | 'error' } | null;
  lastNoticeEpoch: number;
};

export const FormPersistenceContext = React.createContext<FormPersistenceContextValue | null>(null);
