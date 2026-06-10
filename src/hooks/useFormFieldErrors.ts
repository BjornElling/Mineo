import React from 'react';
import { useLocation } from 'react-router-dom';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import { createActiveTabStorageKey } from '../config/storageManifest';
import { useFormPersistence } from '../contexts/useFormPersistence';
import type {
  FieldErrorsForSection,
  FieldErrorSeverity,
  FieldErrorSource,
  FieldErrorReporter,
  FormFieldError,
  ReportableFieldError,
} from '../types/fieldErrors';
import {
  useFieldErrorsBySourceSelector,
  useInvalidDraftForFieldSelector,
  useResolvedFieldErrorsSelector,
} from './useFormPersistenceSelectors';
import { isInteractiveDevLoggingEnabled } from '../utils/debugRuntime';
import type { HistoryFrameOrigin } from '../stores/undoRedoStore';
import { readLastUndoFocus } from '../utils/undoFocusTracker';
import { readOptionalSessionStorageValue } from '../utils/safeSessionStorage';

const debugFieldErrorReporter = (event: string, details: Record<string, unknown>): void => {
  if (!isInteractiveDevLoggingEnabled) return;
  console.debug('[useFormFieldErrors]', event, details);
};

type FieldName<K extends StorageKey> = Extract<keyof PersistedSectionMap[K], string>;
type DynamicFieldName<K extends StorageKey> = FieldName<K> | string;

/**
 * Opløste "aktive" fejl pr. felt (fladet ud på tværs af sources via den deterministiske resolver).
 *
 * Brug når du vil have UI-paritet: "hvad er galt lige nu?"
 */
export const useFormFieldErrors = <K extends StorageKey>(pageKey: K): Partial<Record<FieldName<K>, FormFieldError>> => {
  return useResolvedFieldErrorsSelector(pageKey);
};

/**
 * Selector-baseret hook for feltfejl pr. source, afgrænset til en enkelt sektion.
 */
export const useFieldErrorsBySourceForSection = <K extends StorageKey>(pageKey: K): FieldErrorsForSection<K> => {
  return useFieldErrorsBySourceSelector(pageKey);
};

export const selectBlockingFieldIdsBySuffix = (
  fieldErrors: Readonly<Record<string, Record<string, FormFieldError | undefined> | undefined>>,
  suffix: string
): Readonly<Record<string, true>> => {
  const result: Record<string, true> = {};

  for (const [fieldKey, bySource] of Object.entries(fieldErrors)) {
    if (!fieldKey.endsWith(suffix) || !bySource) continue;
    const hasBlockingError = Object.values(bySource).some((entry) => entry?.severity === 'error' && entry.blocksSave !== false);
    if (!hasBlockingError) continue;
    const entityId = fieldKey.slice(0, -suffix.length);
    if (entityId !== '') {
      result[entityId] = true;
    }
  }

  return result;
};

export const useBlockingFieldIdsBySuffixForSection = <K extends StorageKey>(
  pageKey: K,
  suffix: string
): Readonly<Record<string, true>> => {
  const fieldErrors = useFieldErrorsBySourceForSection(pageKey);

  return React.useMemo(() => {
    return selectBlockingFieldIdsBySuffix(
      fieldErrors as Readonly<Record<string, Record<string, FormFieldError | undefined> | undefined>>,
      suffix
    );
  }, [fieldErrors, suffix]);
};

type ReporterOptions = {
  severity?: FieldErrorSeverity;
  source?: FieldErrorSource;
};

const createFieldErrorUndoOrigin = (
  pageKey: StorageKey,
  fieldName: string,
  route: string
): HistoryFrameOrigin => {
  const pageId = route.replace(/^\/+/, '') || 'stamdata';
  const lastFocus = readLastUndoFocus();
  return {
    route,
    tabKey: readOptionalSessionStorageValue(createActiveTabStorageKey(pageId)),
    sectionKey: pageKey,
    fieldPath: fieldName,
    focusToken: lastFocus.focusToken,
  };
};

/**
 * Producer-ejet feltfejl-reporter.
 *
 * Kontrakt (normativ):
 * - Kalderen ejer fejlen for `(pageKey, fieldName, source)`.
 * - Rydning (`undefined` / tom streng) rydder kun kalderens egen `source` (aldrig andre sources).
 * - Unmount/navigation af komponenten rydder ikke fejl. Kun en eksplicit rydning fra produceren
 *   eller en autoritativ form-reset/load må fjerne dem.
 * - Denne hook har bevidst ingen unmount-cleanup. Tab-/sidenavigation må ikke stille skjule
 *   blokerende committede feltfejl, som andre tabs stadig afhænger af.
 *
 * Foretrukken brug:
 * - Bind denne reporter på det call-site, der ejer fejlen (typisk en input-adapter).
 * - Driv den fra samme commit-/valideringslivscyklus som feltet (se `src/contracts/error-debug-contract.md`).
 */
