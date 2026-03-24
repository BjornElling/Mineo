import type { PersistedSectionMap } from '../config/persistenceRegistry';
import type { StorageKey } from '../config/storageManifest';

export type FieldErrorSeverity = 'error' | 'warning';
export type FieldErrorSource = 'input' | 'schema' | 'rule';

export type FormFieldError = {
  message: string;
  severity: FieldErrorSeverity;
  source: FieldErrorSource;
  /**
   * Save-gating flag.
   *
   * `false` means the value is already committed/canonical and the error is UI-only
   * (for example a range/bounds violation that must stay visible but must not block `.eo` save).
   *
   * Omitted/`true` means the error represents non-committable invalid input and blocks save.
   */
  blocksSave?: boolean;
};

export type ReportableFieldError =
  | string
  | Readonly<{
      message: string;
      blocksSave?: boolean;
    }>;

export const getReportableFieldErrorMessage = (
  error: ReportableFieldError | undefined
): string | undefined => {
  if (error === undefined) return undefined;
  return typeof error === 'string' ? error : error.message;
};

export type FieldErrorBySource = Partial<Record<FieldErrorSource, FormFieldError>>;

export type FieldErrorsForSection<K extends StorageKey> = Partial<
  Record<Extract<keyof PersistedSectionMap[K], string>, FieldErrorBySource>
>;

/**
 * Default resolver priority (normative).
 *
 * Used by UI to select the single "active" error when multiple sources exist for the same field.
 *
 * Priority rules:
 * 1) Severity: `error` before `warning`
 * 2) Within same severity: `source` in this fixed order
 */
export const DEFAULT_FIELD_ERROR_SOURCE_PRIORITY: readonly FieldErrorSource[] = ['input', 'rule', 'schema'] as const;
export const DEFAULT_FIELD_ERROR_SEVERITY_PRIORITY: readonly FieldErrorSeverity[] = ['error', 'warning'] as const;

/**
 * Field error model invariants (trust-critical):
 * - Errors are runtime-only diagnostics (never persisted).
 * - A field can have multiple concurrent errors, separated by `source`.
 * - UI rendering must use a deterministic resolver to avoid timing-dependent output:
 *   - severity priority: `error` before `warning`
 *   - within the same severity: a stable `sourcePriority` order (default: input → rule → schema)
 */
export const normalizeFieldError = (error: FormFieldError): FormFieldError | null => {
  const message = error.message.trim();
  if (message === '') return null;
  return {
    message,
    severity: error.severity,
    source: error.source,
    blocksSave: error.blocksSave !== false,
  };
};

export const resolveActiveFieldError = (
  errors: FieldErrorBySource,
  sourcePriority: readonly FieldErrorSource[] = DEFAULT_FIELD_ERROR_SOURCE_PRIORITY
): FormFieldError | undefined => {
  for (const severity of DEFAULT_FIELD_ERROR_SEVERITY_PRIORITY) {
    for (const source of sourcePriority) {
      const candidate = errors[source];
      if (!candidate) continue;
      const normalized = normalizeFieldError(candidate);
      if (!normalized) continue;
      if (normalized.severity !== severity) continue;
      return normalized;
    }
  }
  return undefined;
};
