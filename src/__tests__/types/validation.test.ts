import type { ValidationError, ValidationResult, FormValidator, FieldPath, ValidationSeverity } from '../../types/validation';

// Note: validation.ts eksporterer kun typer — ingen runtime-funktioner at teste.
// Disse tests er strukturelle kontrakter der sikrer typernes form.

describe('ValidationError', () => {
  it('minimal error: kun path og message', () => {
    const error: ValidationError = {
      path: 'forligAnsvarsgradProcent',
      message: 'Skal udfyldes',
    };
    expect(error.path).toBe('forligAnsvarsgradProcent');
    expect(error.message).toBe('Skal udfyldes');
    expect(error.severity).toBeUndefined();
  });

  it('error med severity', () => {
    const error: ValidationError = {
      path: 'svieSmertePerioder[0].fra',
      message: 'Ugyldig dato',
      severity: 'error',
    };
    expect(error.severity).toBe('error');
  });

  it('warning severity', () => {
    const error: ValidationError = {
      path: 'feriedage',
      message: 'Mulig fejl',
      severity: 'warning',
    };
    expect(error.severity).toBe('warning');
  });

  it('path understøtter nested array notation', () => {
    const path: FieldPath = 'svieSmertePerioder[0].fra';
    const error: ValidationError = { path, message: 'Fejl' };
    expect(error.path).toContain('[0]');
  });
});

describe('ValidationResult', () => {
  it('gyldig resultat: ingen errors', () => {
    const result: ValidationResult = { errors: [], isValid: true };
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('invalid resultat: har errors', () => {
    const result: ValidationResult = {
      errors: [{ path: 'felt', message: 'Fejl' }],
      isValid: false,
    };
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

describe('FormValidator', () => {
  it('validator implementering er pure og deterministisk', () => {
    type TestValues = { navn: string };
    const validator: FormValidator<TestValues> = {
      validate: (values) => ({
        errors: values.navn.trim() === ''
          ? [{ path: 'navn', message: 'Krævet' }]
          : [],
        isValid: values.navn.trim() !== '',
      }),
    };

    const emptyResult = validator.validate({ navn: '' });
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.errors).toHaveLength(1);

    const validResult = validator.validate({ navn: 'Test' });
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
  });
});

describe('ValidationSeverity', () => {
  it('er enten "error" eller "warning"', () => {
    const a: ValidationSeverity = 'error';
    const b: ValidationSeverity = 'warning';
    expect(['error', 'warning']).toContain(a);
    expect(['error', 'warning']).toContain(b);
  });
});
