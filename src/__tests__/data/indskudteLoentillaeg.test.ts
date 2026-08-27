import * as indskudteLoentillaeg from '../../data/indskudteLoentillaeg';
import {
  STORE_BEDEDAG_PCT,
  STORE_BEDEDAG_START,
  STORE_BEDEDAG_SATSTRAPPE,
  resolveIndskudtLoentillaegPct,
  type IndskudtLoentillaegSatstrin,
} from '../../data/indskudteLoentillaeg';
import { toISODateString } from '../../types/branded';

const iso = (s: string) => toISODateString(s);

describe('indskudteLoentillaeg', () => {
  describe('Store Bededagstillæg', () => {
    it('har satsen 0,45 procentpoint fra 1-1-2024', () => {
      expect(STORE_BEDEDAG_PCT).toBe(0.45);
      expect(STORE_BEDEDAG_START).toBe(iso('2024-01-01'));
    });

    it('satstrappen har ét trin der matcher sats/dato', () => {
      expect(STORE_BEDEDAG_SATSTRAPPE).toEqual([
        { fraOgMed: iso('2024-01-01'), procentpoint: 0.45 },
      ]);
    });
  });

  /**
   * Særligt ferietillæg er et rent FREMTIDIGT udviklingsprojekt og må ikke indregnes nogen steder
   * (udviklerbeslutning 2026-07-31). Satstrappen lå tidligere i datafilen "forberedt, men ikke koblet ind";
   * data der kun venter på at blive brugt, læses som en forudsætning om, at tillægget SKAL bruges.
   *
   * Værnet er negativt og måler modulets faktiske eksportflade: en fremtidig agent, der genindfører
   * satserne "så de er klar", gør denne test rød. Se `indskudte-loentillaeg-contract.md` §6.
   */
  describe('Særligt ferietillæg er ikke i programmet', () => {
    it('eksporterer ingen ferietillægs-satser eller -satstrappe', () => {
      const eksporter = Object.keys(indskudteLoentillaeg);
      expect(eksporter.filter((navn) => /FERIETILLAEG/i.test(navn))).toEqual([]);
    });

    it('har præcis ÉT indskudt tillæg – Store Bededag', () => {
      const satstrapper = Object.keys(indskudteLoentillaeg).filter((navn) => navn.endsWith('_SATSTRAPPE'));
      expect(satstrapper).toEqual(['STORE_BEDEDAG_SATSTRAPPE']);
    });
  });

  describe('resolveIndskudtLoentillaegPct', () => {
    it('returnerer 0 før det tidligste trin', () => {
      expect(resolveIndskudtLoentillaegPct(STORE_BEDEDAG_SATSTRAPPE, iso('2023-12-31'))).toBe(0);
    });

    it('returnerer satsen på og efter virkningsdatoen (Store Bededag)', () => {
      expect(resolveIndskudtLoentillaegPct(STORE_BEDEDAG_SATSTRAPPE, iso('2024-01-01'))).toBe(0.45);
      expect(resolveIndskudtLoentillaegPct(STORE_BEDEDAG_SATSTRAPPE, iso('2025-06-01'))).toBe(0.45);
    });

    it('vælger det seneste gældende trin i en flertrins-trappe', () => {
      // Flertrins-dækningen brugte før ferietillæggets satstrappe som fixture. Funktionen understøtter
      // stadig flere trin (kontraktens §2.4), så dækningen bevares med en LOKAL trappe – testdata, ikke
      // domænedata, så den ikke kan misforstås som en sats programmet bruger.
      const trappe: readonly IndskudtLoentillaegSatstrin[] = [
        { fraOgMed: iso('2010-01-01'), procentpoint: 1 },
        { fraOgMed: iso('2020-01-01'), procentpoint: 2.5 },
      ];
      expect(resolveIndskudtLoentillaegPct(trappe, iso('2009-12-31'))).toBe(0);
      expect(resolveIndskudtLoentillaegPct(trappe, iso('2010-01-01'))).toBe(1);
      expect(resolveIndskudtLoentillaegPct(trappe, iso('2019-12-31'))).toBe(1);
      expect(resolveIndskudtLoentillaegPct(trappe, iso('2020-01-01'))).toBe(2.5);
      expect(resolveIndskudtLoentillaegPct(trappe, iso('2030-01-01'))).toBe(2.5);
    });

    it('returnerer 0 for en tom satstrappe', () => {
      expect(resolveIndskudtLoentillaegPct([], iso('2024-01-01'))).toBe(0);
    });
  });
});
