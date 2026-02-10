import React from 'react';
import { type z } from 'zod';
import { useFormPersistence } from '../contexts/FormPersistenceContext';
import type { FormFieldChangeEvent } from '../types/common';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';

/**
 * Return type for usePersistedForm hook
 */
export interface UsePersistedFormReturn<T> {
  values: T;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  handleChange: (fieldName: keyof T) => (event: FormFieldChangeEvent) => void;
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
  _schema: z.ZodType<PersistedSectionMap[K]>,
  pageKey: K,
  initialValues: PersistedSectionMap[K]
): UsePersistedFormReturn<PersistedSectionMap[K]> => {
  const { getPersistedData, persistData, clearPageData, clearFieldErrors, authoritativeSnapshotEpoch } = useFormPersistence();

  const parsePersisted = React.useCallback((persisted: unknown): PersistedSectionMap[K] | null => {
    const parsed = _schema.safeParse(persisted);
    if (!parsed.success) {
      console.warn(`[usePersistedForm] Ugyldig persisted data for '${pageKey}', bruger initialValues.`, parsed.error);
      return null;
    }
    return parsed.data;
  }, [_schema, pageKey]);

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
    const persistedRaw = getPersistedData(pageKey);

    try {
      bumpFormVersion();
      clearFieldErrors(pageKey);
      if (!persistedRaw) {
        setValuesState(initialValues);
      } else {
        const persisted = parsePersisted(persistedRaw);
        setValuesState(persisted ? { ...initialValues, ...persisted } : initialValues);
      }
    } catch (error) {
      console.warn(`[usePersistedForm] Re-hydration fejl for '${pageKey}':`, error);
      bumpFormVersion();
      clearFieldErrors(pageKey);
      setValuesState(initialValues);
    }
  }, [authoritativeSnapshotEpoch, clearFieldErrors, getPersistedData, initialValues, pageKey, parsePersisted]);

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
      clearFieldErrors(pageKey);
      setValuesState(updater);
    },
    [clearFieldErrors, pageKey]
  );

  // Persist ved hver ændring (schema-valideres i persistence-laget)
  React.useEffect(() => {
    persistData(pageKey, values);
  }, [values, pageKey, persistData]);

  /**
   * Håndterer feltændringer med type-aware konvertering
   *
   * Input-komponenter emitter typed values via event.target.value.
   * Denne handler accepterer det og lader komponenterne selv håndtere
   * konvertering til korrekt type (number, boolean, ISO-date).
   */
  const handleChange = React.useCallback((fieldName: keyof PersistedSectionMap[K]) => (event: FormFieldChangeEvent) => {
    const value = event?.target?.value;
    setValues(prev => ({ ...prev, [fieldName]: value }));
  }, [setValues]);

  /**
   * Nulstiller formular til initialValues OG sletter gemt data fra storage.
   * Dette er en destruktiv operation - data kan ikke gendannes.
   */
  const resetForm = React.useCallback(() => {
    setValues(initialValues);
    clearPageData(pageKey);
    clearFieldErrors(pageKey);
  }, [clearPageData, clearFieldErrors, initialValues, pageKey, setValues]);

  return {
    values,
    setValues,
    handleChange,
    resetForm,
    formVersion,
  };
};

export default usePersistedForm;
