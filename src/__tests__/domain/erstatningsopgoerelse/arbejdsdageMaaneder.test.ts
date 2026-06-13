import { toISODateString } from '../../../types/branded';
import { beregnArbejdsdageOgMaaneder } from '../../../domain/erstatningsopgoerelse/engines/arbejdsdageMaaneder';
import { roundByMethod } from '../../../utils/rounding';

const iso = (value: string) => toISODateString(value);

describe('beregnArbejdsdageOgMaaneder', () => {
  it('beregner arbejdsdage og måned-fraktion for en enkelt hverdag', () => {
    const result = beregnArbejdsdageOgMaaneder(
      iso('2024-01-02'),
      iso('2024-01-02'),
      new Set(),
      new Set()
    );

    expect(result.arbejdsdage).toBe(1);
    expect(result.maaneder).toBeCloseTo(roundByMethod(1 / 31, 6, 'halfAwayFromZero'), 6);
  });

  it('giver 1,00 måned for hele januar 2024', () => {
    const result = beregnArbejdsdageOgMaaneder(
      iso('2024-01-01'),
      iso('2024-01-31'),
      new Set(),
      new Set()
    );

    expect(result.maaneder).toBe(1);
    expect(result.arbejdsdage).toBe(23);
  });

  it('fratrækker SH- og feriedage fra arbejdsdage', () => {
    const sh = new Set([iso('2024-01-02')]);
    const ferie = new Set<ReturnType<typeof iso>>([iso('2024-01-03')]);
    const result = beregnArbejdsdageOgMaaneder(
      iso('2024-01-02'),
      iso('2024-01-03'),
      sh,
      ferie
    );

    expect(result.arbejdsdage).toBe(0);
  });

  it('lørdag og søndag tæller ikke som arbejdsdage', () => {
    // 2024-01-06 = lørdag, 2024-01-07 = søndag
    const result = beregnArbejdsdageOgMaaneder(
      iso('2024-01-06'),
      iso('2024-01-07'),
      new Set(),
      new Set()
    );
    expect(result.arbejdsdage).toBe(0);
  });

  it('dag der er både SH og ferie ekskluderes kun én gang (ikke negativ)', () => {
    // 2024-01-01 = nytårsdag (SH) og feriedag
    const sh = new Set([iso('2024-01-01')]);
    const ferie = new Set([iso('2024-01-01')]);
    const result = beregnArbejdsdageOgMaaneder(
      iso('2024-01-01'),
      iso('2024-01-01'),
      sh,
      ferie
    );
    expect(result.arbejdsdage).toBe(0);
  });

  it('periode der krydser nytår tæller arbejdsdage korrekt', () => {
    // 2024-12-30 (man), 2024-12-31 (tirs), 2025-01-01 (ons, SH nytår), 2025-01-02 (tor)
    const sh = new Set([iso('2025-01-01')]);
    const result = beregnArbejdsdageOgMaaneder(
      iso('2024-12-30'),
      iso('2025-01-02'),
      sh,
      new Set()
    );
    // 4 hverdage - 1 SH = 3
    expect(result.arbejdsdage).toBe(3);
    // Måneder > 0
    expect(result.maaneder).toBeGreaterThan(0);
  });

  it('tom SH og ferie-set → kun ugedage tæller', () => {
    // 2024-01-08 (man) til 2024-01-12 (fre) = 5 hverdage
    const result = beregnArbejdsdageOgMaaneder(
      iso('2024-01-08'),
      iso('2024-01-12'),
      new Set(),
      new Set()
    );
    expect(result.arbejdsdage).toBe(5);
  });

  it('omvendt interval (fra > til) → 0 arbejdsdage og 0 måneder (ingen NaN)', () => {
    // iterateDatesInclusive itererer ikke ved fra > til, og optaelMaanederPraecis returnerer
    // null → maaneder falder tilbage til 0. Resultatet skal være endeligt, ikke NaN.
    const result = beregnArbejdsdageOgMaaneder(
      iso('2024-01-31'),
      iso('2024-01-01'),
      new Set(),
      new Set()
    );
    expect(result.arbejdsdage).toBe(0);
    expect(result.maaneder).toBe(0);
    expect(Number.isNaN(result.maaneder)).toBe(false);
  });

  it('SH-/ferie-dag uden for intervallet påvirker ikke tællingen', () => {
    // SH/ferie-sættene må kun reducere dage der faktisk ligger i intervallet.
    const sh = new Set([iso('2023-12-25')]);
    const ferie = new Set([iso('2024-02-01')]);
    const result = beregnArbejdsdageOgMaaneder(
      iso('2024-01-08'),
      iso('2024-01-12'),
      sh,
      ferie
    );
    expect(result.arbejdsdage).toBe(5);
  });
});
