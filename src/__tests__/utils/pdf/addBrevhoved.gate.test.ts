// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { renderBrevhoved } from '../../../pdf/infrastructure/pdfBrevhovedRenderer';
import type { BrevhovedData } from '../../../document/layout/documentLayoutHelpers';
import { toISODateString } from '../../../types/branded';
import { createMockPdfDocumentAdapter } from './mockPdfDocumentAdapter';

/**
 * Test af brevhoved-rendering
 *
 * FORMÅL:
 * - Dato-linjen skal altid vises når brevhoved-rendereren kaldes
 * - Journalnr-linjen er den eneste betingede linje
 * - PDF-generatorer styrer om brevhoved kaldes (visBrevhoved)
 */

describe('renderBrevhoved', () => {

  it('render dato-linjen altid', () => {
    const mockDoc = createMockPdfDocumentAdapter();
    const data: BrevhovedData = {
      dagsDatoISO: toISODateString('2026-02-02'),
    };

    const result = renderBrevhoved(mockDoc, data);

    // Skal ALTID returnere MARGINS.top (brevhoved er overlay - påvirker ikke layout)
    expect(result).toBe(40);

    // Dato-linjen skal altid skrives
    expect(mockDoc.text).toHaveBeenCalledTimes(1);
    expect(mockDoc.setFont).toHaveBeenCalledWith('helvetica', 'normal');
    const firstCall = mockDoc.text.mock.calls[0] as [string, ...unknown[]];
    const [text] = firstCall;
    expect(typeof text).toBe('string');
    expect(text.trim()).not.toBe('');
  });

  it('kalder doc.text når brevhoved-data findes', () => {
    const mockDoc = createMockPdfDocumentAdapter();
    const data: BrevhovedData = {
      journalnr: 'SAG-123',
      dagsDatoISO: toISODateString('2026-02-02'),
    };

    const result = renderBrevhoved(mockDoc, data);

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
    const mockDoc = createMockPdfDocumentAdapter();
    const data: BrevhovedData = {
      journalnr: 'SAG-456',
      dagsDatoISO: toISODateString('2026-02-02'),
      // Kun journalnr, ingen andre felter
    };

    const result = renderBrevhoved(mockDoc, data);

    // Skal stadig indsætte brevhoved når mindst ét felt har data
    // Men ALTID returnere MARGINS.top (overlay)
    expect(result).toBe(40);
    expect(mockDoc.text).toHaveBeenCalled();
  });

  it('tilføjer advokat/sagsbehandler suffix når journalnr findes', () => {
    const mockDoc = createMockPdfDocumentAdapter();
    const data: BrevhovedData = {
      journalnr: 'SAG-789',
      advokat: 'AB',
      sagsbehandler: 'CD',
      dagsDatoISO: toISODateString('2026-02-02'),
    };

    renderBrevhoved(mockDoc, data);

    expect(mockDoc.text).toHaveBeenCalledWith(
      'J.nr. SAG-789 AB/CD',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );
  });

  it('tilføjer kun advokat eller sagsbehandler suffix når kun én er angivet', () => {
    const mockDoc = createMockPdfDocumentAdapter();
    const advokatData: BrevhovedData = {
      journalnr: 'SAG-321',
      advokat: 'AB',
      dagsDatoISO: toISODateString('2026-02-02'),
    };
    renderBrevhoved(mockDoc, advokatData);
    expect(mockDoc.text).toHaveBeenCalledWith(
      'J.nr. SAG-321 AB',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );

    const mockDoc2 = createMockPdfDocumentAdapter();
    const sagsbehandlerData: BrevhovedData = {
      journalnr: 'SAG-654',
      sagsbehandler: 'CD',
      dagsDatoISO: toISODateString('2026-02-02'),
    };
    renderBrevhoved(mockDoc2, sagsbehandlerData);
    expect(mockDoc2.text).toHaveBeenCalledWith(
      'J.nr. SAG-654 CD',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );
  });

  it('viser dato-linjen selv når journalnr er tom streng', () => {
    const mockDoc = createMockPdfDocumentAdapter();
    const data: BrevhovedData = {
      journalnr: '',
      dagsDatoISO: toISODateString('2026-02-02'),
    };

    const result = renderBrevhoved(mockDoc, data);

    // Dato-linjen skal stadig skrives
    expect(result).toBe(40);
    expect(mockDoc.text).toHaveBeenCalledTimes(1);
  });

  it('bruger den dato der leveres fra kaldestedet', () => {
    const mockDoc = createMockPdfDocumentAdapter();
    const data: BrevhovedData = {
      journalnr: 'SAG-777',
      dagsDatoISO: toISODateString('2026-01-15'),
    };

    renderBrevhoved(mockDoc, data);

    const calls = mockDoc.text.mock.calls as [string, ...unknown[]][];
    expect(calls.some(([text]) => String(text).includes('15. januar 2026'))).toBe(true);
  });

  it('kaster ved ugyldig dagsDatoISO', () => {
    const mockDoc = createMockPdfDocumentAdapter();
    const data = {
      dagsDatoISO: '' as ReturnType<typeof toISODateString>,
    };

    expect(() => renderBrevhoved(mockDoc, data)).toThrow('CRITICAL');
  });

  it('behandler journalnr med kun mellemrum som tom (ingen J.nr.-linje)', () => {
    const mockDoc = createMockPdfDocumentAdapter();
    const data: BrevhovedData = {
      journalnr: '   ',
      dagsDatoISO: toISODateString('2026-02-02'),
    };

    renderBrevhoved(mockDoc, data);

    // Kun dato-linjen – ingen J.nr.-linje
    expect(mockDoc.text).toHaveBeenCalledTimes(1);
    const [[firstText]] = mockDoc.text.mock.calls as [string, ...unknown[]][];
    expect(String(firstText)).not.toContain('J.nr.');
  });

  it('ignorerer advokat og sagsbehandler med kun mellemrum', () => {
    const mockDoc = createMockPdfDocumentAdapter();
    const data: BrevhovedData = {
      journalnr: 'SAG-999',
      advokat: '  ',
      sagsbehandler: '  ',
      dagsDatoISO: toISODateString('2026-02-02'),
    };

    renderBrevhoved(mockDoc, data);

    // Ingen suffix – kun journalnr
    expect(mockDoc.text).toHaveBeenCalledWith(
      'J.nr. SAG-999',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'right' })
    );
  });

  describe('PDF generator gate pattern (integration)', () => {
    it('simulerer korrekt gate-logik: visBrevhoved=false → ingen kald', () => {
      const mockDoc = createMockPdfDocumentAdapter();
      const visBrevhoved = false;
      const stamdata: BrevhovedData = {
        journalnr: 'SAG-123',
        dagsDatoISO: toISODateString('2026-02-02'),
      };

      // Simuler PDF-generator gate
      let currentY = 40; // MARGINS.top
      if (visBrevhoved && stamdata) {
        currentY = renderBrevhoved(mockDoc, stamdata);
      }

      // Brevhoved skal IKKE være kaldt
      expect(mockDoc.text).not.toHaveBeenCalled();
      expect(currentY).toBe(40); // Uændret
    });

    it('simulerer korrekt gate-logik: visBrevhoved=true + stamdata → kald', () => {
      const mockDoc = createMockPdfDocumentAdapter();
      const visBrevhoved = true;
      const stamdata: BrevhovedData = {
        journalnr: 'SAG-123',
        dagsDatoISO: toISODateString('2026-02-02'),
      };

      // Simuler PDF-generator gate
      let currentY = 40; // MARGINS.top
      if (visBrevhoved && stamdata) {
        currentY = renderBrevhoved(mockDoc, stamdata);
      }

      // Brevhoved skal være kaldt
      expect(mockDoc.text).toHaveBeenCalled();
      // currentY forbliver UÆNDRET (brevhoved er overlay)
      expect(currentY).toBe(40);
    });

    it('simulerer korrekt gate-logik: visBrevhoved=true + null stamdata → kald', () => {
      const mockDoc = createMockPdfDocumentAdapter();
      const visBrevhoved = true;

      // Simuler PDF-generator gate
      let currentY = 40; // MARGINS.top
      if (visBrevhoved) {
        currentY = renderBrevhoved(mockDoc, { dagsDatoISO: toISODateString('2026-02-02') });
      }

      // Brevhoved skal være kaldt (dato-linjen vises altid)
      expect(mockDoc.text).toHaveBeenCalled();
      expect(currentY).toBe(40);
    });
  });
});