export const useFormFieldErrorReporter = <K extends StorageKey>(
  pageKey: K,
  fieldName: FieldName<K>,
  options?: ReporterOptions
): FieldErrorReporter => {
  const { getFieldError, setFieldError, commitInvalidDraft, clearInvalidDraft } = useFormPersistence();
  const location = useLocation();

  const severity = options?.severity ?? 'error';
  const source = options?.source ?? 'input';

  const commitInvalidDraftForField = React.useCallback(
    (rawDraft: string) => {
      commitInvalidDraft(pageKey, fieldName, rawDraft, {
        undoOrigin: createFieldErrorUndoOrigin(pageKey, fieldName, location.pathname),
      });
    },
    [commitInvalidDraft, fieldName, location.pathname, pageKey]
  );

  const clearInvalidDraftForField = React.useCallback(() => {
    clearInvalidDraft(pageKey, fieldName);
  }, [clearInvalidDraft, fieldName, pageKey]);

  const reportError = React.useCallback(
    (error: ReportableFieldError | undefined) => {
      const nextKey =
        error === undefined || (typeof error === 'string' && error.trim() === '') || (typeof error !== 'string' && error.message.trim() === '')
          ? '__clear__'
          : typeof error === 'string'
            ? `__msg__:${severity}:${source}:true:${error}`
            : `__msg__:${severity}:${source}:${error.blocksSave !== false ? 'true' : 'false'}:${error.message}:${error.invalidDraft ?? ''}`;
      debugFieldErrorReporter('report', {
        pageKey,
        fieldName,
        source,
        nextKey,
        error,
      });

      // Livscyklus-kontrakt:
      // - Produceren (typisk en input-komponent) ejer fejlen for dette felt og SKAL rydde den
      //   ved at kalde reporteren med `undefined`, så snart feltet bliver gyldigt igen.
      // - Form-laget må rydde alle feltfejl ved autoritativ state-erstatning (reset/load).

      if (error === undefined || (typeof error === 'string' && error.trim() === '') || (typeof error !== 'string' && error.message.trim() === '')) {
        setFieldError(pageKey, fieldName, source, null);
        return;
      }

      if (typeof error === 'string') {
        setFieldError(pageKey, fieldName, source, { message: error, severity, blocksSave: true });
        return;
      }

      setFieldError(pageKey, fieldName, source, {
        message: error.message,
        severity,
        blocksSave: error.blocksSave !== false,
        invalidDraft: error.blocksSave !== false ? error.invalidDraft : undefined,
      });
    },
    [fieldName, pageKey, setFieldError, severity, source]
  );

  return Object.defineProperties(reportError, {
    getCurrentError: { configurable: true, enumerable: true, value: () => getFieldError(pageKey, fieldName) },
    pageKey: { configurable: true, enumerable: true, value: pageKey },
    fieldName: { configurable: true, enumerable: true, value: fieldName },
    commitInvalidDraft: { configurable: true, enumerable: true, value: commitInvalidDraftForField },
    clearInvalidDraft: { configurable: true, enumerable: true, value: clearInvalidDraftForField },
  }) as FieldErrorReporter;
};

/**
 * Felt-side binding til `invalidDrafts`-recovery-kanalen.
 *
 * Generiske input-komponenter kalder denne hook ubetinget med deres (valgfri) reporter. Returnerer:
 * - `committedInvalidDraft`: reaktiv læsning af feltets committede rå draft (via store-selector,
 *   context-fri, så hooken er sikker også uden for FormPersistenceProvider — returnerer da `undefined`),
 * - `onCommitInvalid`/`clearInvalidDraft`: skrive/rydde-kanal (kun til stede når feltet har en binding).
 *
 * Når der ingen binding er (ubundet felt), er kanalerne `undefined`, og `useDraftField` falder tilbage
 * til lokal draft-bevarelse.
 */
export const useFieldInvalidDraftChannel = (
  reporter: FieldErrorReporter | undefined
): Readonly<{
  committedInvalidDraft: string | undefined;
  onCommitInvalid: ((rawDraft: string) => void) | undefined;
  clearInvalidDraft: (() => void) | undefined;
}> => {
  const committedInvalidDraft = useInvalidDraftForFieldSelector(reporter?.pageKey, reporter?.fieldName);
  return {
    committedInvalidDraft,
    onCommitInvalid: reporter?.commitInvalidDraft,
    clearInvalidDraft: reporter?.clearInvalidDraft,
  };
};

export const useDynamicFormFieldErrorReporter = <K extends StorageKey>(
  pageKey: K,
  options?: ReporterOptions
): ((fieldName: DynamicFieldName<K>, error: ReportableFieldError | undefined) => void) => {
  const { setFieldError } = useFormPersistence();

  const severity = options?.severity ?? 'error';
  const source = options?.source ?? 'input';
  const lastReportedByFieldRef = React.useRef<Record<string, string>>({});

  return React.useCallback((fieldName: DynamicFieldName<K>, error: ReportableFieldError | undefined) => {
    const nextKey =
      error === undefined
      || (typeof error === 'string' && error.trim() === '')
      || (typeof error !== 'string' && error.message.trim() === '')
        ? '__clear__'
        : typeof error === 'string'
          ? `__msg__:${severity}:${source}:true:${error}`
          : `__msg__:${severity}:${source}:${error.blocksSave !== false ? 'true' : 'false'}:${error.message}:${error.invalidDraft ?? ''}`;

    if (lastReportedByFieldRef.current[fieldName] === nextKey) {
      debugFieldErrorReporter('report-dynamic-skip-duplicate', {
        pageKey,
        fieldName,
        source,
        nextKey,
      });
      return;
    }
    debugFieldErrorReporter('report-dynamic', {
      pageKey,
      fieldName,
      source,
      nextKey,
      error,
    });
    lastReportedByFieldRef.current[fieldName] = nextKey;

    if (
      error === undefined
      || (typeof error === 'string' && error.trim() === '')
      || (typeof error !== 'string' && error.message.trim() === '')
    ) {
      setFieldError(pageKey, fieldName, source, null);
      return;
    }

    if (typeof error === 'string') {
      setFieldError(pageKey, fieldName, source, { message: error, severity, blocksSave: true });
      return;
    }

    setFieldError(pageKey, fieldName, source, {
      message: error.message,
      severity,
      blocksSave: error.blocksSave !== false,
      invalidDraft: error.blocksSave !== false ? error.invalidDraft : undefined,
    });
  }, [pageKey, setFieldError, severity, source]);
};
