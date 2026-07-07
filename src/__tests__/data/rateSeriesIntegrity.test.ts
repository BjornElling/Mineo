import {
  assertNoInteriorYearGap,
  assertStrictlyMonotonicByDanishDate,
} from '../../data/rateSeriesIntegrity';

// De syv reguleringssatskilders load-guards. Importeret her ét sted, så completeness-testen
// nedenfor beviser at hver kilde HAR en load-guard, og at de faktiske (indlæste) data
// passerer (import kaster ved korrupt data, fordi hver guard kaldes ved modul-load).
import { assertStatistikAarKontinuitet } from '../../data/statistiskeRates';
import { assertAarsloenAslMaxKontinuitet } from '../../data/lovbestemteRates';
import { assertKRLCombinedDataIntegritet } from '../../data/krlRates';
import { assertKlLoenaftalerDataIntegritet } from '../../data/klLoenaftaler';
import { assertOverenskomstSatserNyesteFoerst } from '../../data/overenskomstRates';
import { assertOffentligLoenTabelIkkeTom } from '../../data/offentligLoenLookup';
import { assertSygedagpengeRatesIntegritet } from '../../data/sygedagpengeRates';

describe('rateSeriesIntegrity — delte integritets-primitiver', () => {
  describe('assertStrictlyMonotonicByDanishDate', () => {
    const asItems = (...datoer: string[]) => datoer.map((fraDato) => ({ fraDato }));
    const opts = (order: 'ascending' | 'descending') => ({
      getDato: (item: { fraDato: string }) => item.fraDato,
      order,
      label: 'Testkilde',
    });

    it('accepterer tom serie (vacuøst sorteret)', () => {
      expect(() => assertStrictlyMonotonicByDanishDate([], opts('ascending'))).not.toThrow();
      expect(() => assertStrictlyMonotonicByDanishDate([], opts('descending'))).not.toThrow();
    });

    it('accepterer én enkelt række', () => {
      expect(() => assertStrictlyMonotonicByDanishDate(asItems('01-04-2020'), opts('ascending'))).not.toThrow();
    });

    it('accepterer strengt stigende (ældste-først)', () => {
      const items = asItems('01-04-2020', '01-10-2020', '01-01-2021');
      expect(() => assertStrictlyMonotonicByDanishDate(items, opts('ascending'))).not.toThrow();
    });

    it('accepterer strengt faldende (nyeste-først)', () => {
      const items = asItems('01-01-2021', '01-10-2020', '01-04-2020');
      expect(() => assertStrictlyMonotonicByDanishDate(items, opts('descending'))).not.toThrow();
    });

    it('kaster ved forkert retning (stigende data mod descending-krav)', () => {
      const items = asItems('01-04-2020', '01-10-2020');
      expect(() => assertStrictlyMonotonicByDanishDate(items, opts('descending'))).toThrow(/rækkefølgen/);
    });

    it('kaster ved forkert retning (faldende data mod ascending-krav)', () => {
      const items = asItems('01-10-2020', '01-04-2020');
      expect(() => assertStrictlyMonotonicByDanishDate(items, opts('ascending'))).toThrow(/rækkefølgen/);
    });

    it('kaster ved duplikeret dato (ikke strengt monotont) — begge retninger', () => {
      const items = asItems('01-04-2020', '01-04-2020');
      expect(() => assertStrictlyMonotonicByDanishDate(items, opts('ascending'))).toThrow(/rækkefølgen/);
      expect(() => assertStrictlyMonotonicByDanishDate(items, opts('descending'))).toThrow(/rækkefølgen/);
    });

    it('kaster ved uparsbar dato', () => {
      const items = asItems('ikke-en-dato');
      expect(() => assertStrictlyMonotonicByDanishDate(items, opts('ascending'))).toThrow(/ugyldig fraDato/);
    });

    it('fejlbesked inkluderer kilde-label og retning', () => {
      const items = asItems('01-04-2020', '01-10-2020');
      expect(() => assertStrictlyMonotonicByDanishDate(items, opts('descending'))).toThrow(
        /Testkilde: satserne skal være sorteret strengt nyeste-først/
      );
    });
  });

  describe('assertNoInteriorYearGap', () => {
    const present = (years: number[]) => (year: number) => years.includes(year);

    it('accepterer en sammenhængende serie', () => {
      expect(() =>
        assertNoInteriorYearGap({
          minYear: 2020,
          maxYear: 2023,
          isYearPresent: present([2020, 2021, 2022, 2023]),
          label: 'Testkilde',
        })
      ).not.toThrow();
    });

    it('accepterer et enkelt år (min = max)', () => {
      expect(() =>
        assertNoInteriorYearGap({
          minYear: 2024,
          maxYear: 2024,
          isYearPresent: present([2024]),
          label: 'Testkilde',
        })
      ).not.toThrow();
    });

    it('kaster ved et interiort hul og navngiver det manglende år', () => {
      expect(() =>
        assertNoInteriorYearGap({
          minYear: 2020,
          maxYear: 2022,
          isYearPresent: present([2020, 2022]),
          label: 'Testkilde',
        })
      ).toThrow(/mangler år 2021/);
    });

    it('kaster på det første manglende år ved flere huller', () => {
      expect(() =>
        assertNoInteriorYearGap({
          minYear: 2018,
          maxYear: 2021,
          isYearPresent: present([2018, 2021]),
          label: 'Testkilde',
        })
      ).toThrow(/mangler år 2019/);
    });

    it('fejlbesked forklarer tavs under-regulering', () => {
      expect(() =>
        assertNoInteriorYearGap({
          minYear: 2020,
          maxYear: 2022,
          isYearPresent: present([2020, 2022]),
          label: 'Testkilde',
        })
      ).toThrow(/tavs under-regulering/);
    });
  });
});

describe('reguleringssatskilder — komplet load-guard-dækning', () => {
  // Kanonisk liste over ALLE reguleringssatskilder og deres load-guard. Formålet er
  // R5's "ingen kilde kan mangle et værn": tilføjes en ny reguleringssatskilde, SKAL den
  // både have en load-guard (der kaldes ved modul-load i datafilen) og en post her.
  // At denne testfil overhovedet importerer datamodulerne beviser samtidig, at de
  // faktiske data passerer deres guard ved load (ellers ville import kaste).
  const GUARDS: ReadonlyArray<{ readonly kilde: string; readonly guard: unknown }> = [
    { kilde: 'Statistisk lønindeks (ILON12/SBLON2)', guard: assertStatistikAarKontinuitet },
    { kilde: 'ASL-årslønsmaksimum', guard: assertAarsloenAslMaxKontinuitet },
    { kilde: 'KRL-satstabel', guard: assertKRLCombinedDataIntegritet },
    { kilde: 'KL-lønaftaler', guard: assertKlLoenaftalerDataIntegritet },
    { kilde: 'Overenskomst-satser (privat + offentlig)', guard: assertOverenskomstSatserNyesteFoerst },
    { kilde: 'Offentlige lønsatser (KL/RLTN)', guard: assertOffentligLoenTabelIkkeTom },
    { kilde: 'Sygedagpengesatser', guard: assertSygedagpengeRatesIntegritet },
  ];

  it('dækker præcis de syv kendte reguleringssatskilder', () => {
    expect(GUARDS).toHaveLength(7);
    expect(new Set(GUARDS.map((g) => g.kilde)).size).toBe(7);
  });

  it.each(GUARDS.map((g) => [g.kilde, g.guard] as const))(
    'har en callable load-guard for %s',
    (_kilde, guard) => {
      expect(typeof guard).toBe('function');
    }
  );
});
