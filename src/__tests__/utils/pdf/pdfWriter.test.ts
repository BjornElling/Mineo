/// <reference types="vitest/globals" />

// ─── MockJsPDF ────────────────────────────────────────────────────────────────

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
  getTextWidth = vi.fn((text: string) => text.length * 2); // 2mm per tegn
  save = vi.fn();
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

// ─── Layout-fallback (eksisterende) ──────────────────────────────────────────

describe('pdfWriter layout fallback', () => {
  it('kalder onLayoutFallback når højre kolonne ikke kan være på linjen', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const onLayoutFallback = vi.fn();
    const writer = createStandardPdfWriter({ onLayoutFallback });

    writer.writeLeftRightText('Venstre', 'X'.repeat(1000));

    expect(onLayoutFallback).toHaveBeenCalledTimes(1);
    expect(onLayoutFallback).toHaveBeenCalledWith(
      expect.stringContaining('højre kolonne er bredere end tilgængelig plads')
    );
  });

  it('kalder ikke onLayoutFallback når højre kolonne kan være på linjen', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const onLayoutFallback = vi.fn();
    const writer = createStandardPdfWriter({ onLayoutFallback });

    writer.writeLeftRightText('Venstre', '123,45 kr.');

    expect(onLayoutFallback).not.toHaveBeenCalled();
  });

  it('normaliserer højrejusteret kr.-tekst til almindeligt mellemrum før rendering', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();

    writer.writeLeftRightText('Venstre', '123,45 kr.');

    const renderedRightTextCall = writer.getDoc().text.mock.calls.find(
      (call: unknown[]) => call[0] === '123,45 kr.'
    );

    expect(renderedRightTextCall).toBeDefined();
    expect(writer.getDoc().text.mock.calls.some((call: unknown[]) => call[0] === '123,45\u00A0kr.')).toBe(false);
  });

  it('placerer højreteksten på nederste venstrelinje og wrapper venstreteksten inden kolonnerne mødes', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const doc = writer.getDoc();

    doc.splitTextToSize.mockImplementation((text: string, maxWidth: number) => {
      const words = text.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if ((candidate.length * 2) <= maxWidth || current === '') {
          current = candidate;
          continue;
        }
        lines.push(current);
        current = word;
      }
      if (current) lines.push(current);
      return lines;
    });

    writer.writeLeftRightText(
      'Skadelidte var ufaglært og ansat i København, og satsen er i overenskomsten fastsat til',
      '184,45 kr./arbejdsdag',
      { minRightColumnWidth: 33 }
    );

    const renderedTexts = doc.text.mock.calls.map((call: unknown[]) => call[0]);
    const rightCall = doc.text.mock.calls.find((call: unknown[]) => call[0] === '184,45 kr./arbejdsdag');

    expect(renderedTexts.filter((value) => typeof value === 'string' && value !== '184,45 kr./arbejdsdag').length).toBeGreaterThan(1);
    expect(rightCall).toBeDefined();
    const leftLineCalls = doc.text.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && call[0] !== '184,45 kr./arbejdsdag'
    );
    expect(rightCall?.[2]).toBe(leftLineCalls[leftLineCalls.length - 1]?.[2]);
  });
});

// ─── Cursor / Y-position ─────────────────────────────────────────────────────

describe('pdfWriter cursor', () => {
  it('getY returnerer en positiv startværdi (MARGINS.top)', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    expect(writer.getY()).toBeGreaterThan(0);
  });

  it('setY opdaterer Y-positionen', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    writer.setY(100);
    expect(writer.getY()).toBe(100);
  });

  it('advanceY øger Y-positionen med delta', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const before = writer.getY();
    writer.advanceY(10);
    expect(writer.getY()).toBe(before + 10);
  });

  it('addSpacer øger Y-positionen', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const before = writer.getY();
    writer.addSpacer(5);
    expect(writer.getY()).toBeGreaterThan(before);
  });

  it('addSpacer med height=0 ændrer ikke Y-positionen', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const before = writer.getY();
    writer.addSpacer(0);
    expect(writer.getY()).toBe(before);
  });
});

// ─── writeWrappedText ─────────────────────────────────────────────────────────

describe('pdfWriter writeWrappedText', () => {
  it('øger Y-positionen efter at have skrevet tekst', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const before = writer.getY();
    writer.writeWrappedText('Hej verden');
    expect(writer.getY()).toBeGreaterThan(before);
  });
});

