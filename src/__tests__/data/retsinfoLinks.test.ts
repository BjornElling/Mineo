import {
  bkg,
  toYearlyReferenceText,
  toYearlyRetsinfoLinks,
  vejl,
} from '../../data/retsinfoLinks';

describe('retsinfoLinks', () => {
  describe('reference factories', () => {
    it('opretter bekendtgørelser med standardlabel', () => {
      const result = toYearlyRetsinfoLinks({
        2026: [bkg(1056, 2025)],
      });

      expect(result).toEqual({
        2026: [{ label: 'Bkg. 1056/2025', url: 'https://www.retsinformation.dk/eli/lta/2025/1056' }],
      });
    });

    it('opretter vejledninger med standardlabel', () => {
      const result = toYearlyRetsinfoLinks({
        2026: [vejl(10058, 2025)],
      });

      expect(result).toEqual({
        2026: [{ label: 'Vejl. 10058/2025', url: 'https://www.retsinformation.dk/eli/retsinfo/2025/10058' }],
      });
    });

    it('afviser label-overrides uden korrekt præfiks', () => {
      expect(() => vejl(9376, 2024, '9376/2024')).toThrow(
        'Retsinfo: label override skal være "Vejl. 9376/2024"'
      );
    });

    it('afviser labels der peger på et andet dokument end URL-dataene', () => {
      expect(() => vejl(9376, 2024, 'Vejl. 9820/2023')).toThrow('Vejl. 9376/2024');
    });

    it('afviser ikke-positive og ikke-heltallige dokument-id\'er', () => {
      expect(() => bkg(0, 2024)).toThrow('positive heltal');
      expect(() => vejl(9376.5, 2024)).toThrow('positive heltal');
    });
  });

  describe('afledte data', () => {
    it('samler flere referencer til én vist tekst', () => {
      const result = toYearlyReferenceText({
        2024: [vejl(9820, 2023), vejl(9376, 2024, 'Vejl. 9376/2024')],
      });

      expect(result).toEqual({
        2024: 'Vejl. 9820/2023 og Vejl. 9376/2024',
      });
    });

    it('bevarer override-labels og genererer korrekt url', () => {
      const result = toYearlyRetsinfoLinks({
        2015: [bkg(1403, 2011), bkg(198, 2015, 'Bkg. 198/2015')],
      });

      expect(result).toEqual({
        2015: [
          { label: 'Bkg. 1403/2011', url: 'https://www.retsinformation.dk/eli/lta/2011/1403' },
          { label: 'Bkg. 198/2015', url: 'https://www.retsinformation.dk/eli/lta/2015/198' },
        ],
      });
    });
  });
});
