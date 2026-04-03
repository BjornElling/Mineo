import React from 'react';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import { useFormPersistence } from '../contexts/useFormPersistence';
import type {
  FieldErrorsForSection,
  FieldErrorSeverity,
  FieldErrorSource,
  FormFieldError,
  ReportableFieldError,
} from '../types/fieldErrors';
import {
  useFieldErrorsBySourceSelector,
  useResolvedFieldErrorsSelector,
} from './useFormPersistenceSelectors';

type FieldName<K extends StorageKey> = Extract<keyof PersistedSectionMap[K], string>;
type DynamicFieldName<K extends StorageKey> = FieldName<K> | string;

/**
 * Resolved "active" errors per field (flattened across sources via the deterministic resolver).
 *
 * Use when you want UI-parity: "what is wrong right now?"
 */
export const useFormFieldErrors = <K extends StorageKey>(pageKey: K): Partial<Record<FieldName<K>, FormFieldError>> => {
  return useResolvedFieldErrorsSelector(pageKey);
};

/**
 * Selector-style hook for field errors by source, scoped to a single section.
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

/**
 * Producer-owned field error reporter.
 *
 * Contract (normative):
 * - The caller owns the error for `(pageKey, fieldName, source)`.
 * - Clearing (`undefined` / empty string) only clears the caller's `source` (never other sources).
 * - Component unmount/navigation does not clear errors. Only an explicit clear from the producer
 *   or an authoritative form reset/load may remove them.
 * - This hook intentionally has no unmount cleanup. Tab/page navigation must not silently hide
 *   blocking committed field errors that other tabs still depend on.
 *
 * Preferred usage:
 * - Bind this reporter at the call-site that owns the error (typically an input adapter).
 * - Drive it from the same commit/validation lifecycle as the field (see `src/contracts/error-debug-contract.md`).
 */
export const useFormFieldErrorReporter = <K extends StorageKey>(
  pageKey: K,
  fieldName: FieldName<K>,
  options?: ReporterOptions
): ((error: ReportableFieldError | undefined) => void) => {
  const { setFieldError } = useFormPersistence();

  const severity = options?.severity ?? 'error';
  const source = options?.source ?? 'input';

  const reportError = React.useCallback(
    (error: ReportableFieldError | undefined) => {
      // Lifecycle contract:
      // - The producer (typically an input component) owns the error for this field and MUST clear it
      //   by calling the reporter with `undefined` once the field becomes valid again.
      // - The form layer may clear all field errors on authoritative state replacement (reset/load).
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
      });
    },
    [fieldName, pageKey, setFieldError, severity, source]
  );

  return reportError;
};

export const useDynamicFormFieldErrorReporter = <K extends StorageKey>(
  pageKey: K,
  options?: ReporterOptions
): ((fieldName: DynamicFieldName<K>, error: ReportableFieldError | undefined) => void) => {
  const { setFieldError } = useFormPersistence();

  const severity = options?.severity ?? 'error';
  const source = options?.source ?? 'input';

  return React.useCallback((fieldName: DynamicFieldName<K>, error: ReportableFieldError | undefined) => {
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
    });
  }, [pageKey, setFieldError, severity, source]);
};
