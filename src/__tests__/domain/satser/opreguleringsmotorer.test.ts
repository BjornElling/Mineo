/// <reference types="vitest/globals" />

import {
  opregulerMedAslAarsloensmaksimum,
  opregulerMedAkkumuleretReguleringssats,
} from '../../../domain/satser/opreguleringsmotorer';
import { aarsloenAslMax, reguleringssats } from '../../../data/lovbestemteRates';

describe('opreguleringsmotorer', () => {
  describe('opregulerMedAslAarsloensmaksimum', () => {
    it('faktor = idx[målår] / idx[kildeår]', () => {
      const res = opregulerMedAslAarsloensmaksimum({ kildeAar: 2022, maalAar: 2026 });
      expect(res.manglendeAar).toEqual([]);
      expect(res.faktor).toBeCloseTo(aarsloenAslMax[2026] / aarsloenAslMax[2022], 12);
      expect(res.deltaPct).toBeCloseTo((aarsloenAslMax[2026] / aarsloenAslMax[2022] - 1) * 100, 10);
    });

    it('returnerer ingen opregulering når målår ≤ kildeår med fuld indeksdækning', () => {
      expect(opregulerMedAslAarsloensmaksimum({ kildeAar: 2026, maalAar: 2026 })).toEqual({ faktor: 1, deltaPct: 0, manglendeAar: [] });
      expect(opregulerMedAslAarsloensmaksimum({ kildeAar: 2026, maalAar: 2020 })).toEqual({ faktor: 1, deltaPct: 0, manglendeAar: [] });
    });

    it('fail-closer for samme-år og bagud når indeksdata mangler', () => {
      expect(opregulerMedAslAarsloensmaksimum({ kildeAar: 1999, maalAar: 1999 }).manglendeAar).toEqual([1999]);
      expect(opregulerMedAslAarsloensmaksimum({ kildeAar: 2026, maalAar: 1999 }).manglendeAar).toEqual([1999]);
    });

    it('fail-closer når et af årene mangler indeks', () => {
      const res = opregulerMedAslAarsloensmaksimum({ kildeAar: 1999, maalAar: 2026 });
      expect(res.manglendeAar).toEqual([1999]);
      expect(res.faktor).toBe(1);
    });

    it('fail-closer på ikke-heltallige år (NaN/decimaltal) uden at slå indeks op', () => {
      const nan = opregulerMedAslAarsloensmaksimum({ kildeAar: Number.NaN, maalAar: 2026 });
      expect(nan.faktor).toBe(1);
      expect(nan.manglendeAar).toEqual([Number.NaN]);

      const decimal = opregulerMedAslAarsloensmaksimum({ kildeAar: 2022.5, maalAar: 2026 });
      expect(decimal.faktor).toBe(1);
      expect(decimal.manglendeAar).toEqual([2022.5]);
    });

    it('dedup’er manglendeAar når begge endepunkter er det samme ikke-heltal (fx NaN)', () => {
      // NaN === NaN er false, men dedup'en (Array.includes / SameValueZero) skal sikre
      // at to ens NaN-endepunkter kun rapporteres én gang.
      const nan = opregulerMedAslAarsloensmaksimum({ kildeAar: Number.NaN, maalAar: Number.NaN });
      expect(nan.manglendeAar).toEqual([Number.NaN]);

      const decimal = opregulerMedAslAarsloensmaksimum({ kildeAar: 2022.5, maalAar: 2022.5 });
      expect(decimal.manglendeAar).toEqual([2022.5]);
    });

    it('kræver KUN dækning for de to endepunktsår — ikke mellemliggende år (ratio-metode)', () => {
      // Asymmetri vs. metode 2: ASL-indeks er et rent forhold idx[målår]/idx[kildeår],
      // så et hul i et mellemliggende år må ikke fail-close. Map uden 2024/2025.
      const res = opregulerMedAslAarsloensmaksimum(
        { kildeAar: 2022, maalAar: 2026 },
        { 2022: 100, 2026: 116 }
      );
      expect(res.manglendeAar).toEqual([]);
      expect(res.faktor).toBeCloseTo(116 / 100, 12);
    });

    it('bruger aarsloenAslMax som default-indeks når intet map gives', () => {
      const withDefault = opregulerMedAslAarsloensmaksimum({ kildeAar: 2022, maalAar: 2026 });
      const withExplicit = opregulerMedAslAarsloensmaksimum({ kildeAar: 2022, maalAar: 2026 }, aarsloenAslMax);
      expect(withDefault).toEqual(withExplicit);
    });
  });

  describe('opregulerMedAkkumuleretReguleringssats', () => {
    it('faktor = ∏(1 + sats/100) for de mellemliggende år', () => {
      const res = opregulerMedAkkumuleretReguleringssats({ kildeAar: 2022, maalAar: 2026 });
      const forventet =
        (1 + reguleringssats[2023] / 100) *
        (1 + reguleringssats[2024] / 100) *
        (1 + reguleringssats[2025] / 100) *
        (1 + reguleringssats[2026] / 100);
      expect(res.manglendeAar).toEqual([]);
      expect(res.faktor).toBeCloseTo(forventet, 12);
      expect(res.deltaPct).toBeCloseTo((forventet - 1) * 100, 10);
    });

    it('2022→2026 giver ca. 16,08 % (tilpasningsprocent+2%-metoden), IKKE 16,14 % (ASL-metoden)', () => {
      const sats = opregulerMedAkkumuleretReguleringssats({ kildeAar: 2022, maalAar: 2026 });
      const asl = opregulerMedAslAarsloensmaksimum({ kildeAar: 2022, maalAar: 2026 });
      // Akkumuleret reguleringssats: 1.03 * 1.035 * 1.039 * 1.048 ≈ 1.16080 → ~16,08 %
      expect(Math.round(sats.deltaPct * 100) / 100).toBeCloseTo(16.08, 2);
      // ASL-metoden gav den tidligere (forkerte) værdi ~16,14 %.
      expect(Math.round(asl.deltaPct * 100) / 100).toBeCloseTo(16.14, 2);
      // De to metoder må ikke give samme resultat (forskellige datagrundlag).
      expect(Math.round(sats.deltaPct * 100) / 100).not.toBe(Math.round(asl.deltaPct * 100) / 100);
    });

    it('matcher EAL-årsløn-kædens faktor for et interval', () => {
      // EAL-kæden: faktor *= 1 + reguleringssats[year]/100 for year fra skadesaar+1 til beregningsaar.
      const res = opregulerMedAkkumuleretReguleringssats({ kildeAar: 2020, maalAar: 2024 });
      let forventet = 1;
      for (let y = 2021; y <= 2024; y += 1) forventet *= 1 + reguleringssats[y] / 100;
      expect(res.faktor).toBeCloseTo(forventet, 12);
    });

    it('returnerer ingen opregulering når målår ≤ kildeår med fuld satsdækning', () => {
      expect(opregulerMedAkkumuleretReguleringssats({ kildeAar: 2026, maalAar: 2026 })).toEqual({ faktor: 1, deltaPct: 0, manglendeAar: [] });
      expect(opregulerMedAkkumuleretReguleringssats({ kildeAar: 2026, maalAar: 2020 })).toEqual({ faktor: 1, deltaPct: 0, manglendeAar: [] });
    });

    it('fail-closer og angiver startår, slutår og alle manglende mellemår', () => {
      const res = opregulerMedAkkumuleretReguleringssats({ kildeAar: 2003, maalAar: 2006 });
      expect(res.manglendeAar).toContain(2003);
      expect(res.manglendeAar).toContain(2004);
      expect(res.faktor).toBe(1);
    });

    it('kræver startårets sats uden at multiplicere den ind i faktoren', () => {
      const res = opregulerMedAkkumuleretReguleringssats(
        { kildeAar: 2022, maalAar: 2024 },
        { 2023: 3, 2024: 4 }
      );
      expect(res).toEqual({ faktor: 1, deltaPct: 0, manglendeAar: [2022] });

      const withStart = opregulerMedAkkumuleretReguleringssats(
        { kildeAar: 2022, maalAar: 2024 },
        { 2022: 99, 2023: 3, 2024: 4 }
      );
      expect(withStart.manglendeAar).toEqual([]);
      expect(withStart.faktor).toBeCloseTo(1.03 * 1.04, 12);
    });

    it('fail-closer på ikke-heltallige år (NaN/decimaltal) uden at iterere satser', () => {
      const nan = opregulerMedAkkumuleretReguleringssats({ kildeAar: 2022, maalAar: Number.NaN });
      expect(nan.faktor).toBe(1);
      expect(nan.manglendeAar).toEqual([Number.NaN]);

      const decimal = opregulerMedAkkumuleretReguleringssats({ kildeAar: 2022.5, maalAar: 2026 });
      expect(decimal.faktor).toBe(1);
      expect(decimal.manglendeAar).toEqual([2022.5]);
    });

    it('matcher offentlige ydelsers akkumulerede regulering (index-100-metoden)', () => {
      // resolveOffentligeYdelserAkkumuleretReguleringPct bruger samme produkt.
      const baseYear = 2021;
      const segmentYear = 2025;
      let index = 100;
      for (let y = baseYear + 1; y <= segmentYear; y += 1) index *= 1 + reguleringssats[y] / 100;
      const forventetDeltaPct = (index / 100 - 1) * 100;
      const res = opregulerMedAkkumuleretReguleringssats({ kildeAar: baseYear, maalAar: segmentYear });
      expect(res.deltaPct).toBeCloseTo(forventetDeltaPct, 10);
    });

    it('kræver dækning for HELE det bagudvendte interval, selv om resultatet er faktor 1', () => {
      // For målår < kildeår returneres faktor 1, men dækningen er en selvstændig
      // invariant: et hul i [målår..kildeår] skal stadig fail-close (synlig feltfejl).
      const res = opregulerMedAkkumuleretReguleringssats(
        { kildeAar: 2024, maalAar: 2022 },
        { 2022: 1, 2024: 3 } // 2023 mangler
      );
      expect(res.manglendeAar).toEqual([2023]);
      expect(res.faktor).toBe(1);
    });

    it('dedup’er manglendeAar når begge endepunkter er det samme ikke-heltal (fx NaN)', () => {
      const nan = opregulerMedAkkumuleretReguleringssats({ kildeAar: Number.NaN, maalAar: Number.NaN });
      expect(nan.manglendeAar).toEqual([Number.NaN]);
    });

    it('bruger reguleringssats som default-satser når intet map gives', () => {
      const withDefault = opregulerMedAkkumuleretReguleringssats({ kildeAar: 2021, maalAar: 2025 });
      const withExplicit = opregulerMedAkkumuleretReguleringssats({ kildeAar: 2021, maalAar: 2025 }, reguleringssats);
      expect(withDefault).toEqual(withExplicit);
    });
  });

  describe('fail-closed-konsistens på tværs af de to motorer', () => {
    it('manglendeAar er aldrig tom for et 0-beløbs-gyldigt, men data-manglende interval (begge metoder)', () => {
      // 2000 findes hverken i aarsloenAslMax eller reguleringssats.
      const asl = opregulerMedAslAarsloensmaksimum({ kildeAar: 2000, maalAar: 2026 });
      const akk = opregulerMedAkkumuleretReguleringssats({ kildeAar: 2000, maalAar: 2026 });
      expect(asl.manglendeAar.length).toBeGreaterThan(0);
      expect(akk.manglendeAar.length).toBeGreaterThan(0);
      // Begge fail-closer til faktor 1 (ikke-pålidelig — kalderen skal afvise).
      expect(asl.faktor).toBe(1);
      expect(akk.faktor).toBe(1);
    });
  });
});
