/// <reference types="vitest/globals" />

import { normalizeRightAlignedTextForPdf, normalizeTextForPdf } from '../../../utils/pdf/pdfTextUtils';

describe('pdfTextUtils', () => {
  describe('normalizeTextForPdf', () => {
    it('normaliserer PDF-usikre Unicode-tegn til ASCII-fallbacks', () => {
      expect(
        normalizeTextForPdf('Kapitaliseret pga. ≤ 2 år til folkepension? “Nej” • test … >=?')
      ).toBe('Kapitaliseret pga. <= 2 år til folkepension? "Nej" - test ... >=?');
    });

    it('normaliserer pile og sammenligningsoperatorer brugt i PDF-kode', () => {
      expect(normalizeTextForPdf('A → B, C ← D, E ↔ F, x ≥ y, x ≠ y, x ≈ y')).toBe(
        'A -> B, C <- D, E <-> F, x >= y, x != y, x ~= y'
      );
    });

    it('bevarer ikke-brydende mellemrum mellem tal og kr.', () => {
      expect(normalizeTextForPdf('123,45 kr.')).toBe('123,45\u00A0kr.');
    });
  });

  describe('normalizeRightAlignedTextForPdf', () => {
    it('fjerner ikke-brydende mellemrum efter fælles normalisering', () => {
      expect(normalizeRightAlignedTextForPdf('123,45 kr. ≤')).toBe('123,45 kr. <=');
    });
  });
});
