/// <reference types="vitest/globals" />

import {
  normalizeRightAlignedTextForDocument,
  normalizeTextForDocument,
  toPdfStandardFontText,
} from '../../../document/layout/pdfTextUtils';

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

  // Ét tegn uden for standardfontens tegnsæt får jsPDF til at sprede
  // hele linjen («A u k a s z  { a k»). Saneringen skal derfor dække ALLE sådanne tegn.
  describe('toPdfStandardFontText', () => {
    const NBSP = String.fromCharCode(0xa0);
    const isStandardFontText = (value: string): boolean =>
      [...value].every((char) => (char.codePointAt(0) ?? 0) <= 0xff || '€‚ƒ„†‡ˆ‰Š‹ŒŽ‘˜™š›œžŸ'.includes(char));

    it.each([
      ['Łukasz Żak', 'Lukasz Zak'],
      ['Łódź', 'Lódz'],
      ['Żółć', 'Zólc'],
      ['ąćęłńśźż ĄĆĘŁŃŚŹŻ', 'acelnszz ACELNSZZ'],
      ['Đorđe Ħ ı ő ű č ř ğ ş', 'Dorde H i o u c r g s'],
    ])('translittererer %s', (input, expected) => {
      expect(toPdfStandardFontText(input)).toBe(expected);
    });

    it('bevarer alle tegn, standardfonten kan vise', () => {
      const value = 'æøåÆØÅ éóüöäÉÓÜ ß ç ñ « » § ½ € Š ž Œ ™';
      expect(toPdfStandardFontText(value)).toBe(value);
    });

    it('sammensætter dekomponeret input, så en gengivelig accent bevares', () => {
      expect(toPdfStandardFontText('e\u0301 a\u030A')).toBe('é å');
    });

    it('fjerner usynlige formattegn og erstatter ikke-repræsenterbare tegn, så linjen ikke spredes', () => {
      const result = toPdfStandardFontText('A\u200BB 漢 😀 ✓');
      expect(result).toBe('AB ? ? ?');
      expect(isStandardFontText(result)).toBe(true);
    });

    it('omsætter kompatibilitetstegn (ligaturer, specielle mellemrum) til deres basisform', () => {
      expect(toPdfStandardFontText('ﬁl\u2009x')).toBe('fil x');
    });

    it('er idempotent', () => {
      const once = toPdfStandardFontText('Łukasz Żak ≤ 漢');
      expect(toPdfStandardFontText(once)).toBe(once);
    });

    it('anvendes af normalizeTextForDocument', () => {
      expect(normalizeTextForDocument('Łódź 100 kr.')).toBe('Lódz 100' + NBSP + 'kr.');
    });
  });

  describe('normalizeRightAlignedTextForDocument', () => {
    it('fjerner ikke-brydende mellemrum efter fælles normalisering', () => {
      expect(normalizeRightAlignedTextForDocument('123,45 kr. ≤')).toBe('123,45 kr. <=');
    });
  });
});
