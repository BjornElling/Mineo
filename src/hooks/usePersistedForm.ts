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

export type SetValuesUpdater<T extends object> = (updater: (prev: T) => T | Partial<T>, options?: CommitOriginOptions) => boolean;
export type SetFieldValue<T> = <K extends keyof T>(fieldName: K, value: T[K], options?: CommitOriginOptions) => boolean;

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
export interface UsePersistedFormReturn<T extends object> {
  values: T;
  /**
   * Felt-commit via funktionel updater (prev => next eller prev => patch). Bumper ikke formVersion.
   * Brug til normale committed mutationer.
   */
  setValues: SetValuesUpdater<T>;
  setFieldValue: SetFieldValue<T>;
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
 * - Schema-default-udfyldning: nye felter (tilføjet efter en gemt sags schema-version) får
 *   deres værdi fra schemaets egen `.default()`/`.optional()` via `schema.parse(committedSection)`,
 *   ikke fra `initialValues`. Det er bevidst: device-lokale initialValues må ikke injiceres oven
 *   på indlæst sagsinput (jf. AGENTS.md save/load-garantier). `initialValues` bruges kun som basis,
 *   når der ikke findes en committed sektion (helt ny sag).
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
  const { persistData, clearPageData } = useFormPersistence();
  const routePathname = useRoutePathnameSnapshot();
  const initialValuesRef = React.useRef(initialValues);
  const persistDataRef = React.useRef(persistData);
  const clearPageDataRef = React.useRef(clearPageData);
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
  }, [clearPageData, persistData]);

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
    (updater: (prev: PersistedSectionMap[K]) => PersistedSectionMap[K] | Partial<PersistedSectionMap[K]>, options?: CommitOriginOptions) => {
      const current = resolveCurrentValues();
      const next = { ...current, ...updater(current) };
      return persistDataRef.current(pageKey, next, { undoOrigin: createUndoOrigin(options) });
    },
    [createUndoOrigin, pageKey, resolveCurrentValues]
  );

  const setFieldValue = React.useCallback(
    <FieldKey extends keyof PersistedSectionMap[K]>(
      fieldName: FieldKey,
      value: PersistedSectionMap[K][FieldKey],
      options?: CommitOriginOptions
    ) => {
      return setValues((prev) => ({ ...prev, [fieldName]: value }), { fieldPath: options?.fieldPath ?? String(fieldName) });
    },
    [setValues]
  );

  /**
   * Nulstiller formular til initialValues OG sletter gemt data fra storage.
   *
   * Reset bevarer bevidst undo/redo-stakken og kan derfor fortrydes med undo
   * (det er ikke en autoritativ snapshot-replace, men en lokal, eksplicit
   * nulstilling af sektionen — derfor bumpes formVersion direkte, ikke via
   * authoritative epoch). clearPageData håndterer: sessionStorage-sletning,
   * cache-sync(null), clearFieldErrorsForSection og runAllDomainCleanups.
   */
  const resetForm = React.useCallback(() => {
    clearPageDataRef.current(pageKey);
    bumpFormVersion();
  }, [pageKey]);

  return {
    values,
    setValues,
    setFieldValue,
    resetForm,
    formVersion,
  };
};

export default usePersistedForm;
