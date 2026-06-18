/// <reference types="vitest/globals" />

import { normalizeRightAlignedTextForDocument, normalizeTextForDocument } from '../../../document/layout/pdfTextUtils';

describe('pdfTextUtils', () => {
  describe('normalizeTextForDocument', () => {
    it('normaliserer PDF-usikre Unicode-tegn til ASCII-fallbacks', () => {
      expect(
        normalizeTextForDocument('Kapitaliseret pga. ≤ 2 år til folkepension? “Nej” • test … >=?')
      ).toBe('Kapitaliseret pga. <= 2 år til folkepension? "Nej" - test ... >=?');
    });

    it('normaliserer pile og sammenligningsoperatorer brugt i PDF-kode', () => {
      expect(normalizeTextForDocument('A → B, C ← D, E ↔ F, x ≥ y, x ≠ y, x ≈ y')).toBe(
        'A -> B, C <- D, E <-> F, x >= y, x != y, x ~= y'
      );
    });

    it('bevarer ikke-brydende mellemrum mellem tal og kr.', () => {
      expect(normalizeTextForDocument('123,45 kr.')).toBe('123,45\u00A0kr.');
    });
  });

  describe('normalizeRightAlignedTextForDocument', () => {
    it('fjerner ikke-brydende mellemrum efter fælles normalisering', () => {
      expect(normalizeRightAlignedTextForDocument('123,45 kr. ≤')).toBe('123,45 kr. <=');
    });
  });
});
