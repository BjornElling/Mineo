// @vitest-environment jsdom

import { buildDocumentFooterText } from '../../document/layout/documentFooterImage';
import { generateVarigeMenDocument } from '../../document/generators/varigemen/varigeMenDocument';
import { beregnVarigeMenGodtgoerelseWithRates } from '../../domain/varigemen/varigeMenCalculations';
import { varigeMenPrGrad } from '../../data/lovbestemteRates';
import { resolveStamdataDatoReference } from '../../domain/policies/stamdataCalculations';
import { toISODateString } from '../../types/branded';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';

const fodselsdato = toISODateString('1959-03-01');
const skadedato = toISODateString('2024-04-01');
const beregningsdato = toISODateString('2024-06-01');
const beregningsResultat = beregnVarigeMenGodtgoerelseWithRates(
  { mengrad: 15, beregningsdato },
  skadedato,
  varigeMenPrGrad,
  fodselsdato
);

if (beregningsResultat === null) {
  throw new Error('Varige mén-fixturen gav ikke et beregningsresultat');
}

const runDocument = (session: Parameters<typeof generateVarigeMenDocument>[0]) =>
  generateVarigeMenDocument(session, {
    fodselsdato,
    skadedato,
    mengrad: 15,
    beregningsdato,
    beregningsResultat,
    datoReference: resolveStamdataDatoReference(undefined),
    visBrevhoved: false,
  });

const normalizeText = (text: string): string => text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

const wordTextWithBoundaries = (documentXml: string): string => normalizeText(
  xmlToPlainText(
    documentXml
      .replace(/<\/w:tc>/g, ' ')
      .replace(/<\/w:tr>/g, ' ')
      .replace(/<\/w:p>/g, ' ')
  )
);

const withDocumentUnavailable = async <T>(run: () => Promise<T>): Promise<T> => {
  const originalDocument = globalThis.document;
  vi.stubGlobal('document', undefined);
  try {
    return await run();
  } finally {
    vi.stubGlobal('document', originalDocument);
  }
};

describe('fysisk PDF-tekst og Word-tekst er semantisk ens', () => {
  it('Varige mén bevarer samme tekst, tal, sektioner og rækkefølge i artefakterne', async () => {
    const pdfSession = await createRealPdfDocumentSessionForTest();
    const pdfArtifact = await withDocumentUnavailable(() => runDocument(pdfSession));
    const pdfText = normalizeText(await extractPdfText(pdfArtifact.blob));
    const { documentXml } = await withDocumentUnavailable(() => renderWordDocument(runDocument));
    const wordText = wordTextWithBoundaries(documentXml);
    const footerText = normalizeText(buildDocumentFooterText());
    const pdfTextWithoutFooter = normalizeText(pdfText.replace(footerText, ''));

    expect(pdfText).toContain('Ménberegning');
    expect(wordText).toContain('Ménberegning');
    expect(pdfText).toContain('103.377 kr.');
    expect(wordText).toContain('103.377 kr.');
    expect(pdfTextWithoutFooter).toBe(wordText);
  });
});
