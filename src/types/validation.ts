/**
 * Centrale validation types til form-validering
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
 * Generisk form validator-interface
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

