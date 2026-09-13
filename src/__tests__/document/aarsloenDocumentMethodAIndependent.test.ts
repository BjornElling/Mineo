// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { computeAarsloenBeregning } from '../../domain/aarsloen/aarsloenBeregning';
import { generateAarsloenDocument } from '../../document/generators/aarsloen/aarsloenDocument';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../types/loen';
import { toISODateString } from '../../types/branded';
import type { AarsloenValues, StandardLoenTableRow } from '../../schemas/formSchemas';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';

const values: AarsloenValues = {
  feriePct: 10,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: 5,
  loenperiode: LOENPERIODE.DAG,
  tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
  tableData: [{
    id: 'april-2023',
    col0_maaned: '',
    col1_maaned: '',
    col0_uge: '',
    col1_uge: '',
    col0_dag: toISODateString('2023-04-01'),
    col1_dag: toISODateString('2023-04-30'),
    col2: { kind: 'number', value: 10_000 },
    col3: undefined,
    col4: undefined,
    col5: undefined,
    fpFvShSoBeloeb: undefined,
    pensionBeloeb: undefined,
  } satisfies StandardLoenTableRow],
  omregningTilFuldtAar: true,
  fuldLoenUnderFerie: false,
  retTilSjetteFerieuge: false,
  antalFeriedage: 2,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
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

describe('CALC-002 – uafhængigt Metode A-facit gennem Årsløn-dokumentgrænsen', () => {
  it('fører SH-dage, feriedagsfradrag og håndberegnede beløb til PDF og Word', async () => {
    const calculation = computeAarsloenBeregning({ values, omregningAktiveret: true });

    // Håndfacit: 10.000 kr. + 10 % feriepenge + 5 % pension af 11.000 kr. = 11.550 kr.
    // April 2023 har 20 hverdage, heraf 3 SH-dage. Med 2 feriedage bliver det 15 arbejdsdage.
    // Årsnormen er 261 - 25 ferie- og feriefridage - 8 SH-dage = 228 arbejdsdage;
    // 11.550 kr. / 15 × 228 = 175.560 kr.
    expect(calculation).toMatchObject({
      shDageAntal: 3,
      beregnetAarsloen: 11_550,
      beregningsData: {
        metode: 'A',
        erEtAar: false,
        hverdageIPeriode: 20,
        feriedageFraInput: 2,
        arbejdsdageIPeriode: 15,
        feriedagePaaAar: 25,
        arbejdsdagePaaAar: 228,
        omregnetAarsloen: 175_560,
      },
      beregningsFejl: null,
      harFatalBeregningsFejl: false,
    });

    const documentParams: Parameters<typeof generateAarsloenDocument>[1] = {
      satser: {
        feriePct: values.feriePct,
        fritvalgPct: values.fritvalgPct,
        shSoPct: values.shSoPct,
        storeBededagPct: values.storeBededagPct,
        pensionPct: values.pensionPct,
      },
      loenperiode: values.loenperiode,
      tillaegAngivesSom: values.tillaegAngivesSom,
      tableData: values.tableData,
      beregnetAarsloen: calculation.beregnetAarsloen,
      omregningTilFuldtAar: values.omregningTilFuldtAar,
      periodeData: calculation.periodeData,
      fuldLoenUnderFerie: values.fuldLoenUnderFerie,
      retTilSjetteFerieuge: values.retTilSjetteFerieuge,
      antalFeriedage: values.antalFeriedage,
      loenPaaHelligdage: values.loenPaaHelligdage,
      shDageAntal: calculation.shDageAntal,
      beregningsData: calculation.beregningsData,
      visBrevhoved: false,
    };

    const pdfArtifact = await withDocumentUnavailable(async () => {
      const session = await createRealPdfDocumentSessionForTest();
      return generateAarsloenDocument(session, documentParams);
    });
    const pdfText = normalizeText(await extractPdfText(pdfArtifact.blob));

    const wordArtifact = await withDocumentUnavailable(() => renderWordDocument((session) =>
      generateAarsloenDocument(session, documentParams)
    ));
    const wordText = normalizeText(xmlToPlainText(wordArtifact.documentXml));

    expect(pdfArtifact.filename).toBe('Årslønsberegning.pdf');
    expect(pdfArtifact.blob.type).toBe('application/pdf');
    expect(wordArtifact.filename).toBe('Årslønsberegning.docx');
    expect(wordArtifact.blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    const expectedContent = [
      'Årslønsberegning',
      'Feriegodtgørelse/-tillæg',
      '10 %',
      'Arbejdsgivers pensionsbidrag',
      '5 %',
      '01-04-2023',
      '30-04-2023',
      '10.000,00',
      '11.550,00',
      'Beregningsprincipper',
      '20 hverdage',
      'Fuld løn under ferie',
      'Nej',
      'Ret til 6. ferieuge',
      'Antal feriedage (mandag-fredag) i de indtastede perioder',
      'Løn på helligdage',
      'Ingen',
      'Antal SH-dage i de indtastede perioder',
      '3',
      'Beregning',
      '15 arbejdsdage',
      '228 arbejdsdage',
      '11.550,00 / 15 x 228',
      '175.560,00 kr.',
    ] as const;

    for (const expected of expectedContent) {
      expect(pdfText, `PDF mangler ${expected}`).toContain(expected);
      expect(wordText, `Word mangler ${expected}`).toContain(expected);
    }
  });
});
