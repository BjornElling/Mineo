import React from 'react';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import { useFormPersistence } from '../contexts/FormPersistenceContext';
import type { FieldErrorsForSection, FieldErrorSeverity, FieldErrorSource, FormFieldError } from '../types/fieldErrors';

type FieldName<K extends StorageKey> = Extract<keyof PersistedSectionMap[K], string>;

/**
 * Resolved "active" errors per field (flattened across sources via the deterministic resolver).
 *
 * Use when you want UI-parity: "what is wrong right now?"
 */
export const useFormFieldErrors = <K extends StorageKey>(pageKey: K): Partial<Record<FieldName<K>, FormFieldError>> => {
  const { getFieldErrors } = useFormPersistence();
  return getFieldErrors(pageKey);
};

/**
 * Full error state by source per field.
 *
 * Use when you want diagnostics: "where does this error come from?"
 */
export const useFormFieldErrorsBySource = <K extends StorageKey>(pageKey: K): FieldErrorsForSection<K> => {
  const { getFieldErrorsBySource } = useFormPersistence();
  return getFieldErrorsBySource(pageKey);
};

/**
 * Selector-style hook for field errors by source, scoped to a single section.
 */
export const useFieldErrorsBySourceForSection = <K extends StorageKey>(pageKey: K): FieldErrorsForSection<K> => {
  const { getFieldErrorsBySource } = useFormPersistence();
  const value = getFieldErrorsBySource(pageKey);
  return React.useMemo(() => value, [value]);
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
 * - On unmount, the reporter clears the same `(pageKey, fieldName, source)` to avoid orphaned errors.
 *
 * Preferred usage:
 * - Bind this reporter at the call-site that owns the error (typically an input adapter).
 * - Drive it from the same commit/validation lifecycle as the field (see `src/contracts/error-debug-contract.md`).
 */
export const useFormFieldErrorReporter = <K extends StorageKey>(
  pageKey: K,
  fieldName: FieldName<K>,
  options?: ReporterOptions
): ((errorMsg: string | undefined) => void) => {
  const { setFieldError } = useFormPersistence();

  const severity = options?.severity ?? 'error';
  const source = options?.source ?? 'input';

  const reportError = React.useCallback(
    (errorMsg: string | undefined) => {
      // Lifecycle contract:
      // - The producer (typically an input component) owns the error for this field and MUST clear it
      //   by calling the reporter with `undefined` once the field becomes valid again.
      // - The form layer may clear all field errors on authoritative state replacement (reset/load).
      if (errorMsg === undefined || errorMsg.trim() === '') {
        setFieldError(pageKey, fieldName, source, null);
        return;
      }

      setFieldError(pageKey, fieldName, source, { message: errorMsg, severity });
    },
    [fieldName, pageKey, setFieldError, severity, source]
  );

  React.useEffect(() => {
    return () => {
      setFieldError(pageKey, fieldName, source, null);
    };
  }, [fieldName, pageKey, setFieldError, source]);

  return reportError;
};
