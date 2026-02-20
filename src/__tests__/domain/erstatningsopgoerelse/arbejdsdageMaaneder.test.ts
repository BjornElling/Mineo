import { toISODateString } from '../../../types/branded';
import { beregnArbejdsdageOgMaaneder } from '../../../domain/erstatningsopgoerelse/arbejdsdageMaaneder';
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
});
