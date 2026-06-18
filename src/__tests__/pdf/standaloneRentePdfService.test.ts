import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';

const {
  mockGenerateRentePdf,
  mockWriteRentePdfContent,
  mockBuildRentePdfBaseTitle,
  mockBuildRentePdfFilename,
  mockCreateStandardPdfWriter,
  mockWriter,
} = vi.hoisted(() => {
  const mockWriter = {
    setDisplayMode: vi.fn(),
    setProperties: vi.fn(),
    addPage: vi.fn(),
    addFooter: vi.fn(),
    save: vi.fn(),
  };

  return {
    mockGenerateRentePdf: vi.fn(),
    mockWriteRentePdfContent: vi.fn(),
    mockBuildRentePdfBaseTitle: vi.fn(() => 'Procesrente, 1.000,00 kr. (01-01-2024 - 30-06-2024)'),
    mockBuildRentePdfFilename: vi.fn((baseTitle: string) => `${baseTitle}.pdf`),
    mockCreateStandardPdfWriter: vi.fn(() => mockWriter),
    mockWriter,
  };
});

vi.mock('../../document/generators/renteberegning/renteDocument', () => ({
  generateRenteDocument: mockGenerateRentePdf,
  writeRenteDocumentContent: mockWriteRentePdfContent,
  buildRenteDocumentBaseTitle: mockBuildRentePdfBaseTitle,
  buildRenteDocumentFilename: mockBuildRentePdfFilename,
}));

vi.mock('../../pdf/infrastructure/pdfWriter', () => ({
  createPdfChannelWriter: mockCreateStandardPdfWriter,
}));

import { downloadAllStandaloneRentePdf, downloadStandaloneRentePdf } from '../../pdf/infrastructure/standaloneRentePdfService';
import { toISODateString } from '../../types/branded';

const makePeriod = (): ProcessInterestPeriod => ({
  startDate: new Date(toISODateString('2024-01-01')),
  endDate: new Date(toISODateString('2024-06-30')),
  amount: 1000,
  referenceRatePct: 4.25,
  surchargeRatePct: 8,
  totalRatePct: 12.25,
  days: 181,
  interest: 60.87,
});

const ROW = {
  beloeb: 1000,
  actualInterestDate: '01-01-2024',
  beregningsdato: '30-06-2024',
  periods: [makePeriod()],
  latestReferenceRateDate: null,
};

describe('downloadStandaloneRentePdf', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGenerateRentePdf.mockReset();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('genererer neutral rente-PDF uden brevhoved, stamdata eller settings', async () => {
    const result = await downloadStandaloneRentePdf({
      beloeb: 5000,
      actualInterestDate: '01-06-2024',
      beregningsdato: toISODateString('2024-07-01'),
      periods: [makePeriod()],
      latestReferenceRateDate: null,
      kommentarer: 'Standalone',
    });

    expect(result.success).toBe(true);
    expect(mockGenerateRentePdf).toHaveBeenCalledWith(
      5000,
      '01-06-2024',
      toISODateString('2024-07-01'),
      [expect.objectContaining({ amount: 1000 })],
      {
        visBrevhoved: false,
        stamdata: null,
        kommentarer: 'Standalone',
        latestReferenceRateDate: null,
      }
    );
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateRentePdf.mockImplementationOnce(() => { throw new Error('Fejl'); });

    const result = await downloadStandaloneRentePdf({
      beloeb: 0,
      actualInterestDate: '01-01-2024',
      beregningsdato: toISODateString('2024-01-01'),
      periods: [],
      latestReferenceRateDate: null,
    });

    expect(result).toEqual({ success: false, error: 'Kunne ikke generere rente-PDF' });
    // Standalone-appen er namespace-isoleret og må ikke bruge hovedappens systemIssueReporter;
    // fejl logges lokalt med console.error (jf. minprocesrenteStandaloneIsolation-guard).
    expect(consoleErrorSpy).toHaveBeenCalledWith('Kunne ikke generere rente-PDF', expect.any(Error));
  });
});

describe('downloadAllStandaloneRentePdf', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockWriteRentePdfContent.mockReset();
    mockBuildRentePdfBaseTitle.mockClear();
    mockBuildRentePdfFilename.mockClear();
    mockCreateStandardPdfWriter.mockClear();
    mockWriter.setDisplayMode.mockClear();
    mockWriter.setProperties.mockClear();
    mockWriter.addPage.mockClear();
    mockWriter.addFooter.mockClear();
    mockWriter.save.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returnerer fejl ved 0 rækker', async () => {
    const result = await downloadAllStandaloneRentePdf({ rows: [] });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Ingen rækker at downloade');
    }
    expect(mockCreateStandardPdfWriter).not.toHaveBeenCalled();
  });

  it('returnerer success ved 1 række med gyldige perioder', async () => {
    const result = await downloadAllStandaloneRentePdf({ rows: [ROW] });

    expect(result.success).toBe(true);
    expect(mockWriteRentePdfContent).toHaveBeenCalledTimes(1);
    expect(mockWriter.addPage).not.toHaveBeenCalled();
    expect(mockWriter.addFooter).toHaveBeenCalledTimes(1);
    expect(mockWriter.save).toHaveBeenCalledWith('Procesrente, 1.000,00 kr. (01-01-2024 - 30-06-2024).pdf');
  });

  it('returnerer success ved 2 rækker og skriver ét samlet dokument', async () => {
    const result = await downloadAllStandaloneRentePdf({
      rows: [ROW, { ...ROW, beloeb: 2000 }],
    });

    expect(result.success).toBe(true);
    expect(mockWriteRentePdfContent).toHaveBeenCalledTimes(2);
    expect(mockWriter.addPage).toHaveBeenCalledTimes(1);
    expect(mockWriter.addFooter).toHaveBeenCalledTimes(1);
    expect(mockWriter.save).toHaveBeenCalledWith('Procesrente, 1.000,00 kr. (01-01-2024 - 30-06-2024) +1.pdf');
  });

  it('returnerer fejl ved tomme perioder i en række', async () => {
    const result = await downloadAllStandaloneRentePdf({
      rows: [{ ...ROW, periods: [] }],
    });

    expect(result.success).toBe(false);
    expect(mockWriteRentePdfContent).not.toHaveBeenCalled();
    expect(mockWriter.save).not.toHaveBeenCalled();
    // Lokal console.error (ikke central systemIssueReporter) pga. standalone-isolation.
    expect(consoleErrorSpy).toHaveBeenCalledWith('Kunne ikke generere rente-PDF', expect.any(Error));
  });
});