// ─── ensureSpace / addPage ────────────────────────────────────────────────────

describe('pdfWriter ensureSpace', () => {
  it('tilføjer ny side når der ikke er nok plads', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    // Flyt Y tæt på bunden (297mm - margin ~20mm = ~277mm)
    writer.setY(270);
    // Kræv mere plads end hvad der er tilbage
    writer.ensureSpace(50);
    // Efter ensureSpace er Y reset til MARGINS.top på ny side
    expect(writer.getY()).toBeLessThan(50);
  });

  it('tilføjer ikke ny side når der er tilstrækkelig plads', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const startY = writer.getY(); // MARGINS.top (~10mm)
    writer.ensureSpace(5);
    expect(writer.getY()).toBe(startY); // Y uændret
  });
});

// ─── addPage ─────────────────────────────────────────────────────────────────

describe('pdfWriter addPage', () => {
  it('nulstiller Y til MARGINS.top efter addPage', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    writer.setY(200);
    writer.addPage();
    expect(writer.getY()).toBeLessThan(50);
  });
});

// ─── getPageWidth ─────────────────────────────────────────────────────────────

describe('pdfWriter getPageWidth', () => {
  it('returnerer en positiv bredde for A4', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    expect(writer.getPageWidth()).toBeGreaterThan(0);
  });
});

// ─── writeTitle / writeSectionHeader / writeSubheader ─────────────────────────

describe('pdfWriter headers', () => {
  it('writeTitle øger Y-positionen', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const before = writer.getY();
    writer.writeTitle('Min titel');
    expect(writer.getY()).toBeGreaterThan(before);
  });

  it('writeSectionHeader øger Y-positionen', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const before = writer.getY();
    writer.writeSectionHeader('Sektion', 5);
    expect(writer.getY()).toBeGreaterThan(before);
  });

  it('holder sektionsoverskrift sammen med efterfølgende underoverskrift ved sideskift', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const { PDF_BASE_LINE_HEIGHT_MM } = await import('../../../pdf/infrastructure/pdfConfig');
    const writer = createStandardPdfWriter();

    const nearBottomY = 260;
    writer.setY(nearBottomY);
    writer.writeSectionHeader('Tabt arbejdsfortjeneste', PDF_BASE_LINE_HEIGHT_MM);

    expect(writer.getY()).toBeLessThan(nearBottomY);
  });

  it('writeSubheader øger Y-positionen', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const before = writer.getY();
    writer.writeSubheader('Underoverskrift', 5);
    expect(writer.getY()).toBeGreaterThan(before);
  });

  it('tilføjer ikke ekstra topafstand når writeSubheader følger direkte efter writeSectionHeader', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const { PDF_BASE_LINE_HEIGHT_MM, PDF_LINE_BOTTOM_SPACING_MM, PDF_SUBHEADER_BOTTOM_SPACING_MM } = await import('../../../pdf/infrastructure/pdfConfig');
    const writer = createStandardPdfWriter();

    writer.setY(100);
    writer.writeSectionHeader('Sektion', 5);
    const afterSectionHeader = writer.getY();

    writer.writeSubheader('Underoverskrift', 5);

    // Underoverskriften skal kun bruge sin egen teksthøjde + bundafstand,
    // ikke yderligere topafstand oven på section headerens bundafstand.
    expect(writer.getY() - afterSectionHeader).toBe(
      PDF_BASE_LINE_HEIGHT_MM + PDF_LINE_BOTTOM_SPACING_MM + PDF_SUBHEADER_BOTTOM_SPACING_MM
    );
  });

  it('holder sektionsoverskrift sammen med underoverskrift, når underoverskriften selv skal holdes sammen med næste tekstlinje', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const { PDF_BASE_LINE_HEIGHT_MM } = await import('../../../pdf/infrastructure/pdfConfig');
    const writer = createStandardPdfWriter();

    const nearBottomY = 255;
    writer.setY(nearBottomY);
    writer.writeSectionHeader('Sektion', PDF_BASE_LINE_HEIGHT_MM);

    expect(writer.getY()).toBeLessThan(nearBottomY);
  });

  it('holder underoverskrift sammen med næste underoverskrift, når den næste også skal holdes sammen med første tekstlinje', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const { PDF_BASE_LINE_HEIGHT_MM } = await import('../../../pdf/infrastructure/pdfConfig');
    const writer = createStandardPdfWriter();

    const nearBottomY = 260;
    writer.setY(nearBottomY);
    writer.writeSubheader('Første underoverskrift', PDF_BASE_LINE_HEIGHT_MM);

    expect(writer.getY()).toBeLessThan(nearBottomY);
  });
});

