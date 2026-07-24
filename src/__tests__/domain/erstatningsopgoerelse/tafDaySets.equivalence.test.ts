import type { ISODateString } from '../../../types/branded';
import { dateToISO } from '../../../types/branded';
import { isoDateToDate } from '../../../domain/dates/isoDate';
import { iterateDatesInclusive } from '../../../utils/isoDateHelpers';
import { buildShDageSetFromIsoRange, buildFerieDageSetForPeriode } from '../../../domain/erstatningsopgoerelse/engines/tafDaySets';

/**
 * Ækvivalens-net: beviser at den nye `buildFerieDageSetForPeriode` (tynd komposition
 * over produktions-primitiverne `buildFerieDageSet` + `placeLoseFeriedage`) giver
 * BYTE-IDENTISK output med den tidligere hånd-rullede kontrol-lag-implementering, for
 * alle schema-gyldige inputs.
 *
 * `referenceGammelImpl` er en verbatim kopi af den kode, kontrol-laget
 * (`eoInspektionRegulationCore`) brugte før konsolideringen. Den tager et *injiceret*
 * SH-sæt; den nye beregner SH internt. Referencen kaldes derfor med præcis det SH-sæt,
 * de rigtige kaldere leverede (`buildShDageSetFromIsoRange(fra, til)`), så testen
 * sammenligner æbler med æbler.
 */

type FerieInput = Readonly<{
  ferieperioder?: ReadonlyArray<{ fra?: ISODateString; til?: ISODateString }>;
  tafPerioder?: ReadonlyArray<{ fra?: ISODateString; til?: ISODateString; loseFeriedage?: number }>;
}>;

const referenceGammelImpl = (
  eoValues: FerieInput,
  shDage: ReadonlySet<ISODateString>,
  periodeFra: ISODateString,
  periodeTil: ISODateString
): ReadonlySet<ISODateString> => {
  const allFerie = new Set<ISODateString>();

  const ferieperioder = eoValues.ferieperioder ?? [];
  for (const feriePeriode of ferieperioder) {
    const ferieFraRaw = feriePeriode.fra;
    const ferieTilRaw = feriePeriode.til;
    if (!ferieFraRaw || !ferieTilRaw) continue;
    if (ferieFraRaw > ferieTilRaw) continue;

    const constrainedFra = ferieFraRaw > periodeFra ? ferieFraRaw : periodeFra;
    const constrainedTil = ferieTilRaw < periodeTil ? ferieTilRaw : periodeTil;
    if (constrainedFra > constrainedTil) continue;

    iterateDatesInclusive(isoDateToDate(constrainedFra), isoDateToDate(constrainedTil), (current) => {
      const iso = dateToISO(current);
      if (iso) {
        const dow = current.getUTCDay();
        if (dow >= 1 && dow <= 5 && !shDage.has(iso)) {
          allFerie.add(iso);
        }
      }
    });
  }

  const tafRows = eoValues.tafPerioder ?? [];
  for (const row of tafRows) {
    const tafFraRaw = row.fra;
    const tafTilRaw = row.til;
    if (!tafFraRaw || !tafTilRaw) continue;
    if (tafFraRaw > tafTilRaw) continue;

    const loseCount = typeof row.loseFeriedage === 'number' ? Math.max(0, Math.trunc(row.loseFeriedage)) : 0;
    if (loseCount <= 0) continue;

    let remaining = loseCount;
    const constrainedFra = tafFraRaw > periodeFra ? tafFraRaw : periodeFra;
    const constrainedTil = tafTilRaw < periodeTil ? tafTilRaw : periodeTil;
    if (constrainedFra > constrainedTil) continue;

    iterateDatesInclusive(isoDateToDate(constrainedFra), isoDateToDate(constrainedTil), (current) => {
      const iso = dateToISO(current);
      if (iso) {
        const dow = current.getUTCDay();
        if (dow >= 1 && dow <= 5 && !shDage.has(iso) && !allFerie.has(iso)) {
          allFerie.add(iso);
          remaining--;
        }
      }
      return remaining > 0 ? undefined : false;
    });
  }

  return allFerie;
};

const iso = (value: string): ISODateString => value as ISODateString;

