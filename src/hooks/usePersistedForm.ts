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
import { createActiveTabStorageKey } from '../config/storageManifest';
import { readOptionalSessionStorageValue } from '../utils/safeSessionStorage';
import type { HistoryFrameOrigin } from '../stores/undoRedoStore';
import { readLastUndoFocus } from '../utils/undoFocusTracker';
import { useRoutePathnameSnapshot } from '../contexts/RoutePathnameContext.shared';
import { reportSystemIssue } from '../utils/systemIssueReporter';

/**
 * Signatur for setValues: funktionel updater-baseret felt-commit.
 * Se UsePersistedFormReturn for fuld dokumentation.
 */
export type CommitOriginOptions = {
  fieldPath?: string;
};

export type SetValuesUpdater<T> = (updater: (prev: T) => T, options?: CommitOriginOptions) => void;
export type ReplaceValuesSetter<T> = (next: T) => void;
export type SetFieldValue<T> = <K extends keyof T>(fieldName: K, value: T[K], options?: CommitOriginOptions) => void;

const getCurrentPathname = (): string => {
  if (typeof window === 'undefined') {
    return '/';
  }
  return window.location.pathname;
};

const formatSchemaIssueSummary = (issues: readonly z.ZodIssue[], max: number): string => {
  return issues
    .slice(0, max)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
};

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
 *     skadedato: undefined,
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
  const routePathname = useRoutePathnameSnapshot();
  const initialValuesRef = React.useRef(initialValues);
  const persistDataRef = React.useRef(persistData);
  const clearPageDataRef = React.useRef(clearPageData);
  const clearFieldErrorsRef = React.useRef(clearFieldErrors);
  const reportedInvalidSectionKeysRef = React.useRef<Set<string>>(new Set());
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

  const resolvedValues = React.useMemo(() => {
    const materializedInitialValues = schema.parse(initialValues);
    if (committedSection !== null) {
      const parsed = schema.safeParse(committedSection);
      if (!parsed.success) {
        const issues = formatSchemaIssueSummary(parsed.error.issues, 5);
        return {
          values: materializedInitialValues,
          invalidCommittedSection: {
            pageKey: String(pageKey),
            issues,
            issueCount: parsed.error.issues.length,
          },
        };
      }
    }
    return {
      values: committedSection ? schema.parse(committedSection) : materializedInitialValues,
      invalidCommittedSection: null,
    };
  }, [committedSection, initialValues, pageKey, schema]);
  const values = resolvedValues.values;

  React.useEffect(() => {
    const invalidCommittedSection = resolvedValues.invalidCommittedSection;
    if (!invalidCommittedSection) return;

    const reportKey = `${invalidCommittedSection.pageKey}:${invalidCommittedSection.issues}`;
    if (reportedInvalidSectionKeysRef.current.has(reportKey)) return;
    reportedInvalidSectionKeysRef.current.add(reportKey);

    reportSystemIssue({
      code: 'persistence:committed_section_schema_mismatch',
      area: 'persistence',
      context: 'usePersistedForm',
      userMessage: 'En gemt sektion matcher ikke schema og kan ikke anvendes.',
      developerMessage: invalidCommittedSection.issues,
      diagnostics: {
        pageKey: invalidCommittedSection.pageKey,
        issueCount: invalidCommittedSection.issueCount,
        issues: invalidCommittedSection.issues,
      },
    });
  }, [resolvedValues.invalidCommittedSection]);

  const [formVersion, bumpFormVersion] = React.useReducer((v: number) => v + 1, 0);
  const lastHandledAuthoritativeEpochRef = React.useRef<{ pageKey: K; epoch: number } | null>(null);

  // Bump formVersion ved alle authoritative snapshot-events, inkl. første hydration.
  // useRowDrafts (og lignende draft-state hooks) initialiserer synkront fra en endnu
  // ikke-hydreret store — de kan ikke se de persisterede rækker før resync-signalet ankommer.
  React.useEffect(() => {
    if (!persistenceHydrated) {
      return;
    }

    const previous = lastHandledAuthoritativeEpochRef.current;
    const isNewObservationForKey = previous === null || previous.pageKey !== pageKey || previous.epoch !== authoritativeSnapshotEpoch;

    lastHandledAuthoritativeEpochRef.current = { pageKey, epoch: authoritativeSnapshotEpoch };

    if (!isNewObservationForKey) {
      return;
    }

    bumpFormVersion();
  }, [authoritativeSnapshotEpoch, pageKey, persistenceHydrated]);

  const resolveCurrentValues = React.useCallback((): PersistedSectionMap[K] => {
    const committedSnapshot = getPersistedSectionSnapshot(pageKey);
    if (!committedSnapshot) {
      return initialValuesRef.current;
    }
    return schema.parse(committedSnapshot);
  }, [pageKey, schema]);

  const createUndoOrigin = React.useCallback((options?: CommitOriginOptions): HistoryFrameOrigin => {
    const route = routePathname ?? getCurrentPathname();
    const pageId = route.replace(/^\/+/, '') || 'stamdata';
    const tabKey = readOptionalSessionStorageValue(createActiveTabStorageKey(pageId));
    // Vigtigt: brug det senest fokuserede undo-bærende felt — ikke document.activeElement.
    // Et felt-commit udløses normalt af blur efter fokus er flyttet, så activeElement
    // peger på det nye felt og ville give forkert undo-mål. Se undoFocusTracker.ts.
    const lastFocus = readLastUndoFocus();
    const resolvedFieldPath = options?.fieldPath ?? lastFocus.fieldPath;

    return {
      route,
      tabKey,
      sectionKey: pageKey,
      fieldPath: resolvedFieldPath,
      focusToken: options?.fieldPath ? null : lastFocus.focusToken,
    };
  }, [pageKey, routePathname]);

  // Felt-commit via funktionel updater. Bumper ikke formVersion.
  const setValues = React.useCallback(
    (updater: (prev: PersistedSectionMap[K]) => PersistedSectionMap[K], options?: CommitOriginOptions) => {
      const next = updater(resolveCurrentValues());
      persistDataRef.current(pageKey, next, { undoOrigin: createUndoOrigin(options) });
    },
    [createUndoOrigin, pageKey, resolveCurrentValues]
  );

  const setFieldValue = React.useCallback(
    <FieldKey extends keyof PersistedSectionMap[K]>(
      fieldName: FieldKey,
      value: PersistedSectionMap[K][FieldKey],
      options?: CommitOriginOptions
    ) => {
      setValues((prev) => ({ ...prev, [fieldName]: value }), { fieldPath: options?.fieldPath ?? String(fieldName) });
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
