import { vi } from 'vitest';
import JSZip from 'jszip';
import { withDocumentGenerationContext } from '../../../document/documentGenerationContext';
import { createDocxWriter } from '../../../docx/infrastructure/docxWriter';

// Fælles harness for per-generator Word-indholdstests (jf.
// document-format-contract.md §4). Kører en RIGTIG generator gennem
// Word-backenden — generatoren kalder createStandardPdfWriter(), som under denne
// kontekst returnerer en DocxWriter — fanger den producerede .docx-blob, og
// pakker word/document.xml ud, så testen kan assert'e semantisk indhold.
//
// Formålet er at fange "skjult indholdstab": fordi Word ikke er pixel-paritet,
// kan en manglende sektion/række ikke ses visuelt. Derfor assertes maskinelt.

export type RenderedWordDocument = Readonly<{
  filename: string;
  documentXml: string;
  zip: JSZip;
  blob: Blob;
}>;

// Renser OOXML til ren tekst (fjerner tags), så assertions kan matche labels/værdier
// uafhængigt af, hvordan teksten er splittet op i runs/afsnit.
export const xmlToPlainText = (xml: string): string =>
  xml
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Kører `run` gennem Word-backenden og returnerer den producerede .docx udpakket.
// `run` skal kalde en generator, der internt kalder createStandardPdfWriter() og
// til sidst writer.save(filename).
export const renderWordDocument = async (run: () => void | Promise<void>): Promise<RenderedWordDocument> => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  let capturedBlob: Blob | null = null;
  let capturedFilename = '';

  URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
    capturedBlob = blob instanceof Blob ? blob : null;
    return 'blob:mineo-word-test';
  });
  URL.revokeObjectURL = vi.fn();

  const appendSpy = vi.spyOn(document.body, 'appendChild');
  appendSpy.mockImplementation((node: Node) => {
    if (node instanceof HTMLAnchorElement) {
      capturedFilename = node.download;
    }
    return Node.prototype.appendChild.call(document.body, node) as never;
  });
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function click(this: HTMLAnchorElement) {
      capturedFilename = this.download;
    });

  try {
    await withDocumentGenerationContext('word', run, { createWriter: createDocxWriter });
  } finally {
    appendSpy.mockRestore();
    clickSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    document.body.innerHTML = '';
  }

  if (!capturedBlob) {
    throw new Error('Word-generatoren producerede ingen download-blob (kaldte writer.save() ikke?).');
  }

  const zip = await JSZip.loadAsync(capturedBlob);
  const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';

  return { filename: capturedFilename, documentXml, zip, blob: capturedBlob };
};
