export type NumericBoundsConfig = Readonly<{
  minValue?: number;
  maxValue?: number;
  allowNegative?: boolean;
}>;

/**
 * Fælles validering af numeriske bounds. Felttyperne ejer fortsat deres særlige
 * regler (fortegn, præcision og cifferlofter), men de grundlæggende bounds må
 * ikke få forskellig validering eller ordlyd på tværs af feltfamilien.
 */
export const getNumericBoundsConfigErrors = ({
  minValue,
  maxValue,
  allowNegative,
}: NumericBoundsConfig): readonly string[] => {
  const errors: string[] = [];

  if (minValue !== undefined && !Number.isFinite(minValue)) {
    errors.push('Ugyldig konfiguration: minValue skal være et tal');
  }
  if (maxValue !== undefined && !Number.isFinite(maxValue)) {
    errors.push('Ugyldig konfiguration: maxValue skal være et tal');
  }
  if (
    typeof minValue === 'number' &&
    Number.isFinite(minValue) &&
    typeof maxValue === 'number' &&
    Number.isFinite(maxValue) &&
    minValue > maxValue
  ) {
    errors.push('Ugyldig konfiguration: minValue er større end maxValue');
  }
  if (allowNegative === false && typeof minValue === 'number' && Number.isFinite(minValue) && minValue < 0) {
    errors.push('Ugyldig konfiguration: minValue er negativ, men allowNegative=false');
  }
  if (allowNegative === false && typeof maxValue === 'number' && Number.isFinite(maxValue) && maxValue < 0) {
    errors.push('Ugyldig konfiguration: maxValue er negativ, men allowNegative=false');
  }

  return errors;
};