const addDaysIso = (value: ISODateString, days: number): ISODateString => {
  const d = isoDateToDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToISO(d)!;
};

const sortedArr = (set: ReadonlySet<ISODateString>): string[] => [...set].sort();

const assertSameAsReference = (input: FerieInput, fra: ISODateString, til: ISODateString): void => {
  const shDage = buildShDageSetFromIsoRange(fra, til);
  const reference = referenceGammelImpl(input, shDage, fra, til);
  const actual = buildFerieDageSetForPeriode(input, fra, til);
  expect(sortedArr(actual)).toEqual(sortedArr(reference));
};

// Deterministisk PRNG (mulberry32) — ingen Math.random, så batteriet er reproducerbart.
const makePrng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('buildFerieDageSetForPeriode — ækvivalens med tidligere kontrol-lag-implementering', () => {
  it('matcher referencen på håndplukkede kant-scenarier', () => {
    // Enkelt-dag, weekend, SH (nytår + jul), store bededag før/efter afskaffelse,
    // skudår-februar, DST-skift, år-krydsning, overlap, over-kapacitet, flere kilder.
    const cases: Array<{ input: FerieInput; fra: ISODateString; til: ISODateString }> = [
      { input: {}, fra: iso('2024-03-01'), til: iso('2024-03-01') },
      { input: { ferieperioder: [{ fra: iso('2024-03-02'), til: iso('2024-03-03') }] }, fra: iso('2024-03-01'), til: iso('2024-03-31') }, // weekend
      { input: { ferieperioder: [{ fra: iso('2023-12-25'), til: iso('2024-01-02') }] }, fra: iso('2023-12-01'), til: iso('2024-01-31') }, // jul + nytår
      { input: { ferieperioder: [{ fra: iso('2023-04-01'), til: iso('2023-05-31') }] }, fra: iso('2023-04-01'), til: iso('2023-05-31') }, // store bededag 2023 (findes)
      { input: { ferieperioder: [{ fra: iso('2024-04-01'), til: iso('2024-05-31') }] }, fra: iso('2024-04-01'), til: iso('2024-05-31') }, // store bededag 2024 (afskaffet)
      { input: { ferieperioder: [{ fra: iso('2024-02-26'), til: iso('2024-03-04') }] }, fra: iso('2024-02-01'), til: iso('2024-03-31') }, // skudår
      { input: { ferieperioder: [{ fra: iso('2024-03-28'), til: iso('2024-04-02') }] }, fra: iso('2024-03-01'), til: iso('2024-04-30') }, // DST forår
      { input: { ferieperioder: [{ fra: iso('2024-10-25'), til: iso('2024-10-30') }] }, fra: iso('2024-10-01'), til: iso('2024-10-31') }, // DST efterår
      { input: { ferieperioder: [{ fra: iso('2023-06-01'), til: iso('2025-06-01') }] }, fra: iso('2023-06-01'), til: iso('2025-06-01') }, // flere år
      { input: { ferieperioder: [{ fra: iso('2024-03-01'), til: iso('2024-03-10') }, { fra: iso('2024-03-05'), til: iso('2024-03-15') }] }, fra: iso('2024-03-01'), til: iso('2024-03-31') }, // overlap
      { input: { ferieperioder: [{ fra: iso('2024-05-01'), til: iso('2024-04-01') }] }, fra: iso('2024-03-01'), til: iso('2024-06-30') }, // fra > til → skippes
      { input: { ferieperioder: [{ fra: iso('2023-01-01'), til: iso('2023-01-31') }] }, fra: iso('2024-03-01'), til: iso('2024-03-31') }, // helt uden for periode
      { input: { tafPerioder: [{ fra: iso('2024-03-04'), til: iso('2024-03-08'), loseFeriedage: 2 }] }, fra: iso('2024-03-01'), til: iso('2024-03-31') },
      { input: { tafPerioder: [{ fra: iso('2024-03-04'), til: iso('2024-03-08'), loseFeriedage: 999 }] }, fra: iso('2024-03-01'), til: iso('2024-03-31') }, // over kapacitet
      { input: { tafPerioder: [{ fra: iso('2024-03-04'), til: iso('2024-03-08'), loseFeriedage: 0 }] }, fra: iso('2024-03-01'), til: iso('2024-03-31') }, // 0 → intet
      {
        // Ferie + to løse-kilder der overlapper hinanden og ferien → akkumulerende blokering.
        input: {
          ferieperioder: [{ fra: iso('2024-03-06'), til: iso('2024-03-07') }],
          tafPerioder: [
            { fra: iso('2024-03-04'), til: iso('2024-03-15'), loseFeriedage: 3 },
            { fra: iso('2024-03-04'), til: iso('2024-03-15'), loseFeriedage: 3 },
          ],
        },
        fra: iso('2024-03-01'),
        til: iso('2024-03-31'),
      },
      {
        // Løse-kilde der lander oven på SH (nytårsdag mandag 2024-01-01).
        input: { tafPerioder: [{ fra: iso('2023-12-29'), til: iso('2024-01-05'), loseFeriedage: 4 }] },
        fra: iso('2023-12-01'),
        til: iso('2024-01-31'),
      },
    ];
    for (const c of cases) {
      assertSameAsReference(c.input, c.fra, c.til);
    }
  });

  // Batteriet er bevidst bredt og kan ved parallel fuld-suite bruge mere end Vitests standard på 5 sekunder.
  // Timeoutten bevarer testens dækningsbredde i stedet for at gøre den flakende ved vilkårligt at reducere cases.
  it('matcher referencen på et bredt, tilfældigt (men deterministisk) batteri', () => {
    const rnd = makePrng(0x9e3779b9);
    const baseFra = iso('2019-01-01');
    const pick = (n: number) => Math.floor(rnd() * n);

    let casesWithFerie = 0;
    let casesWithPlacedLose = 0;
    const TOTAL = 1200;

    for (let n = 0; n < TOTAL; n += 1) {
      // Periode: start 0..2900 dage efter 2019-01-01 (≈ 2019–2026), længde 0..430 dage.
      const fra = addDaysIso(baseFra, pick(2900));
      const til = addDaysIso(fra, pick(430));

      const antalFerie = pick(4); // 0..3
      const ferieperioder: Array<{ fra?: ISODateString; til?: ISODateString }> = [];
      for (let i = 0; i < antalFerie; i += 1) {
        // Start relativt til periodens fra, spænder ofte ind/ud af intervallet.
        const start = addDaysIso(fra, pick(460) - 15);
        let end = addDaysIso(start, pick(45));
        // ~15 % af perioderne vendes om (fra > til) → skal ignoreres af begge.
        if (rnd() < 0.15) {
          const tmp = start;
          ferieperioder.push({ fra: end, til: tmp });
          continue;
        }
        if (rnd() < 0.1) end = start; // enkelt-dag
        ferieperioder.push({ fra: start, til: end });
      }

      const antalTaf = pick(3); // 0..2
      const tafPerioder: Array<{ fra?: ISODateString; til?: ISODateString; loseFeriedage?: number }> = [];
      for (let i = 0; i < antalTaf; i += 1) {
        const start = addDaysIso(fra, pick(460) - 15);
        const end = addDaysIso(start, pick(60));
        tafPerioder.push({ fra: start, til: end, loseFeriedage: pick(40) });
      }

      const input: FerieInput = { ferieperioder, tafPerioder };
      const shDage = buildShDageSetFromIsoRange(fra, til);
      const reference = referenceGammelImpl(input, shDage, fra, til);
      const actual = buildFerieDageSetForPeriode(input, fra, til);
      expect(sortedArr(actual)).toEqual(sortedArr(reference));

      if (reference.size > 0) casesWithFerie += 1;
      // Grov ikke-vacuøs-kontrol: mindst ét tilfælde skal placere løse feriedage.
      if (antalTaf > 0 && ferieperioder.length === 0 && reference.size > 0) casesWithPlacedLose += 1;
    }

    // Værn mod et vacuøst batteri (alt tomt): der SKAL være reelle ikke-tomme resultater.
    expect(casesWithFerie).toBeGreaterThan(TOTAL / 4);
    expect(casesWithPlacedLose).toBeGreaterThan(0);
  }, 10_000);
});
