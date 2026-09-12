// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import {
  generateRenteOversigtDocument,
  type RenteOversigtRow,
} from '../../document/generators/renteberegning/renteOversigtDocument';
import { toISODateString } from '../../types/branded';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';

const rows: ReadonlyArray<RenteOversigtRow> = [
  {
    beloeb: 1_250,
    rentedato: toISODateString('2024-01-11'),
    beregnetRente: 2.25,
  },
  {
    beloeb: 5_000,
    rentedato: toISODateString('2023-06-01'),
    beregnetRente: 412.5,
  },
];

const normalizeText = (text: string): string => text
  .replace(/\u00a0/g, ' ')
  .replace(/\u2013/g, '-')
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

describe('TD-014/DOC-002 – rente-oversigtens færdige PDF- og Word-artefakter', () => {
  it('bevarer det samme håndskrevne indhold i PDF og Word', async () => {
    const render = (session: Parameters<typeof generateRenteOversigtDocument>[0]) =>
      generateRenteOversigtDocument(session, toISODateString('2024-02-01'), rows);

    const pdfArtifact = await withDocumentUnavailable(async () => {
      const session = await createRealPdfDocumentSessionForTest();
      return render(session);
    });
    const pdfText = normalizeText(await extractPdfText(pdfArtifact.blob));

    const { filename, documentXml } = await withDocumentUnavailable(() => renderWordDocument(render));
    const wordText = normalizeText(xmlToPlainText(documentXml));

    expect(pdfArtifact.filename).toMatch(/\.pdf$/i);
    expect(filename).toMatch(/\.docx$/i);

    const expectedText = [
      'Procesrente - oversigt',
      'Rente beregnes til og med 01-02-2024.',
      'Beløb',
      'Rentedato',
      'Beregnet rente',
      '1.250,00 kr.',
      '11-01-2024',
      '2,25 kr.',
      '5.000,00 kr.',
      '01-06-2023',
      '412,50 kr.',
      'Samlet rentebeløb',
      '414,75 kr.',
      'Beregningsprincipper',
      'Rente beregnes i henhold til renteloven.',
    ] as const;

    for (const expected of expectedText) {
      expect(pdfText, `PDF mangler ${expected}`).toContain(expected);
      expect(wordText, `Word mangler ${expected}`).toContain(expected);
    }
  });
});
