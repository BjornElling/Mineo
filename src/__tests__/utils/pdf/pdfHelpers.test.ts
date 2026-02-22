/// <reference types="vitest/globals" />

import { ensurePdfPageSpace, addFooter } from '../../../utils/pdf/pdfHelpers';
import { MARGINS } from '../../../utils/pdf/pdfConfig';
import { createMockPdfDocumentAdapter } from './mockPdfDocumentAdapter';

/**
 * Tests for pdfHelpers
 *
 * Dækker:
 * - ensurePdfPageSpace: sideskift-logik
 * - addFooter: footer-rendering på alle sider
 */

describe('ensurePdfPageSpace', () => {
  it('returnerer startY uændret når der er plads', () => {
    const doc = createMockPdfDocumentAdapter();
    // pageHeight = 297, contentBottom = 297 - 20 = 277
    // startY=100, requiredSpace=50 → 150 <= 277 → ingen sideskift
    const result = ensurePdfPageSpace(doc, 100, 50);
    expect(result).toBe(100);
    expect(doc.addPage).not.toHaveBeenCalled();
  });

  it('kalder addPage og returnerer MARGINS.top når der ikke er plads', () => {
    const doc = createMockPdfDocumentAdapter();
    // pageHeight = 297, contentBottom = 297 - 20 = 277
    // startY=250, requiredSpace=50 → 300 > 277 → sideskift
    const result = ensurePdfPageSpace(doc, 250, 50);
    expect(doc.addPage).toHaveBeenCalledTimes(1);
    expect(result).toBe(MARGINS.top);
  });

  it('returnerer startY uændret når requiredSpace passer præcist', () => {
    const doc = createMockPdfDocumentAdapter();
    // contentBottom = 277, startY=227, requiredSpace=50 → 277 <= 277 → ingen sideskift
    const result = ensurePdfPageSpace(doc, 227, 50);
    expect(result).toBe(227);
    expect(doc.addPage).not.toHaveBeenCalled();
  });

  it('kalder addPage ved præcis overgang', () => {
    const doc = createMockPdfDocumentAdapter();
    // contentBottom = 277, startY=228, requiredSpace=50 → 278 > 277 → sideskift
    const result = ensurePdfPageSpace(doc, 228, 50);
    expect(doc.addPage).toHaveBeenCalledTimes(1);
    expect(result).toBe(MARGINS.top);
  });
});

describe('addFooter', () => {
  it('kalder setPage, setFontSize, setFont, setTextColor og text for hver side', () => {
    const doc = createMockPdfDocumentAdapter();
    // getNumberOfPages returnerer 1 (default fra mock)
    addFooter(doc);

    expect(doc.setPage).toHaveBeenCalledWith(1);
    expect(doc.setFontSize).toHaveBeenCalledWith(6);
    expect(doc.setFont).toHaveBeenCalledWith('helvetica', 'normal');
    expect(doc.setTextColor).toHaveBeenCalledWith(200, 200, 200);
    expect(doc.text).toHaveBeenCalledTimes(1);
  });

  it('itererer over alle sider', () => {
    const doc = createMockPdfDocumentAdapter();
    doc.getNumberOfPages.mockReturnValue(3);

    addFooter(doc);

    expect(doc.setPage).toHaveBeenCalledTimes(3);
    expect(doc.setPage).toHaveBeenCalledWith(1);
    expect(doc.setPage).toHaveBeenCalledWith(2);
    expect(doc.setPage).toHaveBeenCalledWith(3);
    expect(doc.text).toHaveBeenCalledTimes(3);
  });

  it('placerer footer-tekst med angle: 90', () => {
    const doc = createMockPdfDocumentAdapter();
    addFooter(doc);

    expect(doc.text).toHaveBeenCalledWith(
      expect.stringContaining('Mineo.dk'),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ angle: 90 })
    );
  });
});
