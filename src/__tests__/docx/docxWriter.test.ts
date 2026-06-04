import JSZip from 'jszip';
import { withDocumentGenerationContext } from '../../document/documentGenerationContext';
import { createDocxWriter } from '../../docx/infrastructure/docxWriter';
import {
  renderPdfTable,
  createPdfTableHeaderCell,
  createPdfTableCell,
  createPdfDistributedColumnStyles,
} from '../../pdf/shared/pdfTableRenderer';
import type jsPDF from 'jspdf';

const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

type DownloadCapture = Readonly<{
  getBlob: () => Blob | null;
  getFilename: () => string;
  restore: () => void;
}>;

const captureDownload = (): DownloadCapture => {
  let downloadedBlob: Blob | null = null;
  let downloadedFilename = '';

  const appendSpy = vi.spyOn(document.body, 'appendChild');
  appendSpy.mockImplementation((node: Node) => {
    if (node instanceof HTMLAnchorElement) {
      downloadedFilename = node.download;
    }
    return Node.prototype.appendChild.call(document.body, node) as never;
  });

  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    downloadedFilename = this.download;
  });

  vi.mocked(URL.createObjectURL).mockImplementation((blob: Blob | MediaSource) => {
    downloadedBlob = blob instanceof Blob ? blob : null;
    return 'blob:mineo-docx';
  });

  return {
    getBlob: () => downloadedBlob,
    getFilename: () => downloadedFilename,
    restore: () => {
      appendSpy.mockRestore();
      clickSpy.mockRestore();
    },
  };
};

