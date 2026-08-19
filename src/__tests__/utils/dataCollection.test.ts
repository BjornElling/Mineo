import {
  countFilledFields,
  isMeaningfulValue,
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
            skadedato: null,
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

  // `hasRealData()` er BEVIDST slettet: "indeholder sagen brugerdata?" har ét sandt sted,
  // `settledInputHasAnyData()` (eksponeret som `hasAnyData()`), som måler mod NY-SAGS-baseline i stedet for
  // mod tomhed. `hasRealData` var et konkurrerende svar bygget på feltoptælling og regnede hver `false` og
  // hvert standardtal som brugerdata – derfor kunne en helt tom standardsag gemmes som et rigtigt
  // sagsartefakt. Modulet her tæller nu KUN felter til preflight-rapportering.
  it('eksporterer ikke en konkurrerende data-presence-forespørgsel', async () => {
    const module = await import('../../utils/dataCollection');
    expect(Object.keys(module)).not.toContain('hasRealData');
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
});
