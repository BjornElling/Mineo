import React from 'react';
import { type z } from 'zod';
import { useFormPersistence } from '../contexts/useFormPersistence';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import {
  getPersistedSectionSnapshot,
  useAuthoritativeSnapshotEpochSelector,
  usePersistenceHydratedSelector,
  usePersistedSectionSelector,
} from './useFormPersistenceSelectors';

/**
 * Signatur for setValues: funktionel updater-baseret felt-commit.
 * Se UsePersistedFormReturn for fuld dokumentation.
 */
export type SetValuesUpdater<T> = (updater: (prev: T) => T) => void;
export type ReplaceValuesSetter<T> = (next: T) => void;
export type SetFieldValue<T> = <K extends keyof T>(fieldName: K, value: T[K]) => void;

/**
 * Return type for usePersistedForm hook
 */
export interface UsePersistedFormReturn<T> {
  values: T;
  /**
   * Felt-commit via funktionel updater (prev => next). Bumper ikke formVersion.
   * Brug til normale committed mutationer.
   */
  setValues: SetValuesUpdater<T>;
  setFieldValue: SetFieldValue<T>;
  /**
   * Autoritativ erstatning af sektionens committed værdier.
   * Bruges kun når hele sektionen bevidst skal erstattes.
   */
  replaceValues: ReplaceValuesSetter<T>;
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
 * `initialValues` skal gives som stabil reference (konstant eller memoized),
 * da hooken bruger dem som fallback-basis for den committed sektion.
 *
 * Type-håndtering:
 * - String felter: Håndteres som strings
 * - Number felter: Konverteres fra display-strings til numbers ved blur
 * - Boolean felter: Native boolean values
 * - Dato felter: Gemmes som ISO-strings (åååå-mm-dd), vises som dd-mm-åååå
 *
 * Eksempel:
 * ```typescript
 * const { values, setFieldValue, resetForm } = usePersistedForm(
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
  const { persistData, clearPageData, clearFieldErrors } = useFormPersistence();
  const initialValuesRef = React.useRef(initialValues);
  const persistDataRef = React.useRef(persistData);
  const clearPageDataRef = React.useRef(clearPageData);
  const clearFieldErrorsRef = React.useRef(clearFieldErrors);
  const committedSection = usePersistedSectionSelector(pageKey);
  const authoritativeSnapshotEpoch = useAuthoritativeSnapshotEpochSelector();
  const persistenceHydrated = usePersistenceHydratedSelector();
  React.useEffect(() => {
    initialValuesRef.current = initialValues;
  }, [initialValues]);
  React.useEffect(() => {
    persistDataRef.current = persistData;
    clearPageDataRef.current = clearPageData;
    clearFieldErrorsRef.current = clearFieldErrors;
  }, [clearFieldErrors, clearPageData, persistData]);

  const values = React.useMemo(() => {
    if (committedSection !== null) {
      const parsed = schema.safeParse(committedSection);
      if (!parsed.success) {
        throw new Error(`usePersistedForm: committed section '${String(pageKey)}' matcher ikke schema`);
      }
    }
    return committedSection ? { ...initialValues, ...committedSection } : initialValues;
  }, [committedSection, initialValues, pageKey, schema]);

  const [formVersion, bumpFormVersion] = React.useReducer((v: number) => v + 1, 0);
  const lastHandledAuthoritativeEpochRef = React.useRef<{ pageKey: K; epoch: number } | null>(null);

  // Kun efterfølgende authoritative replaces for samme sektion må bump'e formVersion og rydde feltfejl.
  // Første observerede hydrerede snapshot for en given pageKey er inert: hooken læser allerede aktuelle
  // committed values direkte fra storen. Først senere epoch-skift for samme key er reelle replace-signaler.
  React.useEffect(() => {
    if (!persistenceHydrated) {
      return;
    }

    const previous = lastHandledAuthoritativeEpochRef.current;
    const isFirstObservationForKey = previous === null || previous.pageKey !== pageKey;
    const hasAuthoritativeEpochChanged = !isFirstObservationForKey && previous.epoch !== authoritativeSnapshotEpoch;

    lastHandledAuthoritativeEpochRef.current = { pageKey, epoch: authoritativeSnapshotEpoch };

    if (!hasAuthoritativeEpochChanged) {
      return;
    }

    bumpFormVersion();
    clearFieldErrorsRef.current(pageKey);
  }, [authoritativeSnapshotEpoch, pageKey, persistenceHydrated]);

  const resolveCurrentValues = React.useCallback((): PersistedSectionMap[K] => {
    const committedSnapshot = getPersistedSectionSnapshot(pageKey);
    if (!committedSnapshot) {
      return initialValuesRef.current;
    }
    return { ...initialValuesRef.current, ...committedSnapshot };
  }, [pageKey]);

  // Felt-commit via funktionel updater. Bumper ikke formVersion.
  const setValues = React.useCallback(
    (updater: (prev: PersistedSectionMap[K]) => PersistedSectionMap[K]) => {
      const next = updater(resolveCurrentValues());
      persistDataRef.current(pageKey, next);
    },
    [pageKey, resolveCurrentValues]
  );

  const setFieldValue = React.useCallback(
    <FieldKey extends keyof PersistedSectionMap[K]>(fieldName: FieldKey, value: PersistedSectionMap[K][FieldKey]) => {
      setValues((prev) => ({ ...prev, [fieldName]: value }));
    },
    [setValues]
  );

  const replaceValues = React.useCallback((next: PersistedSectionMap[K]) => {
    clearFieldErrorsRef.current(pageKey);
    // replaceValues må kun bump'e formVersion når den autoritative commit faktisk lykkes.
    // persistData returnerer derfor et eksplicit succes-signal i stedet for at vi gætter via revisionsdrift.
    const didPersist = persistDataRef.current(pageKey, next);
    if (didPersist) {
      bumpFormVersion();
    }
  }, [pageKey]);

  /**
   * Nulstiller formular til initialValues OG sletter gemt data fra storage.
   * Dette er en destruktiv operation - data kan ikke gendannes.
   *
   * clearPageData håndterer: sessionStorage-sletning, cache-sync(null),
   * clearFieldErrorsForSection og runAllDomainCleanups.
   * Hooken bumper formVersion direkte (ikke via authoritative epoch), fordi reset ikke er
   * en autoritativ snapshot-replace men en lokal, eksplicit nulstilling af sektionen.
   */
  const resetForm = React.useCallback(() => {
    clearPageDataRef.current(pageKey);
    bumpFormVersion();
  }, [pageKey]);

  return {
    values,
    setValues,
    setFieldValue,
    replaceValues,
    resetForm,
    formVersion,
  };
};

export default usePersistedForm;
