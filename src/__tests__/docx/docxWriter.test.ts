// @vitest-environment jsdom
import JSZip from 'jszip';
import { withDocumentGenerationContext } from '../../document/documentGenerationContext';
import { clearDocumentFooterImageCacheForTests } from '../../document/layout/documentFooterImage';
import { createDocxWriter } from '../../docx/infrastructure/docxWriter';
import { toISODateString } from '../../types/branded';
import {
  renderDocumentTable,
  createDocumentTableHeaderCell,
  createDocumentTableCell,
  createDocumentDistributedColumnStyles,
} from '../../document/layout/documentTableRenderer';
import { isDocumentTableBridgeDocument } from '../../document/layout/documentTableBridge';

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

  // Kanal-renhed (lukker review-fund F2): Word-writerens getDoc() returnerer
  // tabel-broen — IKKE en jsPDF-instans. Den fælles DocumentWriter-grænseflade
  // eksponerer getDoc() med den honest union (jsPDF | DocumentTableBridgeDocument),
  // så Word-writeren ikke længere behøver en `as never`-attrap, og et direkte
  // jsPDF-only kald på et bro-doc fanges på compile-tid. Denne test bevogter
  // runtime-siden: broen er identificerbar via isDocumentTableBridgeDocument og
  // bærer ingen jsPDF-only API'er.
  it('getDoc() returnerer tabel-broen (ikke en jsPDF) på Word-kanalen', async () => {
    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      const doc = writer.getDoc();
      expect(isDocumentTableBridgeDocument(doc)).toBe(true);
      // Broen har ingen jsPDF-only tegne-API'er — et utilsigtet direkte kald ville
      // ellers kaste på Word-stien (det var præcis F2-lækagen).
      expect((doc as Record<string, unknown>).setLineWidth).toBeUndefined();
      expect((doc as Record<string, unknown>).addImage).toBeUndefined();
    });
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
      writer.save('Testdokument.docx');
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

  it('forankrer versions-footeren tæt ved højrekanten', async () => {
    clearDocumentFooterImageCacheForTests();
    const capture = captureDownload();
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
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,AA=='),
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
      await withDocumentGenerationContext('word', () => {
        const writer = createDocxWriter();
        writer.writeWrappedText('Indhold');
        writer.save('Footer.docx');
      });
    } finally {
      createElementSpy.mockRestore();
      clearDocumentFooterImageCacheForTests();
      capture.restore();
    }

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const footerFiles = Object.keys(zip.files).filter((name) => /word\/footer\d+\.xml$/.test(name));
    expect(footerFiles.length).toBeGreaterThan(0);
    const footerXml = (await zip.file(footerFiles[0])?.async('string')) ?? '';
    expect(footerXml).toMatch(/<wp:positionH[^>]*relativeFrom="page"[\s\S]*?<wp:posOffset>7283110<\/wp:posOffset>/);
  });

  it('lægger versions-footeren i både default- og first-footer ved brevhoved', async () => {
    clearDocumentFooterImageCacheForTests();
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      writer.writeBrevhoved({
        journalnr: '24-0024',
        advokat: 'BEL',
        sagsbehandler: 'cgf',
        dagsDatoISO: toISODateString('2026-04-18'),
      });
      writer.writeWrappedText('Indhold');
      writer.save('BrevhovedFooter.docx');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(documentXml).toContain('<w:titlePg');
    expect(documentXml).toMatch(/<w:footerReference w:type="default"/);
    expect(documentXml).toMatch(/<w:footerReference w:type="first"/);

    const footerFiles = Object.keys(zip.files).filter((name) => /word\/footer\d+\.xml$/.test(name));
    expect(footerFiles.length).toBeGreaterThanOrEqual(2);
    let footersWithVersion = 0;
    for (const footerFile of footerFiles) {
      const footerXml = (await zip.file(footerFile)?.async('string')) ?? '';
      if (footerXml.includes('mineo.dk //')) {
        footersWithVersion += 1;
      }
    }
    expect(footersWithVersion).toBeGreaterThanOrEqual(2);
  });

  // GDPR / kontrakt §4.3: Word-output må ikke indeholde eksterne relationer,
  // remote templates, font-links eller anden netværksafhængighed.
  it('producerer en selvstændig docx uden eksterne relationer eller remote-referencer', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      writer.writeTitle('Selvstændig');
      writer.writeWrappedText('Indhold');
      writer.save('Selvstaendig.docx');
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
      const doc = writer.getDoc();
      renderDocumentTable({
        doc,
        startY: 0,
        hasHeaderRow: true,
        body: [
          [
            createDocumentTableHeaderCell('Periode', 'left'),
            createDocumentTableHeaderCell('Beløb', 'right'),
          ],
          [
            createDocumentTableCell('Januar', { halign: 'left' }),
            createDocumentTableCell('1.000 kr.', { halign: 'right' }),
          ],
          // Total-række med colSpan over begge kolonner.
          [
            { content: 'I alt: 1.000 kr.', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
          ],
        ],
      });
      writer.save('Tabel.docx');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    const stylesXml = (await zip.file('word/styles.xml')?.async('string')) ?? '';

    // Alt celleindhold er bevaret (ingen tabt data).
    expect(documentXml).toContain('Periode');
    expect(documentXml).toContain('Beløb');
    expect(documentXml).toContain('Januar');
    expect(documentXml).toContain('1.000 kr.');
    expect(documentXml).toContain('I alt: 1.000 kr.');

    // Tabel-struktur er til stede, og colSpan er oversat til gridSpan=2.
    expect(documentXml).toContain('<w:tbl>');
    expect(documentXml).toContain('w:gridSpan w:val="2"');
    expect(documentXml).toContain('w:jc w:val="right"');

    // Cellerne refererer Words indbyggede Table Paragraph-typografi.
    // Fed header/total er tekstfremhævning, ikke en separat Mineo-typografi.
    expect(documentXml).toContain('w:pStyle w:val="TableParagraph"');
    // Ingen inline font/størrelse i selve dokumentet.
    expect(documentXml).not.toContain('<w:rFonts');
    expect(documentXml).not.toMatch(/<w:sz\b/);
    expect(documentXml).toContain('<w:b/>');
    expect(stylesXml).toContain('w:styleId="TableParagraph"');
    expect(stylesXml).not.toMatch(/w:styleId="Mineo/);
  });

  it('fejler tabel-broen fail-closed ved tom body', () => {
    withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      const doc = writer.getDoc();
      expect(() => renderDocumentTable({ doc, startY: 0, body: [], hasHeaderRow: true })).toThrow(/tom body/);
    });
  });

  // UDKAST-stempel: ægte diagonalt VML-vandmærke i header, ikke centreret brødtekst.
  it('indsætter et diagonalt VML-vandmærke i header når visUdkastStempel er sat', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter({ visUdkastStempel: true });
      writer.writeWrappedText('Indhold');
      writer.save('Udkast.docx');
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
    // Words native vandmærke-udseende: halvgennemsigtig sølvgrå (fillcolor="silver" +
    // <v:fill opacity=".5"/>) og o:allowincell="f" — ufordrejet og pænt i Word.
    expect(headerXml).toContain('fillcolor="silver"');
    expect(headerXml).toContain('<v:fill opacity=".5"/>');
    expect(headerXml).toContain('o:allowincell="f"');
    // Værn: ImportedXmlComponent.fromXmlString pakker fragmentet i et navnløst
    // rod-element, der ellers serialiseres som <undefined>…</undefined> — ugyldig
    // WordprocessingML, som Word afviser/reparerer. Wrapperen skal være fjernet,
    // så <w:pict> ligger direkte i <w:r> i <w:p>.
    expect(headerXml).not.toContain('<undefined>');
    expect(headerXml).not.toContain('</undefined>');
    expect(headerXml).toMatch(/<w:p>\s*<w:r>\s*<w:pict>/);
    // Vandmærket må ikke trække eksterne ressourcer ind (100 % lokalt).
    expect(headerXml).not.toMatch(/https?:\/\/(?!schemas\.openxmlformats\.org|schemas\.microsoft\.com|www\.w3\.org|urn:)/i);
  });

  it('udelader watermark-header når visUdkastStempel ikke er sat', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      writer.writeWrappedText('Indhold');
      writer.save('UdenUdkast.docx');
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
      writer.save('Signatur.docx');
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
      const doc = writer.getDoc();
      renderDocumentTable({
        doc,
        startY: 0,
        hasHeaderRow: true,
        // Cellerne har INGEN egen halign — justeringen skal komme fra kolonnen.
        body: [
          [createDocumentTableHeaderCell('A', 'left'), createDocumentTableHeaderCell('B', 'left')],
          ['venstre', 'tal-1'],
          ['venstre', 'tal-2'],
        ],
        // Kolonne 1 højrejusteres på data-rækker via hook-override (som i renteberegning).
        dataRowColumnHalign: { 1: 'right' },
      });
      writer.save('Justering.docx');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(documentXml).toContain('tal-1');
    // Kolonne 1's data-celler skal være højrejusteret i Word.
    expect(documentXml).toContain('w:jc w:val="right"');
  });

  // KONTRAKT: Al tekst skal styres af navngivne afsnitstypografier. Almindelig
  // fed brødtekst er ikke en separat typografi; den er Normal med fed tekst-run.
  it('styrer tekst via navngivne afsnitstypografier uden separat fed brødtekst-typografi', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      writer.writeTitle('Min titel');
      writer.writeSectionHeader('Sektion');
      writer.writeBoldSubheader('Underoverskrift');
      writer.writeUnderlinedSubheader('Understreget');
      writer.writeWrappedText('Brødtekst');
      writer.writeBoldWrappedText('Fed brødtekst');
      writer.save('Typografier.docx');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    const stylesXml = (await zip.file('word/styles.xml')?.async('string')) ?? '';

    // Hver indholdstype refererer sin navngivne typografi.
    expect(documentXml).toContain('w:pStyle w:val="Title"');
    expect(documentXml).toContain('w:pStyle w:val="Heading1"');
    expect(documentXml).toContain('w:pStyle w:val="Heading2"');
    expect(documentXml).toContain('w:pStyle w:val="Heading3"');
    expect(documentXml).toContain('w:pStyle w:val="Normal"');
    expect(documentXml).not.toContain('w:pStyle w:val="MineoBroedtekstFed"');

    // Ingen inline font/størrelse/understregning/spacing i selve dokumentet.
    // Fed brødtekst må have <w:b/> på run'et, men stadig med Normal som pStyle.
    expect(documentXml).not.toContain('<w:rFonts');
    expect(documentXml).not.toMatch(/<w:sz\b/);
    expect(documentXml).toContain('<w:b/>');
    expect(documentXml).not.toContain('<w:u ');
    expect(documentXml).not.toMatch(/<w:spacing\b/);

    // Udseendet bor i styles.xml (basisfont + de navngivne typografier).
    expect(stylesXml).toContain('w:styleId="Normal"');
    expect(stylesXml).toMatch(/w:styleId="Normal"[\s\S]*?<w:spacing[^>]*w:after="40"/);
    expect(stylesXml).toContain('w:styleId="Title"');
    expect(stylesXml).toMatch(/w:styleId="Title"[\s\S]*?<w:sz w:val="36"/);
    expect(stylesXml).toContain('w:styleId="Heading1"');
    expect(stylesXml).not.toMatch(/w:styleId="Mineo/);
    expect(stylesXml).toContain('Calibri');
  });

  // Brevhovedet skal matche PDF-formatet ("J.nr. <nr> <advokat>/<sagsbehandler>" +
  // lang dansk dato) OG ligge i en side-forankret tekstrude øverst til højre, så
  // placeringen er fikseret uanset det øvrige indhold.
  it('renderer brevhovedet i PDF-format i en side-forankret tekstrude', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      writer.writeBrevhoved({
        journalnr: '24-0024',
        advokat: 'BEL',
        sagsbehandler: 'cgf',
        dagsDatoISO: toISODateString('2026-04-18'),
      });
      writer.save('Brevhoved.docx');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    const stylesXml = (await zip.file('word/styles.xml')?.async('string')) ?? '';

    // Indhold i det nye PDF-matchende format.
    expect(documentXml).toContain('J.nr. 24-0024 BEL/cgf');
    expect(documentXml).toContain('18. april 2026');
    // Det gamle "Journalnr.:/Advokat:/Sagsbehandler:/Dato:"-format må ikke optræde.
    expect(documentXml).not.toContain('Journalnr.:');
    expect(documentXml).not.toContain('Sagsbehandler:');

    // Tekstruden er forankret til SIDEN (ikke til teksten), så den ikke flytter sig.
    expect(documentXml).toContain('<w:framePr');
    expect(documentXml).toMatch(/w:framePr[^>]*w:hAnchor="page"/);
    expect(documentXml).toMatch(/w:framePr[^>]*w:vAnchor="page"/);
    // 7 cm bred, mindst 1 cm høj, 12 cm fra venstre sidekant og 1 cm fra toppen.
    expect(documentXml).toMatch(/w:framePr[^>]*w:w="3969"/);
    expect(documentXml).toMatch(/w:framePr[^>]*w:h="567"/);
    expect(documentXml).toMatch(/w:framePr[^>]*w:x="6803"/);
    expect(documentXml).toMatch(/w:framePr[^>]*w:y="567"/);
    expect(stylesXml).toMatch(/w:styleId="Header"[\s\S]*?<w:sz w:val="20"/);
    expect(documentXml).toMatch(/<w:pgMar[^>]*w:top="1440"[^>]*w:right="1134"[^>]*w:bottom="1440"[^>]*w:left="1134"/);

    // "Anden første side" er aktiv (titlePg), men uden tom first-header-padding.
    expect(documentXml).toContain('<w:titlePg');
    expect(documentXml).not.toMatch(/<w:headerReference w:type="first"/);
  });

  // Brevhovedet aktiverer Words "anden første side". Da default-headeren kun gælder
  // side 2+, skal udkast-vandmærket også ligge i first-headeren, så side 1 beholder det.
  it('lægger vandmærket i både default- og first-header ved brevhoved + udkast', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter({ visUdkastStempel: true });
      writer.writeBrevhoved({
        journalnr: '24-0024',
        advokat: 'BEL',
        sagsbehandler: 'cgf',
        dagsDatoISO: toISODateString('2026-04-18'),
      });
      writer.writeWrappedText('Brødtekst');
      writer.save('BrevhovedUdkast.docx');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';

    // To distinkte header-filer (default + first), begge med VML-vandmærket.
    const headerFiles = Object.keys(zip.files).filter((name) => /word\/header\d+\.xml$/.test(name));
    expect(headerFiles.length).toBeGreaterThanOrEqual(2);
    let watermarkHeaders = 0;
    for (const headerFile of headerFiles) {
      const headerXml = (await zip.file(headerFile)?.async('string')) ?? '';
      if (headerXml.includes('_x0000_t136') && /string="UDKAST"/.test(headerXml)) {
        watermarkHeaders += 1;
      }
      expect((headerXml.match(/<w:p\b/g) ?? []).length).toBeLessThan(5);
      // Wrapperen fra forrige fix må stadig ikke optræde.
      expect(headerXml).not.toContain('<undefined>');
    }
    expect(watermarkHeaders).toBeGreaterThanOrEqual(2);

    // Sektionen refererer både default- og first-header, og titlePg er sat.
    expect(documentXml).toContain('<w:titlePg');
    expect(documentXml).toMatch(/<w:headerReference w:type="first"/);
    expect(documentXml).toMatch(/<w:headerReference w:type="default"/);
  });

  it('lader cellens egen halign vinde over kolonne-justering', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      const doc = writer.getDoc();
      renderDocumentTable({
        doc,
        startY: 0,
        hasHeaderRow: false,
        // defaultHalign='center' på alle kolonner, men cellen siger eksplicit 'right'.
        columnStyles: createDocumentDistributedColumnStyles(1, { defaultHalign: 'center' }),
        body: [[createDocumentTableCell('eksplicit-højre', { halign: 'right' })]],
      });
      writer.save('Praecedens.docx');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(documentXml).toContain('eksplicit-højre');
    expect(documentXml).toContain('w:jc w:val="right"');
    expect(documentXml).not.toContain('w:jc w:val="center"');
  });

  // Paritet med PDF: writeLeftRightText med `lineAboveRightWidth` tegner en
  // summeringsstreg over højrekolonnen på I alt-/sum-linjer. I Word vises den som
  // en sort topkant på højre celle. Uden flaget må stregen IKKE optræde.
  it('tegner en summeringsstreg over højre celle når lineAboveRightWidth er sat', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      // Almindelig linje uden sum-streg.
      writer.writeLeftRightText('Delbeløb', '1.000 kr.');
      // Sum-linje med summeringsstreg (lineAboveRightWidth sat).
      writer.writeLeftRightText('I alt', '1.000 kr.', { lineAboveRightWidth: 30 });
      writer.save('Sumlinje.docx');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';

    expect(documentXml).toContain('I alt');
    // Præcis ÉN sort topkant (size 4 / color 000000) — kun fra sum-linjen.
    const sumBorders = documentXml.match(/<w:top w:val="single"[^>]*w:color="000000"/g) ?? [];
    expect(sumBorders.length).toBe(1);
  });

  // Negativ kontrol: uden lineAboveRightWidth tegnes ingen summeringsstreg.
  it('tegner ingen summeringsstreg når lineAboveRightWidth ikke er sat', async () => {
    const capture = captureDownload();

    await withDocumentGenerationContext('word', () => {
      const writer = createDocxWriter();
      writer.writeLeftRightText('Delbeløb', '1.000 kr.');
      writer.save('UdenSumlinje.docx');
    });

    capture.restore();

    const zip = await JSZip.loadAsync(capture.getBlob()!);
    const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';

    expect(documentXml).toContain('Delbeløb');
    expect(documentXml).not.toMatch(/<w:top w:val="single"[^>]*w:color="000000"/);
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
        writer.save('Fejl.docx');
      })
    ).rejects.toThrow('toBlob fejlede');

    toBlobSpy.mockRestore();
  });
});
