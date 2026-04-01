/// <reference types="vitest/globals" />

import { ensurePdfPageSpace, addFooter, clearFooterImageCacheForTests } from '../../../pdf/shared/pdfHelpers';
import { MARGINS } from '../../../pdf/infrastructure/pdfConfig';
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
  beforeEach(() => {
    clearFooterImageCacheForTests();
  });

  // JSDOM kan ikke verificere pixeloutput på canvas stabilt.
  // Testen verificerer derfor kun, at rendererens output/data propageres korrekt til addImage.
  it('indsætter footer som billede når canvas-context er tilgængelig', () => {
    const doc = createMockPdfDocumentAdapter();
    const originalCreateElement = document.createElement.bind(document);
    const mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn(() => ({ width: 84 })),
      font: '',
      fillStyle: '',
      textAlign: 'center' as const,
      textBaseline: 'middle' as const,
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,mock-footer'),
    };
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) => {
        if (tagName.toLowerCase() === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName as keyof HTMLElementTagNameMap);
      }) as typeof document.createElement);

    try {
      addFooter(doc);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(doc.setPage).toHaveBeenCalledWith(1);
    expect(mockCanvas.width).toBe(120);
    expect(mockCanvas.height).toBe(576);
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(doc.addImage).toHaveBeenCalledTimes(1);
    expect(doc.addImage).toHaveBeenCalledWith(
      'data:image/jpeg;base64,mock-footer',
      'JPEG',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      'mineo_footer_version',
      'FAST'
    );
    expect(doc.text).not.toHaveBeenCalled();
  });

  it('itererer over alle sider', () => {
    const doc = createMockPdfDocumentAdapter();
    const originalCreateElement = document.createElement.bind(document);
    const mockContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn(() => ({ width: 84 })),
      font: '',
      fillStyle: '',
      textAlign: 'center' as const,
      textBaseline: 'middle' as const,
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,mock-footer'),
    };
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) => {
        if (tagName.toLowerCase() === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName as keyof HTMLElementTagNameMap);
      }) as typeof document.createElement);
    doc.getNumberOfPages.mockReturnValue(3);

    try {
      addFooter(doc);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(doc.setPage).toHaveBeenCalledTimes(3);
    expect(doc.setPage).toHaveBeenCalledWith(1);
    expect(doc.setPage).toHaveBeenCalledWith(2);
    expect(doc.setPage).toHaveBeenCalledWith(3);
    expect(mockCanvas.toDataURL).toHaveBeenCalledTimes(1);
    expect(doc.addImage).toHaveBeenCalledTimes(3);
    expect(doc.text).not.toHaveBeenCalled();
  });

  it('falder tilbage til tekst-footer med angle: 90 når canvas-context mangler', () => {
    const doc = createMockPdfDocumentAdapter();
    const originalCreateElement = document.createElement.bind(document);
    const mockCanvas = {
      getContext: vi.fn(() => null),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,unused'),
    };
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) => {
        if (tagName.toLowerCase() === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName as keyof HTMLElementTagNameMap);
      }) as typeof document.createElement);

    try {
      addFooter(doc);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(doc.addImage).not.toHaveBeenCalled();
    expect(doc.setFontSize).toHaveBeenCalledWith(6);
    expect(doc.setFont).toHaveBeenCalledWith('helvetica', 'normal');
    expect(doc.setTextColor).toHaveBeenCalledWith(200, 200, 200);
    expect(doc.text).toHaveBeenCalledWith(
      expect.stringContaining('Mineo.dk'),
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ angle: 90 })
    );
  });
});
