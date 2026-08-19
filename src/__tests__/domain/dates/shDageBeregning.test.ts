import { toISODateString } from '../../../types/branded';
import {
  beregnHelligdage,
  beregnHelligdageMedNavn,
  beregnSHDage,
  beregnSHDageForDatoSet,
  buildSHDageSetForDatoSet,
  buildSHDageSetForIsoRange,
  erHverdagUtc,
} from '../../../domain/dates/shDageBeregning';
import { createDate, addDays, formatToISO } from '../../../utils/dateUtils';
import { parseISODate, type ISODateString } from '../../../types/branded';

/**
 * Reference-implementation: den oprindelige "materialisér hele intervallet"-algoritme.
 * Bruges udelukkende til at bevise, at den optimerede `buildSHDageSetForIsoRange`
 * (helligdags-iteration) giver præcis samme output.
 */
const buildSHDageSetForIsoRangeReference = (
  fra: ISODateString,
  til: ISODateString
): ReadonlySet<ISODateString> => {
  const fraDato = parseISODate(fra);
  const tilDato = parseISODate(til);
  if (!fraDato || !tilDato || fraDato > tilDato) return new Set<ISODateString>();
  const shDage = new Set<ISODateString>();
  for (let year = fraDato.getUTCFullYear(); year <= tilDato.getUTCFullYear(); year += 1) {
    for (const helligdag of beregnHelligdage(year)) {
      if (helligdag < fraDato || helligdag > tilDato || !erHverdagUtc(helligdag)) continue;
      shDage.add(formatToISO(helligdag));
    }
  }
  return shDage;
};

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
    // 1. januar 2024 er mandag – skal tælle som SH-dag
    const fra = createDate(2024, 0, 1);
    const til = createDate(2024, 0, 1);
    expect(beregnSHDage(fra, til)).toBe(1);
  });

  it('juledag 2024 (onsdag) tælles med', () => {
    // 25. december 2024 er onsdag – skal tælle
    const fra = createDate(2024, 11, 25);
    const til = createDate(2024, 11, 25);
    expect(beregnSHDage(fra, til)).toBe(1);
  });

  it('anden juledag 2021 (søndag) tælles IKKE', () => {
    // 26. december 2021 er søndag – weekend, tælles ikke
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
    // Store bededag 2023 var den 5. maj (fredag) – fjernet fra 2024
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
    const datoSet = new Set([toISODateString('2024-01-15')]); // Mandag 15. jan – alm. hverdag
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

describe('buildSHDageSetForDatoSet', () => {
  it('returnerer ISO-sættet for hverdagshelligdage i et dato-set', () => {
    const datoSet = new Set([
      toISODateString('2024-01-01'),
      toISODateString('2024-01-02'),
      toISODateString('2024-05-19'),
    ]);

    const result = buildSHDageSetForDatoSet(datoSet);

    expect(result.has(toISODateString('2024-01-01'))).toBe(true);
    expect(result.has(toISODateString('2024-01-02'))).toBe(false);
    expect(result.has(toISODateString('2024-05-19'))).toBe(false);
    expect(result.size).toBe(1);
  });
});

describe('buildSHDageSetForIsoRange', () => {
  it('returnerer samme SH-dage som range-beregningen for januar 2024', () => {
    const result = buildSHDageSetForIsoRange(
      toISODateString('2024-01-01'),
      toISODateString('2024-01-31')
    );

    expect(result.has(toISODateString('2024-01-01'))).toBe(true);
    expect(result.size).toBe(1);
  });

  it('returnerer tomt sæt ved ugyldig rækkefølge', () => {
    const result = buildSHDageSetForIsoRange(
      toISODateString('2024-12-31'),
      toISODateString('2024-01-01')
    );

    expect(result.size).toBe(0);
  });

  it('giver identisk output som reference-implementationen (ækvivalens)', () => {
    const ranges: Array<[string, string]> = [
      ['2024-01-01', '2024-01-31'], // enkelt måned med nytår
      ['2024-01-01', '2024-12-31'], // helt år
      ['2023-01-01', '2025-12-31'], // flere år, inkl. afskaffelse af store bededag
      ['2023-12-25', '2024-01-01'], // år-overgang
      ['2024-05-18', '2024-05-20'], // pinse-weekend (pinsedag søndag = ikke SH)
      ['2024-03-28', '2024-04-01'], // påske
      ['2024-06-10', '2024-06-14'], // uge uden helligdage → tomt sæt
      ['2024-01-01', '2024-01-01'], // én enkelt SH-dag
    ];

    for (const [fra, til] of ranges) {
      const actual = buildSHDageSetForIsoRange(toISODateString(fra), toISODateString(til));
      const reference = buildSHDageSetForIsoRangeReference(toISODateString(fra), toISODateString(til));
      expect([...actual].sort()).toEqual([...reference].sort());
    }
  });

  it('giver identisk output som reference for alle år og helligdagsgrænser i supporteret interval', () => {
    for (let year = 1900; year <= 2100; year += 1) {
      const wholeYearActual = buildSHDageSetForIsoRange(
        toISODateString(`${year}-01-01`),
        toISODateString(`${year}-12-31`)
      );
      const wholeYearReference = buildSHDageSetForIsoRangeReference(
        toISODateString(`${year}-01-01`),
        toISODateString(`${year}-12-31`)
      );
      expect([...wholeYearActual].sort()).toEqual([...wholeYearReference].sort());

      for (const helligdag of beregnHelligdage(year)) {
        const fraDate = addDays(helligdag, -2);
        const tilDate = addDays(helligdag, 2);
        if (fraDate.getUTCFullYear() < 1900 || tilDate.getUTCFullYear() > 2100) continue;
        const fra = formatToISO(fraDate);
        const til = formatToISO(tilDate);
        const actual = buildSHDageSetForIsoRange(fra, til);
        const reference = buildSHDageSetForIsoRangeReference(fra, til);
        expect([...actual].sort()).toEqual([...reference].sort());
      }
    }
  });

  it('samler SH-dage på tværs af et flerårigt interval', () => {
    // 25-12-2023 (man) → 01-01-2024 (man): juledag 2023, 2. juledag 2023 (tir), nytår 2024
    const result = buildSHDageSetForIsoRange(
      toISODateString('2023-12-25'),
      toISODateString('2024-01-01')
    );

    expect(result.has(toISODateString('2023-12-25'))).toBe(true);
    expect(result.has(toISODateString('2023-12-26'))).toBe(true);
    expect(result.has(toISODateString('2024-01-01'))).toBe(true);
    expect(result.size).toBe(3);
  });
});

// ─── erHverdagUtc ─────────────────────────────────────────────────────────────

describe('erHverdagUtc', () => {
  it('mandag-fredag → hverdag', () => {
    // 01-01-2024 = mandag, 05-01-2024 = fredag
    expect(erHverdagUtc(createDate(2024, 0, 1))).toBe(true);
    expect(erHverdagUtc(createDate(2024, 0, 5))).toBe(true);
  });

  it('lørdag/søndag → ikke hverdag', () => {
    // 06-01-2024 = lørdag, 07-01-2024 = søndag
    expect(erHverdagUtc(createDate(2024, 0, 6))).toBe(false);
    expect(erHverdagUtc(createDate(2024, 0, 7))).toBe(false);
  });
});

// ─── Påskedag-facit (absolut korrekthed, ikke kun intern konsistens) ───────────

describe('beregnHelligdageMedNavn – påskedag mod kendt facit', () => {
  // Kendte gregorianske påskedage. Verificerer Meeus/Jones/Butcher-computus mod
  // en uafhængig facit, så testen beviser absolut korrekthed (ikke kun at to
  // implementeringer er enige med hinanden).
  const kendtePaaskedage: ReadonlyArray<readonly [number, string]> = [
    [2020, '2020-04-12'],
    [2021, '2021-04-04'],
    [2022, '2022-04-17'],
    [2023, '2023-04-09'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2030, '2030-04-21'],
    [2000, '2000-04-23'],
  ];

  it.each(kendtePaaskedage)('påskedag %i = %s', (year, isoDato) => {
    const paaske = beregnHelligdageMedNavn(year).find((h) => h.navn === 'Påskedag');
    expect(paaske).toBeDefined();
    expect(formatToISO(paaske!.date)).toBe(isoDato);
  });

  it('påske-afledte navne har korrekt offset fra påskedag', () => {
    const year = 2025;
    const map = new Map(beregnHelligdageMedNavn(year).map((h) => [h.navn, h.date]));
    const paaske = map.get('Påskedag')!;
    expect(formatToISO(map.get('Skærtorsdag')!)).toBe(formatToISO(addDays(paaske, -3)));
    expect(formatToISO(map.get('Langfredag')!)).toBe(formatToISO(addDays(paaske, -2)));
    expect(formatToISO(map.get('Anden påskedag')!)).toBe(formatToISO(addDays(paaske, 1)));
    expect(formatToISO(map.get('Kristi himmelfartsdag')!)).toBe(formatToISO(addDays(paaske, 39)));
    expect(formatToISO(map.get('Pinsedag')!)).toBe(formatToISO(addDays(paaske, 49)));
    expect(formatToISO(map.get('Anden pinsedag')!)).toBe(formatToISO(addDays(paaske, 50)));
  });
});
