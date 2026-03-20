import React from 'react';
import { type z } from 'zod';
import { useFormPersistence } from '../contexts/useFormPersistence';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import type { CommitHandler } from '../types/fieldEvents';

/**
 * Return type for usePersistedForm hook
 */
export interface UsePersistedFormReturn<T> {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  handleChange: <K extends keyof T>(fieldName: K) => CommitHandler<T[K]>;
  resetForm: () => void;
  /**
   * Ændres kun ved "authoritative" value-replace events (fx reset/load/migration),
   * ikke ved normale felt-commits (som typisk bruger funktionel setState).
   */
  formVersion: number;
}

/**
 * Custom hook til formular-persistence med fuld type-sikkerhed
 *
 * Automatisk persistence af formular state til sessionStorage.
 * Data gemmes når felter ændres og genindlæses når siden åbnes igen.
 *
 * Features:
 * - Type-safe storage keys
 * - Automatisk versionering via FormPersistenceContext
 * - Zod-baseret serialization/deserialization
 * - Defensiv merge: Nye felter får altid fallback-værdier fra initialValues
 * - Type-sikker håndtering af numbers, booleans, ISO dates
 *
 * VIGTIGT: Kræver Zod schema for runtime type-validation.
 *
 * Type-håndtering:
 * - String felter: Håndteres som strings
 * - Number felter: Konverteres fra display-strings til numbers ved blur
 * - Boolean felter: Native boolean values
 * - Dato felter: Gemmes som ISO-strings (åååå-mm-dd), vises som dd-mm-åååå
 *
 * Eksempel:
 * ```typescript
 * const { values, handleChange, resetForm } = usePersistedForm(
 *   stamdataSchema,
 *   'stamdata',
 *   {
 *     journalnr: '',
 *     skadesdato: undefined,
 *   }
 * );
 * ```
 */
export const usePersistedForm = <K extends StorageKey>(
  schema: z.ZodType<PersistedSectionMap[K]>,
  pageKey: K,
  initialValues: PersistedSectionMap[K]
): UsePersistedFormReturn<PersistedSectionMap[K]> => {
  const { getPersistedData, persistData, clearPageData, clearFieldErrors, authoritativeSnapshotEpoch } = useFormPersistence();
  const initialValuesRef = React.useRef(initialValues);
  const getPersistedDataRef = React.useRef(getPersistedData);
  const persistDataRef = React.useRef(persistData);
  const clearPageDataRef = React.useRef(clearPageData);
  const clearFieldErrorsRef = React.useRef(clearFieldErrors);
  React.useEffect(() => {
    initialValuesRef.current = initialValues;
  }, [initialValues]);
  React.useEffect(() => {
    getPersistedDataRef.current = getPersistedData;
    persistDataRef.current = persistData;
    clearPageDataRef.current = clearPageData;
    clearFieldErrorsRef.current = clearFieldErrors;
  }, [clearFieldErrors, clearPageData, getPersistedData, persistData]);

  const parsePersisted = React.useCallback((persisted: unknown): PersistedSectionMap[K] | null => {
    const parsed = schema.safeParse(persisted);
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  }, [schema]);

  // Defensiv merge med Zod validation
  const [values, setValuesState] = React.useState<PersistedSectionMap[K]>(() => {
    const persistedRaw = getPersistedData(pageKey);

    if (!persistedRaw) {
      return initialValues;
    }

    const persisted = parsePersisted(persistedRaw);
    if (!persisted) return initialValues;

    return { ...initialValues, ...persisted };
  });

  const [formVersion, bumpFormVersion] = React.useReducer((v: number) => v + 1, 0);

  // Re-hydrate when an authoritative snapshot has been applied (e.g. file load).
  React.useEffect(() => {
    const persistedRaw = getPersistedDataRef.current(pageKey);

    try {
      bumpFormVersion();
      clearFieldErrorsRef.current(pageKey);
      if (!persistedRaw) {
        setValuesState(initialValuesRef.current);
      } else {
        const persisted = parsePersisted(persistedRaw);
        setValuesState(persisted ? { ...initialValuesRef.current, ...persisted } : initialValuesRef.current);
      }
    } catch {
      bumpFormVersion();
      clearFieldErrorsRef.current(pageKey);
      setValuesState(initialValuesRef.current);
    }
  }, [authoritativeSnapshotEpoch, pageKey, parsePersisted]);

  const setValues: React.Dispatch<React.SetStateAction<PersistedSectionMap[K]>> = React.useCallback(
    (updater) => {
      if (typeof updater === 'function') {
        setValuesState((prev) => {
          const fn = updater as (prevValues: PersistedSectionMap[K]) => PersistedSectionMap[K];
          return fn(prev);
        });
        return;
      }

      bumpFormVersion();
      clearFieldErrorsRef.current(pageKey);
      setValuesState(updater);
    },
    [pageKey]
  );

  // Persist ved hver ændring (schema-valideres i persistence-laget)
  React.useEffect(() => {
    persistDataRef.current(pageKey, values);
  }, [pageKey, values]);

  /**
   * Håndterer feltændringer med type-aware konvertering
   *
   * Input-komponenter emitter Mineo commit-events via event.target.value.
   * Denne handler accepterer det og lader komponenterne selv håndtere
   * konvertering til korrekt type (number, boolean, ISO-date).
   */
  const handleChange = React.useCallback(
    <FieldKey extends keyof PersistedSectionMap[K]>(fieldName: FieldKey): CommitHandler<PersistedSectionMap[K][FieldKey]> =>
      (event) => {
        const value = event.target.value;
        setValues(prev => ({ ...prev, [fieldName]: value }));
      },
    [setValues]
  );

  /**
   * Nulstiller formular til initialValues OG sletter gemt data fra storage.
   * Dette er en destruktiv operation - data kan ikke gendannes.
   */
  const resetForm = React.useCallback(() => {
    setValues(initialValuesRef.current);
    clearPageDataRef.current(pageKey);
    clearFieldErrorsRef.current(pageKey);
  }, [pageKey, setValues]);

  return {
    values,
    setValues,
    handleChange,
    resetForm,
    formVersion,
  };
};

export default usePersistedForm;
