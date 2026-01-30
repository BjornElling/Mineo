/**
 * Central validator for Erstatningsopgørelse
 *
 * Arkitektur:
 * 1. Schema-validering (Zod) - datatyper, required fields
 * 2. Felt-uafhængige regler - single-field constraints
 * 3. Cross-field validering - regler der afhænger af flere felter
 *
 * VIGTIGT: Alle validerings-funktioner er pure (ingen side effects)
 */

import type { ErstatningsopgoerelseValues } from '../schemas/formSchemas';
import { erstatningsopgoerelseSchema } from '../schemas/formSchemas';
import type { FormValidator, ValidationError, ValidationResult } from '../types/validation';

/**
 * Lag 1: Schema-validering via Zod
 *
 * Validerer:
 * - Datatyper
 * - Required felter
 * - Simple constraints (min/max, format, etc.)
 */
function validateSchema(values: unknown): ValidationError[] {
  const result = erstatningsopgoerelseSchema.safeParse(values);

  if (result.success) return [];

  return result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    severity: 'error' as const,
  }));
}

/**
 * Lag 2: Felt-uafhængige regler
 *
 * Validerer single-field constraints der ikke fanges af Zod schema
 */
function validateStandaloneRules(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];

  // Dato-interval validering: periodeFra <= periodeTil
  if (
    values.vedroererPeriodeFra &&
    values.vedroererPeriodeTil &&
    values.vedroererPeriodeFra > values.vedroererPeriodeTil
  ) {
    errors.push({
      path: 'vedroererPeriodeFra',
      message: 'Fra-dato må ikke være efter til-dato',
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Lag 3: Cross-field validering
 *
 * Validerer regler der afhænger af flere felter
 */

/**
 * Forlig ansvarsgrad: Enten procent ELLER brøk - ikke begge
 */
function validateForligAnsvarsgrad(values: ErstatningsopgoerelseValues): ValidationError[] {
  const hasProcent = values.forligAnsvarsgradProcent !== undefined;
  const hasBroek = Boolean(values.forligAnsvarsgradBroek?.trim());

  if (hasProcent && hasBroek) {
    return [
      {
        path: 'forligAnsvarsgradProcent',
        message: 'Både procent og brøk',
        severity: 'error',
      },
      {
        path: 'forligAnsvarsgradBroek',
        message: 'Både procent og brøk',
        severity: 'error',
      },
    ];
  }

  return [];
}

/**
 * Samlet validator for Erstatningsopgørelse
 *
 * Kører alle validerings-lag sekventielt og kombinerer errors
 */
export const erstatningsopgoerelseValidator: FormValidator<ErstatningsopgoerelseValues> = {
  validate(values: ErstatningsopgoerelseValues): ValidationResult {
    const errors: ValidationError[] = [
      ...validateSchema(values),
      ...validateStandaloneRules(values),
      ...validateForligAnsvarsgrad(values),
      // Tilføj flere cross-field regler her
    ];

    return {
      errors,
      isValid: errors.length === 0,
    };
  },
};

export default erstatningsopgoerelseValidator;
