import {
  assertNoInteriorYearGap,
  assertStrictlyMonotonicByDanishDate,
  resolveSeriesCoverageInterval,
  resolveUnorderedSeriesCoverageInterval,
} from '../../data/rateSeriesIntegrity';
import { toDanishDateString } from '../../types/branded';

// De syv reguleringssatskilders load-guards. Importeret her ét sted, så completeness-testen
// nedenfor beviser at hver kilde HAR en load-guard, og at de faktiske (indlæste) data
// passerer (import kaster ved korrupt data, fordi hver guard kaldes ved modul-load).
import { assertStatistikAarKontinuitet } from '../../data/statistiskeRates';
import { assertAarsloenAslMaxKontinuitet } from '../../data/lovbestemteRates';
import { assertKRLCombinedDataIntegritet } from '../../data/krlRates';
import { assertKlLoenaftalerDataIntegritet } from '../../data/klLoenaftaler';
import { assertOverenskomstSatserNyesteFoerst } from '../../data/overenskomstRates';
import { assertOffentligLoenDataIntegritet } from '../../data/offentligLoenLookup';
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

  describe('resolveSeriesCoverageInterval', () => {
    const asSeries = (...datoer: string[]) =>
      datoer.map((fraDato) => ({ fraDato: toDanishDateString(fraDato) }));
    const getDato = (item: { fraDato: ReturnType<typeof toDanishDateString> }) => item.fraDato;

    it('læser ældste fra seriens start og nyeste fra dens slut ved ascending', () => {
      const result = resolveSeriesCoverageInterval({
        series: asSeries('01-04-2020', '01-10-2020', '01-04-2021'),
        getDato,
        order: 'ascending',
        periodeMaaneder: 6,
      });
      expect(result).toEqual({ fraDato: '01-04-2020', tilDato: '30-09-2021' });
    });

    it('læser ældste fra seriens slut og nyeste fra dens start ved descending', () => {
      const result = resolveSeriesCoverageInterval({
        series: asSeries('01-04-2021', '01-10-2020', '01-04-2020'),
        getDato,
        order: 'descending',
        periodeMaaneder: 6,
      });
      expect(result).toEqual({ fraDato: '01-04-2020', tilDato: '30-09-2021' });
    });

    /**
     * Selve grunden til at retningen er et ARGUMENT og ikke en kommentar: samme serie læst med
     * den forkerte retning giver et spejlvendt, meningsløst interval. Testen måler præcis den
     * mekanisme — ikke bare "funktionen returnerer noget".
     */
    it('giver et spejlvendt interval hvis retningen ikke matcher seriens sortering', () => {
      const nyesteFoerst = asSeries('01-04-2021', '01-10-2020', '01-04-2020');
      const korrekt = resolveSeriesCoverageInterval({
        series: nyesteFoerst, getDato, order: 'descending', periodeMaaneder: 6,
      });
      const forkert = resolveSeriesCoverageInterval({
        series: nyesteFoerst, getDato, order: 'ascending', periodeMaaneder: 6,
      });
      expect(korrekt).toEqual({ fraDato: '01-04-2020', tilDato: '30-09-2021' });
      // fraDato er nu seriens NYESTE og tilDato afledt af dens ÆLDSTE — intervallet dækker intet.
      expect(forkert).toEqual({ fraDato: '01-04-2021', tilDato: '30-09-2020' });
      expect(forkert).not.toEqual(korrekt);
    });

    it('bruger periodeMaaneder til slutdatoen (6 vs. 12 måneder − 1 dag)', () => {
      const series = asSeries('01-04-2020');
      expect(resolveSeriesCoverageInterval({ series, getDato, order: 'ascending', periodeMaaneder: 6 }))
        .toEqual({ fraDato: '01-04-2020', tilDato: '30-09-2020' });
      expect(resolveSeriesCoverageInterval({ series, getDato, order: 'ascending', periodeMaaneder: 12 }))
        .toEqual({ fraDato: '01-04-2020', tilDato: '31-03-2021' });
    });

    it('håndterer én-element-serie (ældste = nyeste) i begge retninger', () => {
      const series = asSeries('01-04-2020');
      const forventet = { fraDato: '01-04-2020', tilDato: '30-09-2020' };
      expect(resolveSeriesCoverageInterval({ series, getDato, order: 'ascending', periodeMaaneder: 6 })).toEqual(forventet);
      expect(resolveSeriesCoverageInterval({ series, getDato, order: 'descending', periodeMaaneder: 6 })).toEqual(forventet);
    });

    it('er fail-closed ved tom serie', () => {
      expect(resolveSeriesCoverageInterval({ series: [], getDato, order: 'ascending', periodeMaaneder: 6 }))
        .toBeUndefined();
    });

    it('er fail-closed ved uparsbar nyeste dato frem for at returnere et halvt interval', () => {
      const series = [{ fraDato: 'ikke-en-dato' as ReturnType<typeof toDanishDateString> }];
      expect(resolveSeriesCoverageInterval({ series, getDato, order: 'ascending', periodeMaaneder: 6 }))
        .toBeUndefined();
    });
  });

  describe('resolveUnorderedSeriesCoverageInterval', () => {
    type Kvartal = Readonly<{ key: number; start: string }>;
    const opts = (series: readonly Kvartal[], periodeMaaneder = 12) => ({
      series,
      getSortKey: (item: Kvartal) => item.key,
      getStartDato: (item: Kvartal) => toDanishDateString(item.start),
      periodeMaaneder,
    });

    /** Kernen: resultatet må IKKE afhænge af lagringsrækkefølgen. */
    it('giver samme interval uanset seriens rækkefølge', () => {
      const stigende: readonly Kvartal[] = [
        { key: 20201, start: '01-01-2020' },
        { key: 20211, start: '01-01-2021' },
        { key: 20221, start: '01-01-2022' },
      ];
      const forventet = { fraDato: '01-01-2020', tilDato: '31-12-2022' };
      expect(resolveUnorderedSeriesCoverageInterval(opts(stigende))).toEqual(forventet);
      expect(resolveUnorderedSeriesCoverageInterval(opts([...stigende].reverse()))).toEqual(forventet);
      expect(resolveUnorderedSeriesCoverageInterval(opts([stigende[1], stigende[2], stigende[0]])))
        .toEqual(forventet);
    });

    it('vælger enderne efter sorteringsnøglen, ikke efter positionen', () => {
      // Den ældste står i MIDTEN og den nyeste FØRST — begge positionelle opslag ville fejle.
      const rodet: readonly Kvartal[] = [
        { key: 20224, start: '01-10-2022' },
        { key: 20191, start: '01-01-2019' },
        { key: 20203, start: '01-07-2020' },
      ];
      expect(resolveUnorderedSeriesCoverageInterval(opts(rodet)))
        .toEqual({ fraDato: '01-01-2019', tilDato: '30-09-2023' });
    });

    it('håndterer én-element-serie', () => {
      expect(resolveUnorderedSeriesCoverageInterval(opts([{ key: 20201, start: '01-01-2020' }])))
        .toEqual({ fraDato: '01-01-2020', tilDato: '31-12-2020' });
    });

    it('er fail-closed ved tom serie', () => {
      expect(resolveUnorderedSeriesCoverageInterval(opts([]))).toBeUndefined();
    });

    it('er fail-closed ved uparsbar nyeste startdato', () => {
      expect(resolveUnorderedSeriesCoverageInterval({
        series: [
          { key: 20201, start: '01-01-2020' },
          { key: 20211, start: 'ikke-en-dato' },
        ],
        getSortKey: (item: Kvartal) => item.key,
        // Bevidst uden om brand-konstruktøren: det er PRIMITIVETS fail-closed-adfærd der måles,
        // ikke `toDanishDateString`s validering.
        getStartDato: (item: Kvartal) => item.start as ReturnType<typeof toDanishDateString>,
        periodeMaaneder: 12,
      })).toBeUndefined();
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
    { kilde: 'Offentlige lønsatser (KL/RLTN)', guard: assertOffentligLoenDataIntegritet },
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
