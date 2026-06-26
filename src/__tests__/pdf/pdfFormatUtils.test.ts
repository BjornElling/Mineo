/// <reference types="vitest/globals" />

import { formatReguleringFactorText, formatReguleringPct } from '../../document/layout/documentFormatUtils';

describe('pdfFormatUtils', () => {
  describe('formatReguleringFactorText', () => {
    it('bygger faktortekst med plus for positiv regulering', () => {
      expect(formatReguleringFactorText(2.5)).toBe(' x (100 % + 2,5 %)');
    });

    it('bygger faktortekst med minus for negativ regulering', () => {
      expect(formatReguleringFactorText(-3.14)).toBe(' x (100 % - 3,14 %)');
    });

    it('undertrykker faktoren når reguleringen afrunder til 0,00 %', () => {
      // Forenet adfærd: near-nul-regulering giver ingen "x (100 % + 0,00 %)"-støj.
      expect(formatReguleringFactorText(0)).toBe('');
      expect(formatReguleringFactorText(0.003)).toBe('');
      expect(formatReguleringFactorText(-0.004)).toBe('');
    });

    it('viser faktoren når reguleringen afrunder til mindst 0,01 %', () => {
      expect(formatReguleringFactorText(0.005)).toBe(' x (100 % + 0,01 %)');
    });

    it('kan vise faktortekst med fast fire-decimalers regulering', () => {
      expect(formatReguleringFactorText(8.8872, 4)).toBe(' x (100 % + 8,8872 %)');
      expect(formatReguleringFactorText(2.5, 4)).toBe(' x (100 % + 2,5000 %)');
    });

    it('returnerer tom streng for ikke-endelige værdier', () => {
      expect(formatReguleringFactorText(NaN)).toBe('');
      expect(formatReguleringFactorText(Infinity)).toBe('');
    });
  });

  describe('formatReguleringPct', () => {
    it('viser positivt fortegn for positive værdier og trimmer trailing zeros', () => {
      expect(formatReguleringPct(22.81)).toBe('+ 22,81 %');
      expect(formatReguleringPct(2.5)).toBe('+ 2,5 %');
    });

    it('viser negativt fortegn for negative værdier', () => {
      expect(formatReguleringPct(-3.14)).toBe('- 3,14 %');
    });

    it('viser plus-nul for en ren nul-værdi', () => {
      expect(formatReguleringPct(0)).toBe('+ 0 %');
    });

    it('viser ikke negativt fortegn på en lille negativ værdi der afrundes til nul', () => {
      // Regression: tidligere blev fortegnet taget fra den rå værdi, så -0,00001
      // gav det misvisende "- 0 %". Fortegnet skal nu følge den afrundede størrelse.
      expect(formatReguleringPct(-0.00001)).toBe('+ 0 %');
    });

    it('beholder negativt fortegn når størrelsen ikke afrundes til nul', () => {
      expect(formatReguleringPct(-0.0001)).toBe('- 0,0001 %');
    });
  });
});
