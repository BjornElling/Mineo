import {
  containsRawIsoDate,
  guardDocumentDateText,
  reformatStrayIsoDates,
} from '../../document/layout/documentDateGuard';
import { normalizeTextForDocument } from '../../document/layout/pdfTextUtils';

/**
 * Håndhæver dokument-output-kontraktens datoformat-regel: en rå ISO-dato (ÅÅÅÅ-MM-DD)
 * må aldrig nå et brugersynligt dokument. Det centrale værn (documentDateGuard) fanger
 * og omformaterer den til dansk DD-MM-ÅÅÅÅ. Testen beviser også, at mønsteret ikke er
 * inert — ellers ville en brudt regex lade lækager passere vakuøst (jf. dateContractGuard).
 */
describe('document-date-format guard', () => {
  describe('reformatStrayIsoDates', () => {
    it('omformaterer en bar ISO-dato til dansk', () => {
      const { text, found } = reformatStrayIsoDates('2022-10-01');
      expect(text).toBe('01-10-2022');
      expect(found).toEqual(['2022-10-01']);
    });

    it('omformaterer en ISO-dato inde i en længere tekst', () => {
      const { text, found } = reformatStrayIsoDates('Reguleret per 2022-10-01 jf. satsen');
      expect(text).toBe('Reguleret per 01-10-2022 jf. satsen');
      expect(found).toEqual(['2022-10-01']);
    });

    it('omformaterer flere ISO-datoer i samme streng', () => {
      const { text, found } = reformatStrayIsoDates('2022-10-01 - 2022-12-31');
      expect(text).toBe('01-10-2022 - 31-12-2022');
      expect(found).toEqual(['2022-10-01', '2022-12-31']);
    });
  });

  describe('lader legitimt indhold passere uændret', () => {
    it.each([
      ['en dansk dato', '01-10-2022'],
      ['et beløb', '1.234,56 kr.'],
      ['et negativt beløb', '-1.234,56'],
      ['et uge-interval', '42/2022'],
      ['et årstal', '2022'],
      ['en overskrift', 'Lønindkomst'],
      ['en dato-formet men ugyldig dato', '1234-56-78'],
      ['et journalnummer med lang hale', '2024-001234'],
    ])('%s', (_label, value) => {
      expect(guardDocumentDateText(value)).toBe(value);
      expect(containsRawIsoDate(value)).toBe(false);
    });
  });

  describe('guardDocumentDateText', () => {
    it('er ikke inert: en bar ISO-dato omformateres (selv-test mod syntetisk lækage)', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(guardDocumentDateText('2022-10-01')).toBe('01-10-2022');
      expect(containsRawIsoDate('2022-10-01')).toBe(true);
      errorSpy.mockRestore();
    });

    it('er idempotent (kør to gange = én gang)', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const once = guardDocumentDateText('2022-10-01');
      expect(guardDocumentDateText(once)).toBe(once);
      errorSpy.mockRestore();
    });

    it('logger høj-lydt (console.error) i udvikling, når en lækage fanges', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      guardDocumentDateText('2022-10-01');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]?.[0]).toContain('2022-10-01');
      errorSpy.mockRestore();
    });

    it('logger ikke for legitimt indhold', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      guardDocumentDateText('01-10-2022');
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('chokepoint-integration', () => {
    it('PDF-tekst-normalisering (normalizeTextForDocument) anvender værnet', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(normalizeTextForDocument('Skadelidte fratrådte 2022-10-01.')).toBe('Skadelidte fratrådte 01-10-2022.');
      errorSpy.mockRestore();
    });
  });
});
