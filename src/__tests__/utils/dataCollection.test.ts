import { describe, expect, it } from 'vitest';
import { countFilledFields, hasRealData, isMeaningfulValue } from '../../utils/dataCollection';

describe('dataCollection', () => {
  describe('countFilledFields', () => {
    it('returnerer 0 for tomt objekt', () => {
      expect(countFilledFields({})).toBe(0);
    });

    it('ignorerer metadata-felter', () => {
      expect(
        countFilledFields({
          _meta: { value: 'skal ignoreres' },
          stamdata: { journalnr: 'J-1' },
        })
      ).toBe(1);
    });

    it('tæller nested strukturer og arrays', () => {
      expect(
        countFilledFields({
          erstatningsopgoerelse: {
            loenindkomstAnsaettelsesforhold: [
              { navnPaaArbejdssted: 'A', indtaegtsoplysningerTableData: [] },
              { navnPaaArbejdssted: '', indtaegtsoplysningerTableData: [{ col2: '1000' }] },
            ],
          },
        })
      ).toBeGreaterThan(0);
    });

    it('tæller ikke undefined, null eller tomme strenge', () => {
      expect(
        countFilledFields({
          stamdata: {
            journalnr: '',
            advokat: undefined,
            skadesdato: null,
          },
        })
      ).toBe(0);
    });

    it('håndterer AmountValue-lignende objekter deterministisk', () => {
      expect(
        countFilledFields({
          oevrigeKrav: {
            beloeb: { kind: 'number', value: 123.45 },
          },
        })
      ).toBe(2);
    });
  });

  describe('hasRealData', () => {
    it('returnerer false ved manglende data', () => {
      expect(hasRealData(undefined)).toBe(false);
      expect(hasRealData(null)).toBe(false);
      expect(hasRealData({})).toBe(false);
    });

    it('returnerer false for kun tomme værdier', () => {
      expect(
        hasRealData({
          stamdata: { journalnr: '', advokat: undefined },
        })
      ).toBe(false);
    });

    it('returnerer true når én meningsfuld værdi findes', () => {
      expect(
        hasRealData({
          stamdata: { journalnr: 'J-123' },
        })
      ).toBe(true);
    });

    it('returnerer false for nested objekter uden meningsfulde blade', () => {
      expect(
        hasRealData({
          erstatningsopgoerelse: {
            nested: {
              value: undefined,
            },
          },
        })
      ).toBe(false);
    });

    it('behandler array med tomme objekter som ikke-reelt data', () => {
      expect(
        hasRealData({
          rows: [{}],
        })
      ).toBe(false);
    });
  });

  describe('isMeaningfulValue', () => {
    it('håndterer primitive grænseværdier deterministisk', () => {
      expect(isMeaningfulValue(0)).toBe(true);
      expect(isMeaningfulValue(false)).toBe(true);
      expect(isMeaningfulValue('')).toBe(false);
      expect(isMeaningfulValue('  ')).toBe(false);
    });

    it('håndterer array/objekt grænser', () => {
      expect(isMeaningfulValue([])).toBe(false);
      expect(isMeaningfulValue([{}])).toBe(false);
      expect(isMeaningfulValue([{ a: 1 }])).toBe(true);
      expect(isMeaningfulValue({})).toBe(false);
      expect(isMeaningfulValue({ a: undefined })).toBe(false);
      expect(isMeaningfulValue({ a: { b: '' }, c: { d: 1 } })).toBe(true);
    });
  });
});
