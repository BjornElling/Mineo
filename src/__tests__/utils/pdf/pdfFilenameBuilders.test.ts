/// <reference types="vitest/globals" />

import { createDate } from '../../../utils/dateUtils';
import { buildAarsloenPdfFilename } from '../../../pdf/domains/aarsloen/aarsloenPdf';
import { buildVarigeMenPdfFilename } from '../../../pdf/domains/varigemen/varigeMenPdf';
import { buildRentePdfBaseTitle, buildRentePdfFilename } from '../../../pdf/domains/renteberegning/rentePdf';
import { buildSHDagePdfFilename } from '../../../pdf/domains/aarsloen/shDagePdf';
import { buildSatserPdfFilename } from '../../../pdf/domains/satser/satserPdf';
import { buildReguleringPdfFilename } from '../../../pdf/domains/eo/reguleringPdf';
import { buildKRLPdfFilename } from '../../../pdf/domains/krl/krlPdf';
import { resolvePdfFileName } from '../../../pdf/shared/pdfFormatUtils';
import { toDanishDateString } from '../../../types/branded';

describe('pdf filename builders', () => {
  describe('buildAarsloenPdfFilename', () => {
    it('prefixer med journalnr når journalnr er udfyldt', () => {
      expect(buildAarsloenPdfFilename('1234')).toBe('1234 - Årslønsberegning.pdf');
    });

    it('udelader prefix når journalnr er tomt', () => {
      expect(buildAarsloenPdfFilename('')).toBe('Årslønsberegning.pdf');
    });
  });

  describe('buildVarigeMenPdfFilename', () => {
    it('prefixer med journalnr når journalnr er udfyldt', () => {
      expect(buildVarigeMenPdfFilename('1234')).toBe('1234 - Méngodtgørelse.pdf');
    });

    it('udelader prefix når journalnr er tomt', () => {
      expect(buildVarigeMenPdfFilename('')).toBe('Méngodtgørelse.pdf');
    });
  });

  describe('buildRentePdfFilename', () => {
    it('bygger nyt procesrente-format med journalnr', () => {
      const start = createDate(2025, 3, 11);
      const end = createDate(2025, 7, 17);
      // Kontrakt: filnavnsdatoer er i DD-MM-YYYY-format.
      const baseTitle = buildRentePdfBaseTitle(5000, start, end);
      const filename = buildRentePdfFilename(baseTitle, '1234');
      expect(filename).toBe('1234 - Procesrente, 5.000,00 kr. (11-04-2025 - 17-08-2025).pdf');
    });

    it('udelader journalnr-prefix når journalnr er tomt', () => {
      const start = createDate(2025, 3, 11);
      const end = createDate(2025, 7, 17);
      const baseTitle = buildRentePdfBaseTitle(5000, start, end);
      const filename = buildRentePdfFilename(baseTitle, '');
      expect(filename).toBe('Procesrente, 5.000,00 kr. (11-04-2025 - 17-08-2025).pdf');
    });
  });

  describe('buildSHDagePdfFilename', () => {
    it('bygger periodekæde med plus og journalnr-prefix', () => {
      const filename = buildSHDagePdfFilename([
        { start: createDate(2025, 3, 11), end: createDate(2025, 7, 17) },
        { start: createDate(2025, 7, 19), end: createDate(2026, 11, 21) },
      ], '1234');
      expect(filename).toBe('1234 - SH-dage (11-04-2025 - 17-08-2025 + 19-08-2025 - 21-12-2026).pdf');
    });

    it('udelader journalnr-prefix når journalnr er tomt', () => {
      const filename = buildSHDagePdfFilename([
        { start: createDate(2025, 3, 11), end: createDate(2025, 7, 17) },
      ], '');
      expect(filename).toBe('SH-dage (11-04-2025 - 17-08-2025).pdf');
    });
  });

  describe('buildSatserPdfFilename', () => {
    it('bygger satser-filnavn i konsolideret builder', () => {
      expect(buildSatserPdfFilename(2026)).toBe('Arbejdsskadesatser 2026.pdf');
    });
  });

  describe('buildReguleringPdfFilename', () => {
    it('bevarer regulering-format inkl. sanitization', () => {
      const fraDato = toDanishDateString('01-01-2026');
      const tilDato = toDanishDateString('31-12-2026');
      const filename = buildReguleringPdfFilename({
        loenudviklingBasis: 'Overenskomst',
        valgtLabel: 'Test: Label',
        interval: { fraDato, tilDato },
      });
      expect(filename).toBe('Regulering - Overenskomst - Test_ Label (01-01-2026 til 31-12-2026).pdf');
    });
  });

  describe('buildKRLPdfFilename', () => {
    it('bygger KRL-filnavn via kanonisk helper', () => {
      expect(buildKRLPdfFilename()).toBe('KRL Satstabeller.pdf');
    });
  });

  describe('resolvePdfFileName', () => {
    it('tilføjer udkast-suffix når isDraft=true', () => {
      expect(resolvePdfFileName('Testtitel', true, '1234')).toBe('1234 - Testtitel (udkast).pdf');
    });

    it('saniterer windows-ulovlige tegn i baseTitle', () => {
      expect(resolvePdfFileName('A<B>:C"D/E\\F|G?H*I', false)).toBe('A_B__C_D_E_F_G_H_I.pdf');
    });

    it('saniterer windows-ulovlige tegn i journalnr', () => {
      expect(resolvePdfFileName('Titel', false, 'J:12/34')).toBe('J_12_34 - Titel.pdf');
    });
  });
});
