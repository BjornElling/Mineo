// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { buildDocumentFooterText } from '../../document/layout/documentFooterImage';
import { generateVarigeMenDocument } from '../../document/generators/varigemen/varigeMenDocument';
import { beregnVarigeMenGodtgoerelseWithRates } from '../../domain/varigemen/varigeMenCalculations';
import { varigeMenPrGrad } from '../../data/lovbestemteRates';
import { resolveStamdataDatoReference } from '../../domain/policies/stamdataCalculations';
import { toISODateString } from '../../types/branded';
import { createPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';

/**
 * Tværgående kanalprøve for et output uden tabelblokke.
 * PDF-siden bruger produktions-writerens faktiske tekstkald, men en spy i stedet for jsPDF, så testen
 * er deterministisk og kan køre uden en ekstern PDF-parser. Den hævder derfor semantisk kanalparitet,
 * ikke fysisk PDF-validitet eller rendering. En manglende label, værdi, sektion eller rækkefølge i én
 * writer gør sammenligningen rød.
 */
const { MockJsPDF } = vi.hoisted(() => {
  class MockJsPDF {
    static instances: MockJsPDF[] = [];
    internal = { pageSize: { width: 210, height: 297 } };
    private currentFontName = 'helvetica';
    private currentFontStyle = 'normal';
    private currentFontSize = 8;

    text = vi.fn((_text: string | readonly string[]) => undefined);

    constructor() {
      MockJsPDF.instances.push(this);
    }

    setFont = vi.fn((name: string, style: string) => {
      this.currentFontName = name;
      this.currentFontStyle = style;
    });
    getFont = vi.fn(() => ({ fontName: this.currentFontName, fontStyle: this.currentFontStyle }));
    setFontSize = vi.fn((size: number) => {
      this.currentFontSize = size;
    });
    getFontSize = vi.fn(() => this.currentFontSize);
    setTextColor = vi.fn();
    setDisplayMode = vi.fn();
    setProperties = vi.fn();
    splitTextToSize = vi.fn((text: string) => [text]);
    getTextWidth = vi.fn((text: string) => text.length * (this.currentFontStyle === 'bold' ? 0.95 : 0.8) * (this.currentFontSize / 8));
    getNumberOfPages = vi.fn(() => 1);
    setPage = vi.fn();
    line = vi.fn();
    setLineWidth = vi.fn();
    addPage = vi.fn();
    addImage = vi.fn();
    save = vi.fn();
  }

  return { MockJsPDF };
});

vi.mock('jspdf', () => ({ default: MockJsPDF }));
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

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

const renderPdfText = async (): Promise<string> => {
  MockJsPDF.instances = [];
  const session = await createPdfDocumentSessionForTest();
  await withDocumentUnavailable(() => runDocument(session));

  const instance = MockJsPDF.instances.at(-1);
  if (!instance) throw new Error('PDF-writeren oprettede ikke et dokument');

  return instance.text.mock.calls
    .map(([text]) => normalizeText(String(text)))
    .filter((text) => text !== '' && text !== normalizeText(buildDocumentFooterText()))
    .join(' ');
};

describe('dokumenttekst er semantisk ens i PDF- og Word-kanalen', () => {
  it('Varige mén bevarer samme tekst, tal, sektioner og rækkefølge', async () => {
    const pdfText = await renderPdfText();
    const { documentXml } = await withDocumentUnavailable(() => renderWordDocument(runDocument));
    const wordText = wordTextWithBoundaries(documentXml);

    // Begge kanaler skal først bevise, at den konkrete fixture faktisk nåede dokumentet. Ellers kunne
    // en fejl, der gjorde begge outputstrømme tomme, fejlagtigt bestå som lighed.
    expect(pdfText).toContain('Ménberegning');
    expect(wordText).toContain('Ménberegning');
    expect(pdfText).toContain('103.377 kr.');
    expect(wordText).toContain('103.377 kr.');
    expect(pdfText).toBe(wordText);
  });
});