describe('createDocxWriter', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mineo-docx');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    document.body.innerHTML = '';
  });

  it('producerer en ægte docx-zip med titel, tekst, tabel og docx-filnavn', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter({ visUdkastStempel: true });
      writer.setProperties({
        title: 'Testdokument',
        subject: 'Erstatningsberegning',
        author: 'Mineo',
        creator: 'mineo.dk',
      });
      writer.writeTitle('Testdokument');
      writer.writeWrappedText('Almindelig tekst');
      writer.writeLeftRightText('Beløb', '1.234 kr.');
      writer.save('Testdokument.pdf');
    });

    capture.restore();

    expect(capture.getFilename()).toBe('Testdokument.docx');
    expect(capture.getBlob()).toBeInstanceOf(Blob);

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    const coreXml = await zip.file('docProps/core.xml')?.async('string');

    expect(documentXml).toContain('Testdokument');
    expect(documentXml).toContain('Almindelig tekst');
    expect(documentXml).toContain('Beløb');
    expect(documentXml).toContain('1.234 kr.');
    expect(coreXml).toContain('Testdokument');
    expect(coreXml).toContain('mineo.dk');
  });

  // GDPR / kontrakt §4.3: Word-output må ikke indeholde eksterne relationer,
  // remote templates, font-links eller anden netværksafhængighed.
  it('producerer en selvstændig docx uden eksterne relationer eller remote-referencer', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      writer.writeTitle('Selvstændig');
      writer.writeWrappedText('Indhold');
      writer.save('Selvstaendig.pdf');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const relFiles = Object.keys(zip.files).filter((name) => name.endsWith('.rels'));
    expect(relFiles.length).toBeGreaterThan(0);

    const allTargets: string[] = [];
    for (const relFile of relFiles) {
      const relXml = (await zip.file(relFile)?.async('string')) ?? '';
      // Ingen eksterne targets (TargetMode="External") og ingen remote-template.
      expect(relXml).not.toContain('TargetMode="External"');
      expect(relXml).not.toContain('attachedTemplate');
      allTargets.push(...[...relXml.matchAll(/Target="([^"]*)"/g)].map((match) => match[1]));
    }

    // Mindst én relation skal findes, og hver relation skal pege på en lokal fil
    // i pakken — aldrig en http(s)-URL. (Schema-namespace/Type-URI'er indeholder
    // http:// men er ikke targets.)
    expect(allTargets.length).toBeGreaterThan(0);
    for (const target of allTargets) {
      expect(target).not.toMatch(/^https?:\/\//i);
    }

    // Dokumentindholdet må ikke indeholde font-links eller andre eksterne URL'er.
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(documentXml).not.toMatch(/https?:\/\/(?!schemas\.openxmlformats\.org|schemas\.microsoft\.com|www\.w3\.org|purl\.org)/i);
  });

  it('renderer en tabel via PDF-tabel-broen med header, alignment, bold og colSpan', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      const doc = writer.getDoc() as jsPDF;
      renderPdfTable({
        doc,
        startY: 0,
        hasHeaderRow: true,
        body: [
          [
            createPdfTableHeaderCell('Periode', 'left'),
            createPdfTableHeaderCell('Beløb', 'right'),
          ],
          [
            createPdfTableCell('Januar', { halign: 'left' }),
            createPdfTableCell('1.000 kr.', { halign: 'right' }),
          ],
          // Total-række med colSpan over begge kolonner.
          [
            { content: 'I alt: 1.000 kr.', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
          ],
        ],
      });
      writer.save('Tabel.pdf');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';

    // Alt celleindhold er bevaret (ingen tabt data).
    expect(documentXml).toContain('Periode');
    expect(documentXml).toContain('Beløb');
    expect(documentXml).toContain('Januar');
    expect(documentXml).toContain('1.000 kr.');
    expect(documentXml).toContain('I alt: 1.000 kr.');

    // Tabel-struktur er til stede, og colSpan er oversat til gridSpan=2.
    expect(documentXml).toContain('<w:tbl>');
    expect(documentXml).toContain('w:gridSpan w:val="2"');
    // Højre-justering og fed skrift fra cellestyles.
    expect(documentXml).toContain('w:jc w:val="right"');
    expect(documentXml).toContain('<w:b/>');
  });

  it('fejler tabel-broen fail-closed ved tom body', () => {
    withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      const doc = writer.getDoc() as jsPDF;
      expect(() => renderPdfTable({ doc, startY: 0, body: [], hasHeaderRow: true })).toThrow(/tom body/);
    });
  });

  // UDKAST-stempel: ægte diagonalt VML-vandmærke i header, ikke centreret brødtekst.
  it('indsætter et diagonalt VML-vandmærke i header når visUdkastStempel er sat', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter({ visUdkastStempel: true });
      writer.writeWrappedText('Indhold');
      writer.save('Udkast.pdf');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const headerFiles = Object.keys(zip.files).filter((name) => /word\/header\d+\.xml$/.test(name));
    expect(headerFiles.length).toBeGreaterThan(0);

    const headerXml = (await zip.file(headerFiles[0])?.async('string')) ?? '';
    // VML-tekstvandmærke (shape-type #_x0000_t136) med roteret, grå UDKAST-tekst.
    expect(headerXml).toContain('<w:pict>');
    expect(headerXml).toContain('_x0000_t136');
    expect(headerXml).toContain('rotation:315');
    expect(headerXml).toMatch(/string="UDKAST"/);
    // Vandmærket må ikke trække eksterne ressourcer ind (100 % lokalt).
    expect(headerXml).not.toMatch(/https?:\/\/(?!schemas\.openxmlformats\.org|schemas\.microsoft\.com|www\.w3\.org|urn:)/i);
  });

  it('udelader watermark-header når visUdkastStempel ikke er sat', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      writer.writeWrappedText('Indhold');
      writer.save('UdenUdkast.pdf');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const headerFiles = Object.keys(zip.files).filter((name) => /word\/header\d+\.xml$/.test(name));
    for (const headerFile of headerFiles) {
      const headerXml = (await zip.file(headerFile)?.async('string')) ?? '';
      expect(headerXml).not.toContain('_x0000_t136');
    }
  });

  // Signaturblokken skal være kantfri i Word (matcher PDF'ens linjefri opstilling).
  it('renderer signaturblokken kantfrit', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      writer.writeSignatureBlock('1. januar 2026', '________________', 0, 0, 'Hans Hansen');
      writer.save('Signatur.pdf');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';

    expect(documentXml).toContain('Hans Hansen');
    expect(documentXml).toContain('Dato');
    // Signaturtabellen skal have eksplicit "ingen kant" (BorderStyle.NONE → w:val="none"
    // eller "nil"), ikke den grå datatabel-kant (D9D9D9).
    expect(documentXml).toContain('Hans Hansen');
    // En kantfri tabel sætter ikke D9D9D9-kantfarven på signatur-cellerne.
    // (Datatabeller bruger D9D9D9; her må den ikke optræde, da det er det eneste
    // bordobjekt i dokumentet.)
    expect(documentXml).not.toContain('D9D9D9');
  });

  // Word skal arve PDF'ens kolonne-justering, selv når den ikke står på den enkelte
  // celle: via columnStyles' defaultHalign OG via dataRowColumnHalign (hook-override).
  it('arver kolonne-justering fra columnStyles og dataRowColumnHalign', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      const doc = writer.getDoc() as jsPDF;
      renderPdfTable({
        doc,
        startY: 0,
        hasHeaderRow: true,
        // Cellerne har INGEN egen halign — justeringen skal komme fra kolonnen.
        body: [
          [createPdfTableHeaderCell('A', 'left'), createPdfTableHeaderCell('B', 'left')],
          ['venstre', 'tal-1'],
          ['venstre', 'tal-2'],
        ],
        // Kolonne 1 højrejusteres på data-rækker via hook-override (som i renteberegning).
        dataRowColumnHalign: { 1: 'right' },
      });
      writer.save('Justering.pdf');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(documentXml).toContain('tal-1');
    // Kolonne 1's data-celler skal være højrejusteret i Word.
    expect(documentXml).toContain('w:jc w:val="right"');
  });

  it('lader cellens egen halign vinde over kolonne-justering', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      const doc = writer.getDoc() as jsPDF;
      renderPdfTable({
        doc,
        startY: 0,
        hasHeaderRow: false,
        // defaultHalign='center' på alle kolonner, men cellen siger eksplicit 'right'.
        columnStyles: createPdfDistributedColumnStyles(1, { defaultHalign: 'center' }),
        body: [[createPdfTableCell('eksplicit-højre', { halign: 'right' })]],
      });
      writer.save('Praecedens.pdf');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(documentXml).toContain('eksplicit-højre');
    expect(documentXml).toContain('w:jc w:val="right"');
    expect(documentXml).not.toContain('w:jc w:val="center"');
  });
});

describe('createDocxWriter fejlpropagering', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mineo-docx');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    document.body.innerHTML = '';
  });

  // Hvis dokumentopbygningen (Packer.toBlob) fejler, skal afvisningen propageres
  // gennem pendingDownloads → withDocumentGenerationContext, så download-stien i
  // pdfService kan route den som systemfejl (fail-closed, intet stille tab).
  it('propagerer en build-fejl gennem withDocumentGenerationContext', async () => {
    const { Packer } = await import('docx');
    const toBlobSpy = vi.spyOn(Packer, 'toBlob').mockRejectedValue(new Error('toBlob fejlede'));

    await expect(
      withDocumentGenerationContext('word', () => {
        const writer = createDocxWriter();
        writer.writeWrappedText('Indhold');
        writer.save('Fejl.pdf');
      })
    ).rejects.toThrow('toBlob fejlede');

    toBlobSpy.mockRestore();
  });
});
