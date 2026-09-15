// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { generateSHDageDocument } from '../../document/generators/aarsloen/shDageDocument';
import { createDate } from '../../utils/dateUtils';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';

const perioder = [
  { start: createDate(2024, 2, 28), end: createDate(2024, 3, 1) },
] as const;

const runDocument = (session: Parameters<typeof generateSHDageDocument>[0]) =>
  generateSHDageDocument(session, perioder, { visBrevhoved: false });

const normalizeText = (text: string): string => text
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const withDocumentUnavailable = async <T>(run: () => Promise<T>): Promise<T> => {
  const originalDocument = globalThis.document;
  vi.stubGlobal('document', undefined);
  try {
    return await run();
  } finally {
    vi.stubGlobal('document', originalDocument);
  }
};

const expectedContent = [
  'SH-dage',
  'Periode: 28. marts 2024 - 1. april 2024',
  'Ugedag',
  'Dato',
  'Helligdag',
  'SH-dag',
  'Torsdag',
  '28. marts 2024',
  'Skærtorsdag',
  'Fredag',
  '29. marts 2024',
  'Langfredag',
  'Søndag',
  '31. marts 2024',
  'Påskedag',
  'Mandag',
  '1. april 2024',
  'Anden påskedag',
  'SH-dage i alt',
  'Forklaring',
  'Søgnehelligdage er helligdage, der falder på hverdage (mandag-fredag).',
  'Helligdage, der falder i weekenden, fremgår af tabellen men medregnes ikke.',
] as const;

describe('TD-014/TD-018 – SH-dage gennem faktiske PDF- og Word-artefakter', () => {
  it('bevarer helligdagsrækker, weekendmarkering og total i begge kanaler', async () => {
    const pdfArtifact = await withDocumentUnavailable(async () => {
      const session = await createRealPdfDocumentSessionForTest();
      return runDocument(session);
    });
    const pdfText = normalizeText(await extractPdfText(pdfArtifact.blob));

    const wordArtifact = await withDocumentUnavailable(() => renderWordDocument(runDocument));
    const wordText = normalizeText(xmlToPlainText(wordArtifact.documentXml));

    expect(pdfArtifact.filename).toBe('SH-dage (28-03-2024 - 01-04-2024).pdf');
    expect(pdfArtifact.blob.type).toBe('application/pdf');
    expect(wordArtifact.filename).toBe('SH-dage (28-03-2024 - 01-04-2024).docx');
    expect(wordArtifact.blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    for (const expected of expectedContent) {
      expect(pdfText, `PDF mangler ${expected}`).toContain(expected);
      expect(wordText, `Word mangler ${expected}`).toContain(expected);
    }

    expect(pdfText).toMatch(/SH-dage i alt\s*3/);
    expect(wordText).toMatch(/SH-dage i alt\s*3/);
  });
});
