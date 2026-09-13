// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { generateAarsloenDocument } from '../../document/generators/aarsloen/aarsloenDocument';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../types/loen';
import { createDate } from '../../utils/dateUtils';
import { toISODateString } from '../../types/branded';
import type { AarsloenBeregningResult } from '../../types/calculation';
import type { PeriodeResult } from '../../utils/periodeBeregning';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';

const periodeData: PeriodeResult = {
  periodeTekst: 'jan 2024 - feb 2024',
  totalEnheder: 2,
  unikkeEnheder: 2,
  enhedNavn: 'måneder',
  datoSet: new Set([
    toISODateString('2024-01-01'),
    toISODateString('2024-02-01'),
  ]),
  perioder: [
    { start: createDate(2024, 0, 1), end: createDate(2024, 0, 31) },
    { start: createDate(2024, 1, 1), end: createDate(2024, 1, 29) },
  ],
};

const beregningsData: AarsloenBeregningResult = {
  metode: 'C',
  erEtAar: false,
  hverdageIPeriode: 44,
  feriedageFraInput: 0,
  arbejdsdageIPeriode: 0,
  feriedagePaaAar: 30,
  arbejdsdagePaaAar: 0,
  hverdagePaaAar: 0,
  antalEnheder: 2,
  antalHeleKalendermaaneder: null,
  omregnetAarsloen: 207_900,
};

const params: Parameters<typeof generateAarsloenDocument>[1] = {
  satser: {
    feriePct: 10,
    fritvalgPct: undefined,
    shSoPct: undefined,
    storeBededagPct: undefined,
    pensionPct: 5,
  },
  loenperiode: LOENPERIODE.MAANED,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
  tableData: [
    {
      id: 'januar-2024',
      col0_maaned: '1',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: { kind: 'number', value: 20_000 },
      col3: undefined,
      col4: undefined,
      col5: undefined,
      fpFvShSoBeloeb: undefined,
      pensionBeloeb: undefined,
    },
    {
      id: 'februar-2024',
      col0_maaned: '2',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: undefined,
      col1_dag: undefined,
      col2: { kind: 'number', value: 10_000 },
      col3: undefined,
      col4: undefined,
      col5: undefined,
      fpFvShSoBeloeb: undefined,
      pensionBeloeb: undefined,
    },
  ],
  beregnetAarsloen: 34_650,
  omregningTilFuldtAar: true,
  periodeData,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: true,
  antalFeriedage: undefined,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
  shDageAntal: null,
  beregningsData,
  visBrevhoved: false,
};

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
  'Årslønsberegning',
  'Satser',
  'Feriegodtgørelse/-tillæg',
  '10 %',
  'Arbejdsgivers pensionsbidrag',
  '5 %',
  'Indtægtsoplysninger',
  'Måned',
  'År',
  '20.000,00',
  '23.100,00',
  '10.000,00',
  '11.550,00',
  'I alt',
  '34.650,00',
  'Beregningsprincipper',
  'Antal måneder i de indtastede perioder',
  '2 måneder',
  'Løn på helligdage',
  'Almindelig løn',
  'Beregning',
  'Sammentælling af løn fra tabellen',
  'Beregnet årsløn',
  '207.900,00 kr.',
] as const;

const runDocument = (session: Parameters<typeof generateAarsloenDocument>[0]) =>
  generateAarsloenDocument(session, params);

describe('TD-014/TD-018 – Årslønens faktiske PDF- og Word-artefakter', () => {
  it('bevarer statisk titel, synligt indhold og filmetadata i begge kanaler', async () => {
    const pdfArtifact = await withDocumentUnavailable(async () => {
      const session = await createRealPdfDocumentSessionForTest();
      return runDocument(session);
    });
    const pdfText = normalizeText(await extractPdfText(pdfArtifact.blob));

    const wordArtifact = await withDocumentUnavailable(() => renderWordDocument(runDocument));
    const wordText = normalizeText(xmlToPlainText(wordArtifact.documentXml));

    expect(pdfArtifact.filename).toBe('Årslønsberegning.pdf');
    expect(pdfArtifact.blob.type).toBe('application/pdf');
    expect(wordArtifact.filename).toBe('Årslønsberegning.docx');
    expect(wordArtifact.blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    for (const expected of expectedContent) {
      expect(pdfText, `PDF mangler ${expected}`).toContain(expected);
      expect(wordText, `Word mangler ${expected}`).toContain(expected);
    }
  });
});
