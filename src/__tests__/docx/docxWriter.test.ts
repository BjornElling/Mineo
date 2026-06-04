import JSZip from 'jszip';
import { withDocumentGenerationContext } from '../../document/documentGenerationContext';
import { createDocxWriter } from '../../docx/infrastructure/docxWriter';

const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

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

    appendSpy.mockRestore();
    clickSpy.mockRestore();

    expect(downloadedFilename).toBe('Testdokument.docx');
    expect(downloadedBlob).toBeInstanceOf(Blob);

    const zip = await JSZip.loadAsync(downloadedBlob!);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    const coreXml = await zip.file('docProps/core.xml')?.async('string');

    expect(documentXml).toContain('Testdokument');
    expect(documentXml).toContain('Almindelig tekst');
    expect(documentXml).toContain('Beløb');
    expect(documentXml).toContain('1.234 kr.');
    expect(coreXml).toContain('Testdokument');
    expect(coreXml).toContain('mineo.dk');
  });
});
