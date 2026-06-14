import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { DEFAULT_FRACTION_MAX_DIGITS, parseFractionString } from '../../../utils/fraction';
import { formatPercent } from '../../../utils/formatUtils';

export type Forligsgrad = Readonly<{
  factor: number;
  label: string;
}> | null;

export const parseForligsgrad = (
  values: Pick<ErstatningsopgoerelseValues, 'forligAnsvarsgradProcent' | 'forligAnsvarsgradBroek'>
): Forligsgrad => {
  const procentValue = values.forligAnsvarsgradProcent;
  if (typeof procentValue === 'number' && Number.isFinite(procentValue) && procentValue > 0 && procentValue <= 100) {
    return {
      factor: procentValue / 100,
      // Kanonisk dansk procentformat (komma-decimal + mellemrum): 12,5 → "12,5 %", 50 → "50 %".
      label: formatPercent(procentValue),
    };
  }

  const broekValue = values.forligAnsvarsgradBroek;
  if (typeof broekValue === 'string' && broekValue.trim() !== '') {
    const result = parseFractionString(broekValue, {
      maxDigits: DEFAULT_FRACTION_MAX_DIGITS,
      allowNegative: false,
      allowZeroNumerator: false,
      canonicalizeOnCommit: false,
    });
    if (result.ok && result.parsed.numerator <= result.parsed.denominator) {
      return {
        factor: result.parsed.factor,
        label: result.parsed.value,
      };
    }
  }

  return null;
};