// ─── writeUnderlinedLabel ────────────────────────────────────────────────────

describe('pdfWriter writeUnderlinedLabel', () => {
  it('øger Y-positionen og kalder doc.line', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    const before = writer.getY();
    writer.writeUnderlinedLabel('Dato', 10);
    expect(writer.getY()).toBeGreaterThan(before);
    // Dokumenterer at underline-linjen tegnes (intern mock registrerer line-kald)
    expect(writer.getDoc().line).toHaveBeenCalled();
  });

  it('kollapser eksisterende manuel linjeafstand så der samlet kun er én linje over label', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const { PDF_BASE_LINE_HEIGHT_MM, PDF_LINE_BOTTOM_SPACING_MM, PDF_UNDERLINED_LABEL_TOP_SPACING_MM } = await import('../../../pdf/infrastructure/pdfConfig');
    const writer = createStandardPdfWriter();
    writer.setY(100);

    writer.addSpacer(5);
    writer.writeUnderlinedLabel('Offentlige ydelser', 10);

    // 100 -> normaliseret til standard topafstand + label-linje + bundafstand.
    expect(writer.getY()).toBe(
      100 + PDF_UNDERLINED_LABEL_TOP_SPACING_MM + PDF_BASE_LINE_HEIGHT_MM + PDF_LINE_BOTTOM_SPACING_MM
    );
  });

  it('kollapser flere manuelle spacere så der samlet kun er én linje over label', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const { PDF_BASE_LINE_HEIGHT_MM, PDF_LINE_BOTTOM_SPACING_MM, PDF_UNDERLINED_LABEL_TOP_SPACING_MM } = await import('../../../pdf/infrastructure/pdfConfig');
    const writer = createStandardPdfWriter();
    writer.setY(100);

    writer.addSpacer(5);
    writer.addSpacer(5);
    writer.writeUnderlinedLabel('Offentlige ydelser', 10);

    expect(writer.getY()).toBe(
      100 + PDF_UNDERLINED_LABEL_TOP_SPACING_MM + PDF_BASE_LINE_HEIGHT_MM + PDF_LINE_BOTTOM_SPACING_MM
    );
  });

  it('holder underlinjet label sammen med næste linje ved sideskift', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();

    // Tæt på bunden så label + næste linje ikke kan være på siden.
    const nearBottomY = 266;
    writer.setY(nearBottomY);
    writer.writeUnderlinedLabel('Offentlige ydelser', 10);

    // Skal være flyttet til ny side i stedet for at splitte.
    expect(writer.getY()).toBeLessThan(nearBottomY);
  });

  it('holder underlinjet label sammen med næste underoverskrift, når den næste også skal holdes sammen med første tekstlinje', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();

    const nearBottomY = 270;
    writer.setY(nearBottomY);
    writer.writeUnderlinedLabel('Underlinjet label', 10);

    expect(writer.getY()).toBeLessThan(nearBottomY);
  });
});

// ─── fitTextToWidth ───────────────────────────────────────────────────────────

describe('pdfWriter fitTextToWidth', () => {
  it('returnerer tekst uændret hvis den passer indenfor maxWidth', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();
    // MockJsPDF: getTextWidth = text.length * 2; "abc" = 6mm, maxWidth=100
    const result = writer.fitTextToWidth('abc', 100);
    expect(result).toBe('abc');
  });

  it('trunkerer med ASCII-ellipsis for PDF-sikker rendering', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter();

    const result = writer.fitTextToWidth('abcdef', 8);

    expect(result).toBe('a...');
  });
});

// ─── visUdkastStempel ────────────────────────────────────────────────────────

describe('pdfWriter visUdkastStempel', () => {
  it('createStandardPdfWriter med visUdkastStempel=false laver ikke watermark på opstart', async () => {
    const { createStandardPdfWriter } = await import('../../../pdf/infrastructure/pdfWriter');
    const writer = createStandardPdfWriter({ visUdkastStempel: false });
    // addImage bruges til watermark - hvis false: ingen kald
    expect(writer.getDoc().addImage).not.toHaveBeenCalled();
  });
});
