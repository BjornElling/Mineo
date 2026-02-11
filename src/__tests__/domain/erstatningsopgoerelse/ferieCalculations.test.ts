import { toISODateString } from '../../../types/branded';
import { calculateFerieHverdageMinusSHDage } from '../../../domain/erstatningsopgoerelse/ferieCalculations';

const iso = (value: string) => toISODateString(value);

describe('calculateFerieHverdageMinusSHDage', () => {
  it('returnerer 0 for weekender', () => {
    const result = calculateFerieHverdageMinusSHDage(iso('2024-01-06'), iso('2024-01-07'));
    expect(result).toBe(0);
  });

  it('returnerer 1 for en enkelt hverdag uden SH', () => {
    const result = calculateFerieHverdageMinusSHDage(iso('2024-01-02'), iso('2024-01-02'));
    expect(result).toBe(1);
  });

  it('fratrækker SH-dag hvis den er hverdag', () => {
    const result = calculateFerieHverdageMinusSHDage(iso('2024-12-25'), iso('2024-12-25'));
    expect(result).toBe(0);
  });
});
