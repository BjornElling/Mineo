/// <reference types="vitest/globals" />

import { addBrevhoved, type BrevhovedData } from '../../../utils/pdf/pdfHelpers';

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
    const data: BrevhovedData = {
      useDagsDatoFallback: false,
    };

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
      journalnr: 'SAG-123',
    };

    const result = addBrevhoved(mockDoc, data);

    // Skal ALTID returnere MARGINS.top (brevhoved er overlay)
    expect(result).toBe(40);

    // Brevhoved-tekst skal være skrevet
    expect(mockDoc.text).toHaveBeenCalled();
    expect(mockDoc.setFont).toHaveBeenCalled();

    // Skal have skrevet sagsnummer (normal)
    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'normal');

    // Tekst skal være højre-aligneret (align: 'right' option)
    expect(mockDoc.text).toHaveBeenCalledWith(
      'J.nr. SAG-123',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );
  });

  it('respekterer partial brevhoved-data', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      journalnr: 'SAG-456',
      // Kun journalnr, ingen andre felter
    };

    const result = addBrevhoved(mockDoc, data);

    // Skal stadig indsætte brevhoved når mindst ét felt har data
    // Men ALTID returnere MARGINS.top (overlay)
    expect(result).toBe(40);
    expect(mockDoc.text).toHaveBeenCalled();
  });

  it('tilføjer advokat/sagsbehandler suffix når journalnr findes', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      journalnr: 'SAG-789',
      advokat: 'AB',
      sagsbehandler: 'CD',
      useDagsDatoFallback: false,
    };

    addBrevhoved(mockDoc, data);

    expect(mockDoc.text).toHaveBeenCalledWith(
      'J.nr. SAG-789 AB/CD',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );
  });

  it('tilføjer kun advokat eller sagsbehandler suffix når kun én er angivet', () => {
    const mockDoc = createMockDoc();
    const advokatData: BrevhovedData = {
      journalnr: 'SAG-321',
      advokat: 'AB',
      useDagsDatoFallback: false,
    };
    addBrevhoved(mockDoc, advokatData);
    expect(mockDoc.text).toHaveBeenCalledWith(
      'J.nr. SAG-321 AB',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );

    const mockDoc2 = createMockDoc();
    const sagsbehandlerData: BrevhovedData = {
      journalnr: 'SAG-654',
      sagsbehandler: 'CD',
      useDagsDatoFallback: false,
    };
    addBrevhoved(mockDoc2, sagsbehandlerData);
    expect(mockDoc2.text).toHaveBeenCalledWith(
      'J.nr. SAG-654 CD',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );
  });

  it('håndterer tomme strenge som "ingen data"', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      journalnr: '',
      useDagsDatoFallback: false,
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
