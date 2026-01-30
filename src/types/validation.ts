/**
 * Central validation types for form validation
 *
 * Denne arkitektur sikrer:
 * - Deterministisk validering (pure functions)
 * - Uafhængig af DOM events
 * - Cross-field validation support
 * - Single source of truth for errors
 */

/**
 * Field path til validation errors
 * Understøtter både simple felter og nested arrays
 *
 * @example "forligAnsvarsgradProcent"
 * @example "svieSmertePerioder[0].fra"
 */
export type FieldPath = string;

/**
 * Severity level for validation errors
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * En enkelt validation error
 */
export interface ValidationError {
  /** Field path (fx "forligAnsvarsgradProcent") */
  path: FieldPath;
  /** Fejlbesked til brugeren */
  message: string;
  /** Severity level (default: 'error') */
  severity?: ValidationSeverity;
}

/**
 * Resultat af en validation
 */
export interface ValidationResult {
  /** Liste af alle errors */
  errors: ValidationError[];
  /** True hvis ingen errors */
  isValid: boolean;
}

/**
 * Normalized error map til hurtig UI-lookup
 *
 * Key: field path
 * Value: array af errors for det felt
 */
export type ValidationErrorMap = {
  [path: string]: ValidationError[];
};

/**
 * Generic form validator interface
 */
export interface FormValidator<TValues> {
  /**
   * Validerer form values og returnerer errors
   *
   * VIGTIGT: Denne funktion SKAL være pure (ingen side effects)
   *
   * @param values - Form values at validere
   * @returns ValidationResult med errors og isValid flag
   */
  validate(values: TValues): ValidationResult;
}

/**
 * Normalizer ValidationError[] til ValidationErrorMap for hurtig lookup
 *
 * @param errors - Array af validation errors
 * @returns Map fra field path til errors
 */
export function normalizeErrors(errors: ValidationError[]): ValidationErrorMap {
  const map: ValidationErrorMap = {};

  errors.forEach(error => {
    if (!map[error.path]) {
      map[error.path] = [];
    }
    map[error.path].push(error);
  });

  return map;
}

/**
 * Henter alle errors for et specifikt felt
 *
 * @param errorMap - Normalized error map
 * @param path - Field path
 * @returns Array af errors (tom array hvis ingen fejl)
 */
export function getFieldErrors(errorMap: ValidationErrorMap, path: FieldPath): ValidationError[] {
  return errorMap[path] ?? [];
}

/**
 * Tjekker om et felt har errors
 *
 * @param errorMap - Normalized error map
 * @param path - Field path
 * @returns True hvis feltet har mindst én error
 */
export function hasFieldError(errorMap: ValidationErrorMap, path: FieldPath): boolean {
  return getFieldErrors(errorMap, path).length > 0;
}
