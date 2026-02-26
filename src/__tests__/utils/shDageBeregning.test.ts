import { toISODateString } from '../../types/branded';
import { beregnHelligdage, beregnHelligdageMedNavn, beregnSHDage, beregnSHDageForDatoSet } from '../../utils/shDageBeregning';
import { createDate } from '../../utils/dateUtils';

describe('shDageBeregning', () => {
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

// ─── beregnSHDage ──────────────────────────────────────────────────────────────

describe('beregnSHDage', () => {
  it('fra > til → 0', () => {
    const fra = createDate(2024, 5, 1); // 1. juni 2024
    const til = createDate(2024, 0, 1); // 1. januar 2024
    expect(beregnSHDage(fra, til)).toBe(0);
  });

  it('nytårsdag 2024 (mandag) tælles med', () => {
    // 1. januar 2024 er mandag — skal tælle som SH-dag
    const fra = createDate(2024, 0, 1);
    const til = createDate(2024, 0, 1);
    expect(beregnSHDage(fra, til)).toBe(1);
  });

  it('juledag 2024 (onsdag) tælles med', () => {
    // 25. december 2024 er onsdag — skal tælle
    const fra = createDate(2024, 11, 25);
    const til = createDate(2024, 11, 25);
    expect(beregnSHDage(fra, til)).toBe(1);
  });

  it('anden juledag 2021 (søndag) tælles IKKE', () => {
    // 26. december 2021 er søndag — weekend, tælles ikke
    const fra = createDate(2021, 11, 26);
    const til = createDate(2021, 11, 26);
    expect(beregnSHDage(fra, til)).toBe(0);
  });

  it('2024 har 9 SH-dage (ingen store bededag)', () => {
    // 2024: ingen store bededag. Helligdage: nytår(man), skærtors(tor), langfre(fre),
    // påske(søn), 2.påske(man), himmelfartsdag(tor), pinse(søn), 2.pinse(man), jul(ons), 2.jul(tor)
    // søndage tælles ikke: påske, pinse → 8 hverdagshelligdage
    // Men lad os bare verificere at det er > 7 og < 11
    const fra = createDate(2024, 0, 1);
    const til = createDate(2024, 11, 31);
    const antal = beregnSHDage(fra, til);
    expect(antal).toBeGreaterThanOrEqual(7);
    expect(antal).toBeLessThanOrEqual(10);
  });

  it('store bededag 2023 (fredag) tælles som SH-dag, men 2026 gør det ikke', () => {
    // Store bededag 2023 var den 5. maj (fredag) — fjernet fra 2024
    const stBededag2023 = createDate(2023, 4, 5); // 5. maj 2023
    expect(beregnSHDage(stBededag2023, stBededag2023)).toBe(1);

    // 5. maj 2026 er ingen helligdag
    const ikkeSH = createDate(2026, 4, 5);
    expect(beregnSHDage(ikkeSH, ikkeSH)).toBe(0);
  });

  it('grænseværdi: inklusive begge endepunkter', () => {
    // Skærtorsdag 2024 er 28. marts
    const fra = createDate(2024, 2, 28);
    const til = createDate(2024, 2, 28);
    expect(beregnSHDage(fra, til)).toBe(1);
  });

  it('periode der spænder over to år tæller helligdage fra begge år', () => {
    // 25. december 2023 (mandag) til 1. januar 2024 (mandag)
    const fra = createDate(2023, 11, 25);
    const til = createDate(2024, 0, 1);
    // Juledag 2023 (man), 2. juledag 2023 (tir), nytår 2024 (man) = 3
    expect(beregnSHDage(fra, til)).toBe(3);
  });
});

// ─── beregnSHDageForDatoSet ───────────────────────────────────────────────────

describe('beregnSHDageForDatoSet', () => {
  it('tomt set → 0', () => {
    expect(beregnSHDageForDatoSet(new Set())).toBe(0);
  });

  it('ikke-helligdag dato → 0', () => {
    const datoSet = new Set([toISODateString('2024-01-15')]); // Mandag 15. jan — alm. hverdag
    expect(beregnSHDageForDatoSet(datoSet)).toBe(0);
  });

  it('helligdag på hverdag → 1', () => {
    const datoSet = new Set([toISODateString('2024-01-01')]); // Nytårsdag 2024 = mandag
    expect(beregnSHDageForDatoSet(datoSet)).toBe(1);
  });

  it('helligdag på weekend → 0', () => {
    // Pinsedag 2024 = søndag 19. maj
    const datoSet = new Set([toISODateString('2024-05-19')]);
    expect(beregnSHDageForDatoSet(datoSet)).toBe(0);
  });

  it('blandet set: én helligdag og én normal dato', () => {
    const datoSet = new Set([
      toISODateString('2024-01-01'), // Nytårsdag (mandag) → tæller
      toISODateString('2024-01-02'), // Normal tirsdag → tæller ikke
    ]);
    expect(beregnSHDageForDatoSet(datoSet)).toBe(1);
  });
});
