/// <reference types="vitest/globals" />

import { createDate } from '../../../utils/dateUtils';
import { buildAarsloenDocumentFilename } from '../../../document/generators/aarsloen/aarsloenDocument';
import { buildVarigeMenDocumentFilename } from '../../../document/generators/varigemen/varigeMenDocument';
import { buildRenteDocumentBaseTitle, buildRenteDocumentFilename } from '../../../document/generators/renteberegning/renteDocument';
import { buildSHDageDocumentFilename } from '../../../document/generators/aarsloen/shDageDocument';
import { buildSatserDocumentFilename } from '../../../document/generators/satser/satserDocument';
import { buildReguleringDocumentFilename } from '../../../document/generators/eo/reguleringDocument';
import { buildKRLDocumentFilename } from '../../../document/generators/krl/krlDocument';
import { resolveDocumentArtifactFileName } from '../../../document/layout/documentFormatUtils';
import { toDanishDateString } from '../../../types/branded';

describe('pdf filename builders', () => {
  describe('buildAarsloenDocumentFilename', () => {
    it('prefixer med journalnr når journalnr er udfyldt', () => {
      expect(buildAarsloenDocumentFilename('1234')).toBe('1234 - Årslønsberegning.pdf');
    });

    it('udelader prefix når journalnr er tomt', () => {
      expect(buildAarsloenDocumentFilename('')).toBe('Årslønsberegning.pdf');
    });
  });

  describe('buildVarigeMenDocumentFilename', () => {
    it('prefixer med journalnr når journalnr er udfyldt', () => {
      expect(buildVarigeMenDocumentFilename('1234')).toBe('1234 - Méngodtgørelse.pdf');
    });

    it('udelader prefix når journalnr er tomt', () => {
      expect(buildVarigeMenDocumentFilename('')).toBe('Méngodtgørelse.pdf');
    });
  });

  describe('buildRenteDocumentFilename', () => {
    it('bygger nyt procesrente-format med journalnr', () => {
      const start = createDate(2025, 3, 11);
      const end = createDate(2025, 7, 17);
      // Kontrakt: filnavnsdatoer er i DD-MM-YYYY-format.
      const baseTitle = buildRenteDocumentBaseTitle(5000, start, end);
      const filename = buildRenteDocumentFilename(baseTitle, '1234');
      expect(filename).toBe('1234 - Procesrente, 5.000,00 kr. (11-04-2025 - 17-08-2025).pdf');
    });

    it('udelader journalnr-prefix når journalnr er tomt', () => {
      const start = createDate(2025, 3, 11);
      const end = createDate(2025, 7, 17);
      const baseTitle = buildRenteDocumentBaseTitle(5000, start, end);
      const filename = buildRenteDocumentFilename(baseTitle, '');
      expect(filename).toBe('Procesrente, 5.000,00 kr. (11-04-2025 - 17-08-2025).pdf');
    });
  });

  describe('buildSHDageDocumentFilename', () => {
    it('bygger periodekæde med plus og journalnr-prefix', () => {
      const filename = buildSHDageDocumentFilename([
        { start: createDate(2025, 3, 11), end: createDate(2025, 7, 17) },
        { start: createDate(2025, 7, 19), end: createDate(2026, 11, 21) },
      ], '1234');
      expect(filename).toBe('1234 - SH-dage (11-04-2025 - 17-08-2025 + 19-08-2025 - 21-12-2026).pdf');
    });

    it('udelader journalnr-prefix når journalnr er tomt', () => {
      const filename = buildSHDageDocumentFilename([
        { start: createDate(2025, 3, 11), end: createDate(2025, 7, 17) },
      ], '');
      expect(filename).toBe('SH-dage (11-04-2025 - 17-08-2025).pdf');
    });
  });

  describe('buildSatserDocumentFilename', () => {
    it('bygger satser-filnavn i konsolideret builder', () => {
      expect(buildSatserDocumentFilename(2026)).toBe('Arbejdsskadesatser 2026.pdf');
    });
  });

  describe('buildReguleringDocumentFilename', () => {
    it('bevarer regulering-format inkl. sanitization', () => {
      const fraDato = toDanishDateString('01-01-2026');
      const tilDato = toDanishDateString('31-12-2026');
      const filename = buildReguleringDocumentFilename({
        loenudviklingBasis: 'Overenskomst',
        valgtLabel: 'Test: Label',
        interval: { fraDato, tilDato },
      });
      expect(filename).toBe('Regulering - Overenskomst - Test_ Label (01-01-2026 til 31-12-2026).pdf');
    });

    it('prefixer med journalnr når journalnr er udfyldt', () => {
      const fraDato = toDanishDateString('01-01-2026');
      const tilDato = toDanishDateString('31-12-2026');
      const filename = buildReguleringDocumentFilename({
        loenudviklingBasis: 'Overenskomst',
        valgtLabel: 'Test',
        interval: { fraDato, tilDato },
        journalnr: '1234',
      });
      expect(filename).toBe('1234 - Regulering - Overenskomst - Test (01-01-2026 til 31-12-2026).pdf');
    });
  });

  describe('buildKRLDocumentFilename', () => {
    it('bygger KRL-filnavn via kanonisk helper', () => {
      expect(buildKRLDocumentFilename()).toBe('KRL Satstabeller.pdf');
    });

    it('prefixer med journalnr når journalnr er udfyldt', () => {
      expect(buildKRLDocumentFilename('1234')).toBe('1234 - KRL Satstabeller.pdf');
    });
  });

  describe('resolveDocumentArtifactFileName', () => {
    it('tilføjer udkast-suffix når isDraft=true', () => {
      expect(resolveDocumentArtifactFileName('Testtitel', true, '1234')).toBe('1234 - Testtitel (udkast).pdf');
    });

    it('saniterer windows-ulovlige tegn i baseTitle', () => {
      expect(resolveDocumentArtifactFileName('A<B>:C"D/E\\F|G?H*I', false)).toBe('A_B__C_D_E_F_G_H_I.pdf');
    });

    it('saniterer windows-ulovlige tegn i journalnr', () => {
      expect(resolveDocumentArtifactFileName('Titel', false, 'J:12/34')).toBe('J_12_34 - Titel.pdf');
    });
  });
});
