/// <reference types="vitest/globals" />

import { addBrevhoved, type BrevhovedData } from '../../../utils/pdf/pdfHelpers';
import { toISODateString } from '../../../types/branded';

/**
 * Test af brevhoved-rendering
 *
 * FORMÅL:
 * - Dato-linjen skal altid vises når addBrevhoved kaldes
 * - Journalnr-linjen er den eneste betingede linje
 * - PDF-generatorer styrer om brevhoved kaldes (visBrevhoved)
 */

describe('addBrevhoved rendering', () => {
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

  it('render dato-linjen altid', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      dagsDatoISO: toISODateString('2026-02-02'),
    };

    const result = addBrevhoved(mockDoc, data);

    // Skal ALTID returnere MARGINS.top (brevhoved er overlay - påvirker ikke layout)
    expect(result).toBe(40);

    // Dato-linjen skal altid skrives
    expect(mockDoc.text).toHaveBeenCalledTimes(1);
    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'normal');
    const [text] = mockDoc.text.mock.calls[0];
    expect(typeof text).toBe('string');
    expect(text.trim()).not.toBe('');
  });

  it('kalder doc.text når brevhoved-data findes', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      journalnr: 'SAG-123',
      dagsDatoISO: toISODateString('2026-02-02'),
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
      dagsDatoISO: toISODateString('2026-02-02'),
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
      dagsDatoISO: toISODateString('2026-02-02'),
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
      dagsDatoISO: toISODateString('2026-02-02'),
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
      dagsDatoISO: toISODateString('2026-02-02'),
    };
    addBrevhoved(mockDoc2, sagsbehandlerData);
    expect(mockDoc2.text).toHaveBeenCalledWith(
      'J.nr. SAG-654 CD',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );
  });

  it('viser dato-linjen selv når journalnr er tom streng', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      journalnr: '',
      dagsDatoISO: toISODateString('2026-02-02'),
    };

    const result = addBrevhoved(mockDoc, data);

    // Dato-linjen skal stadig skrives
    expect(result).toBe(40);
    expect(mockDoc.text).toHaveBeenCalledTimes(1);
  });

  it('bruger den dato der leveres fra kaldestedet', () => {
    const mockDoc = createMockDoc();
    const data: BrevhovedData = {
      journalnr: 'SAG-777',
      dagsDatoISO: toISODateString('2026-01-15'),
    };

    addBrevhoved(mockDoc, data);

    const calls = mockDoc.text.mock.calls.map((call) => call[0]);
    expect(calls.some((text) => String(text).includes('15. januar 2026'))).toBe(true);
  });

  describe('PDF generator gate pattern (integration)', () => {
    it('simulerer korrekt gate-logik: visBrevhoved=false → ingen kald', () => {
      const mockDoc = createMockDoc();
      const visBrevhoved = false;
      const stamdata: BrevhovedData = {
        journalnr: 'SAG-123',
        dagsDatoISO: toISODateString('2026-02-02'),
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
        dagsDatoISO: toISODateString('2026-02-02'),
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

    it('simulerer korrekt gate-logik: visBrevhoved=true + null stamdata → kald', () => {
      const mockDoc = createMockDoc();
      const visBrevhoved = true;
      const stamdata = null;

      // Simuler PDF-generator gate
      let currentY = 40; // MARGINS.top
      if (visBrevhoved) {
        currentY = addBrevhoved(mockDoc, { dagsDatoISO: toISODateString('2026-02-02') });
      }

      // Brevhoved skal være kaldt (dato-linjen vises altid)
      expect(mockDoc.text).toHaveBeenCalled();
      expect(currentY).toBe(40);
    });
  });
});
