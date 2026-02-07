import { toISODateString } from '../../types/branded';
import { beregnHelligdage, beregnHelligdageMedNavn, beregnSHDageForDatoSet } from '../../utils/shDageBeregning';

describe('beregnHelligdageMedNavn', () => {
  it('returnerer samme antal helligdage som beregnHelligdage', () => {
    for (const year of [2020, 2023, 2024, 2025]) {
      const unnamed = beregnHelligdage(year);
      const named = beregnHelligdageMedNavn(year);
      expect(named.length).toBe(unnamed.length);
    }
  });

  it('returnerer korrekte navne for 2024 (uden store bededag)', () => {
    const helligdage = beregnHelligdageMedNavn(2024);
    const navne = helligdage.map((h) => h.navn);
    expect(navne).toContain('Nytårsdag');
    expect(navne).toContain('Skærtorsdag');
    expect(navne).toContain('Langfredag');
    expect(navne).toContain('Påskedag');
    expect(navne).toContain('Anden påskedag');
    expect(navne).toContain('Kristi himmelfartsdag');
    expect(navne).toContain('Pinsedag');
    expect(navne).toContain('Anden pinsedag');
    expect(navne).toContain('Juledag');
    expect(navne).toContain('Anden juledag');
    expect(navne).not.toContain('Store bededag');
  });

  it('inkluderer store bededag for 2023 og før', () => {
    const helligdage2023 = beregnHelligdageMedNavn(2023);
    const navne2023 = helligdage2023.map((h) => h.navn);
    expect(navne2023).toContain('Store bededag');
  });

  it('returnerer datoer der matcher beregnHelligdage', () => {
    const year = 2024;
    const unnamed = beregnHelligdage(year);
    const named = beregnHelligdageMedNavn(year);

    const unnamedTimes = unnamed.map((d) => d.getTime()).sort((a, b) => a - b);
    const namedTimes = named.map((h) => h.date.getTime()).sort((a, b) => a - b);
    expect(namedTimes).toEqual(unnamedTimes);
  });

  it('nytårsdag er 1. januar', () => {
    const helligdage = beregnHelligdageMedNavn(2024);
    const nytaar = helligdage.find((h) => h.navn === 'Nytårsdag');
    expect(nytaar).toBeDefined();
    expect(nytaar!.date.getUTCMonth()).toBe(0);
    expect(nytaar!.date.getUTCDate()).toBe(1);
  });

  it('juledag er 25. december', () => {
    const helligdage = beregnHelligdageMedNavn(2024);
    const jul = helligdage.find((h) => h.navn === 'Juledag');
    expect(jul).toBeDefined();
    expect(jul!.date.getUTCMonth()).toBe(11);
    expect(jul!.date.getUTCDate()).toBe(25);
  });

  it('matcher SH-dage mod ISO-datoer uden timezone-shift', () => {
    const datoSet = new Set([toISODateString('2024-12-25')]);
    expect(beregnSHDageForDatoSet(datoSet)).toBe(1);
  });
});
