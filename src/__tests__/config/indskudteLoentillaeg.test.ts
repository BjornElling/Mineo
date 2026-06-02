import {
  STORE_BEDEDAG_PCT,
  STORE_BEDEDAG_START,
  STORE_BEDEDAG_SATSTRAPPE,
  SAERLIGT_FERIETILLAEG_PCT_FOER,
  SAERLIGT_FERIETILLAEG_PCT_EFTER,
  SAERLIGT_FERIETILLAEG_FORHOEJELSE_START,
  SAERLIGT_FERIETILLAEG_SATSTRAPPE,
  resolveIndskudtLoentillaegPct,
} from '../../config/indskudteLoentillaeg';
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

  describe('Særligt ferietillæg', () => {
    it('har satserne 0,96 % før og 1,48 % fra 1-5-2024', () => {
      expect(SAERLIGT_FERIETILLAEG_PCT_FOER).toBe(0.96);
      expect(SAERLIGT_FERIETILLAEG_PCT_EFTER).toBe(1.48);
      expect(SAERLIGT_FERIETILLAEG_FORHOEJELSE_START).toBe(iso('2024-05-01'));
    });

    it('satstrappen er sorteret stigende efter virkningsdato', () => {
      const datoer = SAERLIGT_FERIETILLAEG_SATSTRAPPE.map((t) => t.fraOgMed);
      const sorteret = [...datoer].sort();
      expect(datoer).toEqual(sorteret);
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

    it('vælger det seneste gældende trin i en flertrins-trappe (Særligt ferietillæg)', () => {
      expect(resolveIndskudtLoentillaegPct(SAERLIGT_FERIETILLAEG_SATSTRAPPE, iso('2010-01-01'))).toBe(0.96);
      expect(resolveIndskudtLoentillaegPct(SAERLIGT_FERIETILLAEG_SATSTRAPPE, iso('2024-04-30'))).toBe(0.96);
      expect(resolveIndskudtLoentillaegPct(SAERLIGT_FERIETILLAEG_SATSTRAPPE, iso('2024-05-01'))).toBe(1.48);
      expect(resolveIndskudtLoentillaegPct(SAERLIGT_FERIETILLAEG_SATSTRAPPE, iso('2030-01-01'))).toBe(1.48);
    });

    it('returnerer 0 for en tom satstrappe', () => {
      expect(resolveIndskudtLoentillaegPct([], iso('2024-01-01'))).toBe(0);
    });
  });
});
