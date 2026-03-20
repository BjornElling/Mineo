import {
  countFilledFields,
  hasRealData,
  isMeaningfulValue,
  parseFieldValue,
  serializeFieldValue,
} from '../../utils/dataCollection';

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

    it('ignorerer _-nøgler på alle niveauer', () => {
      expect(
        countFilledFields({
          stamdata: {
            journalnr: 'J-1',
            _debug: 'skal ignoreres',
            nested: {
              _tmp: 123,
              value: 'x',
            },
          },
        })
      ).toBe(2);
    });

    it('stopper rekursion fail-closed når leaf ligger dybere end depth=10', () => {
      const deepData: Record<string, unknown> = { level0: {} };
      let current = deepData.level0 as Record<string, unknown>;
      for (let i = 1; i <= 11; i += 1) {
        current[`level${i}`] = {};
        current = current[`level${i}`] as Record<string, unknown>;
      }
      current.value = 'skal ikke tælles';

      // countFilledFields kalder countFieldsRecursive på value for hver top-level key.
      // Med wrapperen { root: deepData } ligger leaf mere end 10 niveauer dybt i rekursionen.
      expect(countFilledFields({ root: deepData })).toBe(0);
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
      expect(isMeaningfulValue(null)).toBe(false);
      expect(isMeaningfulValue(undefined)).toBe(false);
      expect(isMeaningfulValue(0)).toBe(true);
      expect(isMeaningfulValue(42)).toBe(true);
      expect(isMeaningfulValue(false)).toBe(true);
      expect(isMeaningfulValue('')).toBe(false);
      expect(isMeaningfulValue('x')).toBe(true);
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

  describe('parseFieldValue', () => {
    it('parser string til computed uden formula', () => {
      expect(parseFieldValue('abc')).toEqual({ formula: null, computed: 'abc' });
    });

    it('parser formula-objekt med trimmed formula', () => {
      expect(parseFieldValue({ formula: 'x+1', value: '2' })).toEqual({ formula: 'x+1', computed: '2' });
      expect(parseFieldValue({ formula: '   ', value: '2' })).toEqual({ formula: null, computed: '2' });
    });

    it('normaliserer null/undefined og ikke-string value fail-closed', () => {
      expect(parseFieldValue(null)).toEqual({ formula: null, computed: '' });
      expect(parseFieldValue(undefined)).toEqual({ formula: null, computed: '' });
      expect(parseFieldValue(123)).toEqual({ formula: null, computed: '123' });
      expect(parseFieldValue({ formula: 'x+1', value: 2 })).toEqual({ formula: 'x+1', computed: '' });
    });
  });

  describe('serializeFieldValue', () => {
    it('serialiserer formula-state som objekt', () => {
      expect(serializeFieldValue({ formula: 'a+b', computed: '3' })).toEqual({ formula: 'a+b', value: '3' });
    });

    it('serialiserer computed string uden formula som string', () => {
      expect(serializeFieldValue({ formula: '', computed: '3' })).toBe('3');
      expect(serializeFieldValue({ computed: 'x' })).toBe('x');
    });

    it('fallbacker deterministisk for primitive og nullish', () => {
      expect(serializeFieldValue('abc')).toBe('abc');
      expect(serializeFieldValue(42)).toBe('42');
      expect(serializeFieldValue(null)).toBe('');
      expect(serializeFieldValue(undefined)).toBe('');
    });
  });
});
