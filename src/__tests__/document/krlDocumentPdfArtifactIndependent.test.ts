// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { generateKRLDocument } from '../../document/generators/krl/krlDocument';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';

const expectedRows = [
  ['01-04-2026', '65,3378 %', '45,0155 %', '19,8008 %', '19,8008 %'],
  ['01-10-2018', '37,7253 %', '20,7970 %', '2,0238 %', '2,0238 %'],
] as const;

const normalizeText = (text: string): string => text
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const wordTextWithBoundaries = (documentXml: string): string => normalizeText(
  xmlToPlainText(
    documentXml
      .replace(/<\/w:tc>/g, ' ')
      .replace(/<\/w:tr>/g, ' ')
      .replace(/<\/w:p>/g, ' ')
  )
    .replace(/&apos;/g, "'")
);

const removePdfFooter = (text: string): string => normalizeText(text)
  // Den snævre PDF-textparser kan placere footerens brand/version midt i
  // tekstsekvensen ved sideskift. Alle forekomster fjernes før kanalpariteten.
  .replace(/\s+mineo\.dk\s+\/\/\s+\S+/g, '')
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

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('TD-014/TD-018 – KRL-registreringens faktiske PDF-artefakt', () => {
  it('bevarer statisk titel, tabelindhold, kilde og filnavn gennem PDF-generatoren', async () => {
    const session = await createRealPdfDocumentSessionForTest();
    const artifact = await generateKRLDocument(session, { visBrevhoved: false });
    const text = normalizeText(await extractPdfText(artifact.blob));

    expect(artifact.filename).toBe('KRL Satstabeller.pdf');
    expect(artifact.blob.type).toBe('application/pdf');
    expect(text).toContain('KRL Satstabeller');
    expect(text).toMatch(/Fra-dato\s*KTO \(kommuner\)\s*SHK \(kommuner\)\s*KTO \(regioner\)\s*SHK \(regioner\)/);
    expect(text).toContain('Kilde');
    expect(text).toContain('https://www.krl.dk/#/sats');

    for (const row of expectedRows) {
      expect(text).toMatch(new RegExp(row.map((cell) => escapeRegExp(cell)).join('\\s*')));
    }
  });

  it('bevarer hele tabel- og kildeteksten identisk i PDF og Word', async () => {
    const pdfArtifact = await withDocumentUnavailable(async () => generateKRLDocument(
      await createRealPdfDocumentSessionForTest(),
      { visBrevhoved: false },
    ));
    const pdfText = normalizeText(await extractPdfText(pdfArtifact.blob));
    const wordArtifact = await withDocumentUnavailable(() => renderWordDocument((session) =>
      generateKRLDocument(session, { visBrevhoved: false }),
    ));
    const wordText = wordTextWithBoundaries(wordArtifact.documentXml);

    const pdfTextWithoutFooter = removePdfFooter(pdfText);
    expect(pdfTextWithoutFooter).toBe(wordText);
  });
});
