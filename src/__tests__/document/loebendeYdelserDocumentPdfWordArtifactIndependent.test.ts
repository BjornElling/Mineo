// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { fromKroner } from '../../domain/money/money';
import { generateLoebendeYdelserDocument } from '../../document/generators/loebendeYdelser/loebendeYdelserDocument';
import type { EetLoebendeComputation } from '../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { toISODateString } from '../../types/branded';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';

const computation = {
  beregningsdato: toISODateString('2024-03-31'),
  skadedato: toISODateString('2020-01-01'),
  fodselsdato: toISODateString('1980-01-01'),
  skadesaar: 2020,
  aslAarsloenAfrundet1000Ore: fromKroner(400_000),
  maxAarsloenISkadesaarOre: fromKroner(600_000),
  benyttetAarsloenOre: fromKroner(400_000),
  grundloenNiveau: '2024',
  grundloenOre: fromKroner(320_000),
  erstatningsniveauPct: 83,
  amBidragPct: 8,
  reguleringFoer2024Pct: 0,
  afgoerelser: [{
    rowId: 'loebende-pdf-word-orakel',
    afgoerelsesdato: toISODateString('2024-01-01'),
    virkningsdato: toISODateString('2024-01-01'),
    kapitaliseringsdato: null,
    skaeringsDato: null,
    harOverlap: false,
    beregningsperioder: [],
    afgoerelseType: 'Midlertidig',
    eetPct: 50,
    priorKapPct: 0,
    eetPctFoerAktuelKap: 50,
    kapPctAktuel: 0,
    kapPctKumulativ: 0,
    restEetPct: 50,
    harKapitalisering: false,
    harRestSektion: false,
    tilbagevirkendeKraft: false,
    ophoerDato: toISODateString('2024-03-31'),
    ophoerAarsag: 'beregningsdato',
    grundydelseFuldOre: fromKroner(122_752),
    grundydelseRestOre: null,
    grundydelse2024FuldOre: fromKroner(122_752),
    grundydelse2024RestOre: null,
    perioder: [
      {
        fra: toISODateString('2024-01-01'),
        til: toISODateString('2024-01-31'),
        satsAar: 2024,
        maanederPraecis: 1,
        grundydelseAfrundetOre: fromKroner(122_752),
        reguleringPct: 0,
        maanedligYdelseOre: fromKroner(10_229.33),
        beregnetEetOre: fromKroner(10_229),
      },
      {
        fra: toISODateString('2024-02-01'),
        til: toISODateString('2024-03-31'),
        satsAar: 2024,
        maanederPraecis: 2,
        grundydelseAfrundetOre: fromKroner(122_752),
        reguleringPct: 0,
        maanedligYdelseOre: fromKroner(10_229.33),
        beregnetEetOre: fromKroner(20_459),
      },
    ],
    iAltBeregnetEetOre: fromKroner(30_688),
  }],
} satisfies EetLoebendeComputation;

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

const runDocument = (session: Parameters<typeof generateLoebendeYdelserDocument>[0]) =>
  generateLoebendeYdelserDocument(session, {
    computation,
    visUdvidetSpecifikation: false,
    visBrevhoved: false,
  });

const expectedContent = [
  'Løbende ydelser (EET)',
  'Afgørelse 1. januar 2024',
  'Midlertidig',
  '50 %',
  'Periodeafgrænsning',
  'Løbende ydelse opgjort til og med',
  '31-03-2024',
  'Beregnede ydelser',
  'Fra o.m.',
  'Til o.m.',
  '1,00000',
  '2,00000',
  '122.752,00 kr.',
  '0 %',
  '10.229 kr.',
  '30.688 kr.',
  'I alt',
] as const;

describe('DOC-001/TD-014 – løbende ydelser gennem faktiske PDF- og Word-artefakter', () => {
  it('bevarer håndskrevet tabelindhold og formatmetadata i begge kanaler', async () => {
    const pdfArtifact = await withDocumentUnavailable(async () => {
      const session = await createRealPdfDocumentSessionForTest();
      return runDocument(session);
    });
    const pdfText = normalizeText(await extractPdfText(pdfArtifact.blob));

    const wordArtifact = await withDocumentUnavailable(() => renderWordDocument(runDocument));
    const wordText = normalizeText(xmlToPlainText(wordArtifact.documentXml));

    expect(pdfArtifact.filename).toBe('Løbende ydelser (EET).pdf');
    expect(pdfArtifact.blob.type).toBe('application/pdf');
    expect(wordArtifact.filename).toBe('Løbende ydelser (EET).docx');
    expect(wordArtifact.blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    for (const expected of expectedContent) {
      expect(pdfText, `PDF mangler ${expected}`).toContain(expected);
      expect(wordText, `Word mangler ${expected}`).toContain(expected);
    }
  });
});
