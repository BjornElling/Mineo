import type { StorageKey } from '../config/storageManifest';

export type FieldErrorSeverity = 'error' | 'warning';
export type FieldErrorSource = 'input' | 'schema' | 'rule';

export type FormFieldError = {
  message: string;
  severity: FieldErrorSeverity;
  source: FieldErrorSource;
  /**
   * Flag der styrer save-gating.
   *
   * `false` betyder, at værdien allerede er committet/kanonisk, og at fejlen kun er UI-relevant
   * (for eksempel en interval-/grænseoverskridelse, der skal forblive synlig, men ikke må blokere `.eo`-save).
   *
   * Udeladt/`true` betyder, at fejlen repræsenterer ikke-committbart, ugyldigt input og blokerer save.
   */
  blocksSave?: boolean;
  /**
   * Runtime-only draft, der fejlede commit-validering.
   *
   * Bruges til at genskabe det præcise ugyldige input efter route-/tab-navigation, når save er blokeret.
   * Må aldrig persisteres til `.eo` eller bruges til beregning.
   */
  invalidDraft?: string;
};

export type ReportableFieldError =
  | string
  | Readonly<{
      message: string;
      blocksSave?: boolean;
      invalidDraft?: string;
    }>;

/**
 * Producer-ejet feltfejl-reporter.
 *
 * Bærer desuden bindingen til `invalidDrafts`-recovery-kanalen (jf. form-contract.md §2.4):
 * `pageKey`/`fieldName` lader et input-felt reaktivt læse sin egen committede rå draft via en
 * store-selector, og `commitInvalidDraft`/`clearInvalidDraft` skriver/rydder den ved commit.
 * Range/bounds-fejl (`blocksSave:false`) rapporteres fortsat som feltfejl via selve reporter-kaldet.
 */
export type FieldErrorReporter = ((error: ReportableFieldError | undefined) => void) & {
  getCurrentError?: () => FormFieldError | undefined;
  pageKey?: StorageKey;
  fieldName?: string;
  commitInvalidDraft?: (rawDraft: string) => void;
  clearInvalidDraft?: () => void;
};

export const getReportableFieldErrorMessage = (
  error: ReportableFieldError | undefined
): string | undefined => {
  if (error === undefined) return undefined;
  return typeof error === 'string' ? error : error.message;
};

export type FieldErrorBySource = Partial<Record<FieldErrorSource, FormFieldError>>;

export type FieldErrorsForSection<_K extends StorageKey> = Partial<
  Record<string, FieldErrorBySource>
>;

/**
 * Standard resolver-prioritet (normativ).
 *
 * Bruges af UI til at vælge den ene "aktive" fejl, når der findes flere kilder for samme felt.
 *
 * Prioritetsregler:
 * 1) Severity: `error` før `warning`
 * 2) Inden for samme severity: `source` i denne faste rækkefølge
 */
export const DEFAULT_FIELD_ERROR_SOURCE_PRIORITY: readonly FieldErrorSource[] = ['input', 'rule', 'schema'] as const;
export const DEFAULT_FIELD_ERROR_SEVERITY_PRIORITY: readonly FieldErrorSeverity[] = ['error', 'warning'] as const;

/**
 * Invarianter for field error-modellen (trust-kritisk):
 * - Fejl er runtime-only diagnostik (persisteres aldrig).
 * - Et felt kan have flere samtidige fejl, adskilt efter `source`.
 * - UI-rendering skal bruge en deterministisk resolver for at undgå timing-afhængigt output:
 *   - severity-prioritet: `error` før `warning`
 *   - inden for samme severity: en stabil `sourcePriority`-rækkefølge (standard: input → rule → schema)
 */
export const normalizeFieldError = (error: FormFieldError): FormFieldError | null => {
  const message = error.message.trim();
  if (message === '') return null;
  return {
    message,
    severity: error.severity,
    source: error.source,
    blocksSave: error.blocksSave !== false,
    invalidDraft: typeof error.invalidDraft === 'string' ? error.invalidDraft : undefined,
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
