import { findRawIsoDates } from '../document/rawIsoDateDetection';
import { normalizeRightAlignedTextForDocument, normalizeTextForDocument } from '../../document/layout/pdfTextUtils';

/**
 * Dokument-output-kontraktens datoregel (§A8): programmets egne datoer formateres ved
 * kilden, og brugerens fritekst gengives tegn for tegn. Reglen om «ingen rå ISO-dato»
 * håndhæves i testene (Word-harnessen kører alle generatorer gennem `findRawIsoDates`),
 * ikke af en regex på færdig tekst i kanalerne – den kunne ikke skelne en lækket
 * programdato fra et journalnummer som «AES-2024-01-15» (NY-12a-1).
 */
describe('document-date-format guard', () => {
  describe('findRawIsoDates (test-sikkerhedsnettet)', () => {
    it('er ikke inert: finder en bar ISO-dato, også inde i en længere tekst', () => {
      expect(findRawIsoDates('2022-10-01')).toEqual(['2022-10-01']);
      expect(findRawIsoDates('Reguleret per 2022-10-01 jf. satsen')).toEqual(['2022-10-01']);
      expect(findRawIsoDates('2022-10-01 - 2022-12-31')).toEqual(['2022-10-01', '2022-12-31']);
    });

    it.each([
      ['en dansk dato', '01-10-2022'],
      ['et beløb', '1.234,56 kr.'],
      ['et negativt beløb', '-1.234,56'],
      ['et uge-interval', '42/2022'],
      ['et årstal', '2022'],
      ['en overskrift', 'Lønindkomst'],
      ['en dato-formet men ugyldig dato', '1234-56-78'],
      ['et journalnummer med lang hale', '2024-001234'],
    ])('lader %s passere', (_label, value) => {
      expect(findRawIsoDates(value)).toEqual([]);
    });
  });

  describe('kanalernes tekstnormalisering gengiver brugertekst ordret', () => {
    it.each([
      ['journalnummer', 'AES-2024-01-15'],
      ['fritekst med filnavn', 'Vedlagt fil AES-2024-01-15.pdf.'],
      ['bar ISO-formet fritekst', 'Se mail af 2024-01-15'],
    ])('PDF: %s omformes ikke', (_label, value) => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(normalizeTextForDocument(value)).toBe(value);
      expect(normalizeRightAlignedTextForDocument(value)).toBe(value);
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
