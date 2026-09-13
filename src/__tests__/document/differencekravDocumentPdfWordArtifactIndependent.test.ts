// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { fromKroner } from '../../domain/money/money';
import type { EetDifferencekravComputation } from '../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import { generateDifferencekravDocument } from '../../document/generators/differencekrav/differencekravDocument';
import { toISODateString } from '../../types/branded';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';

const iso = (value: string) => toISODateString(value);

const computation = {
  beregningsdato: iso('2024-06-30'),
  skadedato: iso('2010-01-15'),
  dagFoerBeregningsdato: iso('2024-06-29'),
  fradragGaelderForFoer2011: true,
  ealKravOre: fromKroner(1_250_000),
  ealEetPct: 42.5,
  fradragLoebendeYdelserOre: fromKroner(12_345),
  fradragKapitaliseretEetOre: fromKroner(67_890),
  proformaKapitalisering: null,
  resterendeLoebendeYdelser: null,
  merErstatningPensionsalder: null,
  differencekravFoerForligOre: fromKroner(1_169_765),
  forligFactor: 2 / 3,
  forligLabel: '2/3',
  forligDato: iso('2024-07-01'),
  differencekravOre: fromKroner(779_843),
  afgoerelser: [
    {
      rowId: 'differencekrav-pdf-word-lobende',
      afgoerelsesdato: iso('2020-01-01'),
      virkningsdato: iso('2020-02-01'),
      afgoerelseType: 'Midlertidig',
      eetPct: 30,
      fradragesTil: iso('2024-06-30'),
      beloebOre: fromKroner(12_345),
      fradragForetages: true,
      tilbagevirkendeKraftFradrag: null,
    },
  ],
  kapitaliseringerAfgoerelser: [
    {
      rowId: 'differencekrav-pdf-word-kapitaliseret',
      afgoerelsesdato: iso('2021-01-01'),
      kapitaliseringsdato: iso('2021-02-01'),
      kapitaliseringspct: 25,
      kapitalbelobOre: fromKroner(67_890),
      kapitaliseringEfterBeregningsdato: false,
    },
  ],
  loebendeComputation: null,
  kapComputation: null,
  ealComputation: null,
} satisfies EetDifferencekravComputation;

const params = {
  computation,
  bilagSelection: {
    opgoerelse: true,
    loebendeYdelser: false,
    kapitalisering: false,
    eetEfterEal: false,
    proformaKapitalisering: false,
    merErstatningPensionsalder: false,
    visUdvidetSpecifikationLoebendeYdelserBilag: false,
  },
  visBrevhoved: false,
  stamdata: { journalnr: 'DOC-001-TD-014' },
} satisfies Parameters<typeof generateDifferencekravDocument>[1];

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

const expectedContent = [
  'Differencekrav (EET)',
  'Beregning',
  'Beregningsdato',
  '30-06-2024',
  'Specifikation',
  'EAL-krav',
  'Erhvervsevnetabet udgør 42,5 %.',
  'Det svarer til et beregnet erhvervsevnetab på:',
  '1.250.000 kr.',
  'Løbende ASL-ydelser',
  'Skaden er indtrådt før 16. juni 2011.',
  'Der foretages derfor fradrag i differencekravet med midlertidige EET-ydelser.',
  'Afgørelse 1. januar 2020',
  'Midlertidig afgørelse (30 %)',
  'Løbende ydelser (01-02-2020 - 30-06-2024):',
  '- 12.345 kr.',
  'Kapitaliserede ASL-beløb',
  'Værdien af modtagne kapitalbeløb fratrækkes.',
  'Afgørelse 1. januar 2021',
  'Kapitaliseret (25 %) den 01-02-2021:',
  '- 67.890 kr.',
  'Differencekrav',
  'Der er den 1. juli 2024 indgået forlig i sagen på betaling af 2/3.',
  'Beregnet differencekrav (2/3 af 1.169.765 kr.)',
  '779.843 kr.',
];

const render = (session: Parameters<typeof generateDifferencekravDocument>[0]) =>
  generateDifferencekravDocument(session, params);

describe('DOC-001/TD-014 – Differencekravs faktiske PDF- og Word-artefakter', () => {
  it('fører det håndberegnede hovedsidefacit til begge generatorer med metadata', async () => {
    // Uafhængigt håndfacit: 1.250.000 − 12.345 − 67.890 = 1.169.765 kr.;
    // 1.169.765 x 2/3 = 779.843,333..., afrundet til 779.843 kr.
    const pdfArtifact = await withDocumentUnavailable(async () => {
      const session = await createRealPdfDocumentSessionForTest();
      return render(session);
    });
    const pdfText = normalizeText(await extractPdfText(pdfArtifact.blob));
    const pdfMetadata = new TextDecoder('latin1').decode(await pdfArtifact.blob.arrayBuffer());

    const wordArtifact = await withDocumentUnavailable(() => renderWordDocument(render));
    const wordText = normalizeText(xmlToPlainText(wordArtifact.documentXml));
    const wordCoreXml = (await wordArtifact.zip.file('docProps/core.xml')?.async('string')) ?? '';

    expect(pdfArtifact.filename).toBe('DOC-001-TD-014 - Differencekrav (EET).pdf');
    expect(pdfArtifact.blob.type).toBe('application/pdf');
    expect(wordArtifact.filename).toBe('DOC-001-TD-014 - Differencekrav (EET).docx');
    expect(wordArtifact.blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    for (const expected of expectedContent) {
      expect(pdfText, `PDF mangler ${expected}`).toContain(expected);
      expect(wordText, `Word mangler ${expected}`).toContain(expected);
    }

    expect(pdfMetadata).toContain('/Title (Differencekrav \\(EET\\))');
    expect(pdfMetadata).toContain('/Subject (Erstatningsberegning)');
    expect(pdfMetadata).toContain('/Author (mineo.dk)');
    expect(pdfMetadata).toContain('/Creator (mineo.dk)');
    expect(wordCoreXml).toContain('<dc:title>Differencekrav (EET)</dc:title>');
    expect(wordCoreXml).toContain('<dc:subject>Erstatningsberegning</dc:subject>');
    expect(wordCoreXml).toContain('<dc:creator>mineo.dk</dc:creator>');
  });
});
