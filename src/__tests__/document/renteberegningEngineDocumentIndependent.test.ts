// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import type { RateEntry } from '../../data/interestRates';
import { computeRentekravRow } from '../../domain/renteberegning/renteberegningEngine';
import { generateRenteDocument } from '../../document/generators/renteberegning/renteDocument';
import { toISODateString, type ISODateString } from '../../types/branded';
import type { RentekravRow } from '../../schemas/formSchemas';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';

const iso = (value: string): ISODateString => toISODateString(value);

const referenceRates: ReadonlyArray<RateEntry> = [
  { effectiveDate: iso('2024-01-01'), ratePct: 3.75 },
  { effectiveDate: iso('2024-07-01'), ratePct: 3.5 },
];

const surchargeRates: ReadonlyArray<RateEntry> = [
  { effectiveDate: iso('2010-01-01'), ratePct: 8 },
];

const row: RentekravRow = {
  id: 'engine-document-facit',
  belob: { kind: 'number', value: 100_000 },
  renterFra: iso('2024-06-30'),
  tillaegstid: 0,
  enhed: 'dage',
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

const expectedDocumentText = [
  'Procesrente',
  'Hovedstol: 100.000,00 kr.',
  'Periode: 30-06-2024 - 02-07-2024 (begge dage inkl.)',
  '30-06-2024 - 30-06-2024',
  '01-07-2024 - 02-07-2024',
  '11,75 %',
  '11,5 %',
  '32,10 kr.',
  '62,84 kr.',
  'Samlet rentebeløb',
  '94,94 kr.',
] as const;

describe('CALC-003/DOC-003 – rentemotorens output gennem PDF og Word', () => {
  it('fører et uafhængigt flerperiodisk facit gennem begge dokumentgeneratorer', async () => {
    const result = computeRentekravRow(row, iso('2024-07-02'), referenceRates, surchargeRates);

    expect(result.actualInterestDate).toBe(iso('2024-06-30'));
    expect(result.calculatedInterest).toBe(94.95);
    expect(result.pdfContext).not.toBeNull();
    if (result.pdfContext === null) {
      throw new Error('Rentemotoren gav ingen dokumentkontekst');
    }
    const context = result.pdfContext;

    const { periods } = context;
    expect(periods.map((period) => ({
      startDate: period.startDate.toISOString(),
      endDate: period.endDate.toISOString(),
      amount: period.amount,
      referenceRatePct: period.referenceRatePct,
      surchargeRatePct: period.surchargeRatePct,
      totalRatePct: period.totalRatePct,
      days: period.days,
    }))).toEqual([
      {
        startDate: '2024-06-30T00:00:00.000Z',
        endDate: '2024-06-30T00:00:00.000Z',
        amount: 100_000,
        referenceRatePct: 3.75,
        surchargeRatePct: 8,
        totalRatePct: 11.75,
        days: 1,
      },
      {
        startDate: '2024-07-01T00:00:00.000Z',
        endDate: '2024-07-02T00:00:00.000Z',
        amount: 100_000,
        referenceRatePct: 3.5,
        surchargeRatePct: 8,
        totalRatePct: 11.5,
        days: 2,
      },
    ]);
    expect(periods[0]?.interest).toBeCloseTo(32.10382513661202, 12);
    expect(periods[1]?.interest).toBeCloseTo(62.84153005464481, 12);
    expect(periods[0]?.interest + (periods[1]?.interest ?? 0)).toBeCloseTo(
      32.10382513661202 + 62.84153005464481,
      12,
    );

    const render = (session: Parameters<typeof generateRenteDocument>[0]) => generateRenteDocument(
      session,
      context.beloeb,
      context.actualInterestDate,
      context.beregningsdato,
      context.periods,
      { latestReferenceRatePeriodEnd: context.latestReferenceRatePeriodEnd },
    );

    const pdfArtifact = await withDocumentUnavailable(async () => {
      const session = await createRealPdfDocumentSessionForTest();
      return render(session);
    });
    const pdfText = normalizeText(await extractPdfText(pdfArtifact.blob));
    const { filename, documentXml } = await withDocumentUnavailable(() => renderWordDocument(render));
    const wordText = normalizeText(xmlToPlainText(documentXml));

    expect(filename).toMatch(/\.docx$/i);
    for (const expectedText of expectedDocumentText) {
      expect(pdfText, `PDF mangler ${expectedText}`).toContain(expectedText);
      expect(wordText, `Word mangler ${expectedText}`).toContain(expectedText);
    }
  });
});
