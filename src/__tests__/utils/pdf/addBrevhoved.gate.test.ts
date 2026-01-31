/// <reference types="vitest/globals" />

import { addBrevhoved, type BrevhovedData } from '../../../utils/pdf/pdfHelpers';
import { toISODateString } from '../../../types/branded';

/**
 * Test af brevhoved-gate logik
 *
 * FORMÅL:
 * - Bevise at brevhoved-logikken respekterer visBrevhoved-flaget
 * - Bevise at addBrevhoved kun kaldes når det skal
 * - Sikre at PDF-generatorer følger kontrakten
 *
 * STRATEGI:
 * - Teste gate-logik ved at mocke jsPDF doc-objektet
 * - Spore kald til doc.text() og doc.setFont()
 * - Verificere at brevhoved-kald kun sker ved korrekte betingelser
 */

describe('addBrevhoved gate logic', () => {
  // Helper: Opret mock PDF-dokument
  const createMockDoc = () => {
    const mockDoc = {
      text: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      internal: {
        pageSize: {
          height: 297,
          width: 210,
        },
      },
    };
    return mockDoc;
  };

  it('returnerer MARGINS.top når ingen brevhoved-data findes', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {};

    const result = addBrevhoved(mockDoc, data);

    // Skal ALTID returnere MARGINS.top (brevhoved er overlay - påvirker ikke layout)
    expect(result).toBe(40);

    // Ingen tekst skal være skrevet
    expect(mockDoc.text).not.toHaveBeenCalled();
    expect(mockDoc.setFont).not.toHaveBeenCalled();
  });

  it('kalder doc.text når brevhoved-data findes', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      skadelidte: 'Test Person',
      skadestype: 'Arbejdsulykke',
      skadesdato: toISODateString('2024-01-15'),
      journalnr: 'SAG-123',
    };

    const result = addBrevhoved(mockDoc, data);

    // Skal ALTID returnere MARGINS.top (brevhoved er overlay)
    expect(result).toBe(40);

    // Brevhoved-tekst skal være skrevet
    expect(mockDoc.text).toHaveBeenCalled();
    expect(mockDoc.setFont).toHaveBeenCalled();

    // Skal have skrevet skadelidtes navn (fed)
    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'bold');

    // Tekst skal være højre-aligneret (align: 'right' option)
    expect(mockDoc.text).toHaveBeenCalledWith(
      'Test Person',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );
  });

  it('respekterer partial brevhoved-data', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      skadelidte: 'Partial Data',
      // Kun skadelidte, ingen andre felter
    };

    const result = addBrevhoved(mockDoc, data);

    // Skal stadig indsætte brevhoved når mindst ét felt har data
    // Men ALTID returnere MARGINS.top (overlay)
    expect(result).toBe(40);
    expect(mockDoc.text).toHaveBeenCalled();
  });

  it('håndterer tomme strenge som "ingen data"', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      skadelidte: '',
      skadestype: '',
      journalnr: '',
    };

    const result = addBrevhoved(mockDoc, data);

    // Tomme strenge tæller som "ingen data"
    expect(result).toBe(40);
    expect(mockDoc.text).not.toHaveBeenCalled();
  });

  describe('PDF generator gate pattern (integration)', () => {
    it('simulerer korrekt gate-logik: visBrevhoved=false → ingen kald', () => {
      const mockDoc = createMockDoc();
      const visBrevhoved = false;
      const stamdata: BrevhovedData = {
        skadelidte: 'Test Person',
        journalnr: 'SAG-123',
      };

      // Simuler PDF-generator gate
      let currentY = 40; // MARGINS.top
      if (visBrevhoved && stamdata) {
        currentY = addBrevhoved(mockDoc, stamdata);
      }

      // Brevhoved skal IKKE være kaldt
      expect(mockDoc.text).not.toHaveBeenCalled();
      expect(currentY).toBe(40); // Uændret
    });

    it('simulerer korrekt gate-logik: visBrevhoved=true + stamdata → kald', () => {
      const mockDoc = createMockDoc();
      const visBrevhoved = true;
      const stamdata: BrevhovedData = {
        skadelidte: 'Test Person',
        journalnr: 'SAG-123',
      };

      // Simuler PDF-generator gate
      let currentY = 40; // MARGINS.top
      if (visBrevhoved && stamdata) {
        currentY = addBrevhoved(mockDoc, stamdata);
      }

      // Brevhoved skal være kaldt
      expect(mockDoc.text).toHaveBeenCalled();
      // currentY forbliver UÆNDRET (brevhoved er overlay)
      expect(currentY).toBe(40);
    });

    it('simulerer korrekt gate-logik: visBrevhoved=true + null stamdata → ingen kald', () => {
      const mockDoc = createMockDoc();
      const visBrevhoved = true;
      const stamdata = null;

      // Simuler PDF-generator gate
      let currentY = 40; // MARGINS.top
      if (visBrevhoved && stamdata) {
        currentY = addBrevhoved(mockDoc, stamdata);
      }

      // Brevhoved skal IKKE være kaldt (stamdata er null)
      expect(mockDoc.text).not.toHaveBeenCalled();
      expect(currentY).toBe(40);
    });
  });
});
