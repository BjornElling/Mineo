import { toISODateString } from '../../../types/branded';
import { calculateFerieHverdageMinusSHDage } from '../../../domain/erstatningsopgoerelse/engines/ferieCalculations';

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

  it('returnerer null ved undefined fra', () => {
    expect(calculateFerieHverdageMinusSHDage(undefined, iso('2024-01-31'))).toBeNull();
  });

  it('returnerer null ved undefined til', () => {
    expect(calculateFerieHverdageMinusSHDage(iso('2024-01-01'), undefined)).toBeNull();
  });

  it('returnerer null ved fra > til (inverteret interval)', () => {
    expect(calculateFerieHverdageMinusSHDage(iso('2024-01-10'), iso('2024-01-01'))).toBeNull();
  });

  it('fuld arbejdsuge (man-fre) uden SH → 5 hverdage', () => {
    // 2024-01-08 = mandag, 2024-01-12 = fredag, ingen helligdage
    const result = calculateFerieHverdageMinusSHDage(iso('2024-01-08'), iso('2024-01-12'));
    expect(result).toBe(5);
  });

  it('skærtorsdag + langfredag 2024 → 0 (2 SH-dage = 2 hverdage)', () => {
    // 2024-03-28 = skærtorsdag (SH), 2024-03-29 = langfredag (SH)
    // 2 hverdage - 2 SH = 0
    const result = calculateFerieHverdageMinusSHDage(iso('2024-03-28'), iso('2024-03-29'));
    expect(result).toBe(0);
  });

  it('returnerer aldrig negativt (Math.max(0, ...))', () => {
    // Bekræft at resultatet altid er >= 0
    // Juledag 2024 (onsdag SH) + juledag 2024: 1 hverdag - 1 SH = 0 (aldrig -1)
    const result = calculateFerieHverdageMinusSHDage(iso('2024-12-25'), iso('2024-12-25'));
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('periode der krydser nytår tæller helligdage fra begge år', () => {
    // 2023-12-25 (man/juledag SH), 2023-12-26 (tir/anden juledag SH), 2024-01-01 (man/nytår SH) = 3 SH
    // 2023-12-25 til 2024-01-01 = 8 dage: man(SH), tir(SH), ons, tor, fre, lør, søn, man(SH)
    // Hverdage: man(25), tir(26), ons(27), tor(28), fre(29), man(01) = 6 hverdage
    // 6 hverdage - 3 SH = 3 hverdage
    const result = calculateFerieHverdageMinusSHDage(iso('2023-12-25'), iso('2024-01-01'));
    expect(result).toBe(3);
  });
});
