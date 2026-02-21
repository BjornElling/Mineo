/// <reference types="vitest/globals" />

class MockJsPDF {
  internal = { pageSize: { width: 210, height: 297 } };
  setFont = vi.fn();
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  addImage = vi.fn();
  addPage = vi.fn();
  line = vi.fn();
  setLineWidth = vi.fn();
  text = vi.fn();
  setDisplayMode = vi.fn();
  setProperties = vi.fn();
  getNumberOfPages = vi.fn(() => 1);
  setPage = vi.fn();
  splitTextToSize = vi.fn((text: string) => [text]);
  getTextWidth = vi.fn((text: string) => text.length);
  save = vi.fn();
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

describe('pdfWriter layout fallback', () => {
  it('kalder onLayoutFallback når højre kolonne ikke kan være på linjen', async () => {
    const { createStandardPdfWriter } = await import('../../../utils/pdf/pdfWriter');
    const onLayoutFallback = vi.fn();
    const writer = createStandardPdfWriter({ onLayoutFallback });

    writer.writeLeftRightText('Venstre', 'X'.repeat(1000));

    expect(onLayoutFallback).toHaveBeenCalledTimes(1);
    expect(onLayoutFallback).toHaveBeenCalledWith(
      expect.stringContaining('højre kolonne er bredere end tilgængelig plads')
    );
  });

  it('kalder ikke onLayoutFallback når højre kolonne kan være på linjen', async () => {
    const { createStandardPdfWriter } = await import('../../../utils/pdf/pdfWriter');
    const onLayoutFallback = vi.fn();
    const writer = createStandardPdfWriter({ onLayoutFallback });

    writer.writeLeftRightText('Venstre', '123,45 kr.');

    expect(onLayoutFallback).not.toHaveBeenCalled();
  });
});
