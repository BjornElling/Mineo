// @vitest-environment jsdom
import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';

const {
  mockGenerateRentePdf,
  mockGenerateRenteOversigtPdf,
  mockWriteRentePdfContent,
  mockBuildRentePdfBaseTitle,
  mockCreateStandardPdfWriter,
  mockTriggerDocumentDownload,
  mockWriter,
} = vi.hoisted(() => {
  const mockWriter = {
    setDisplayMode: vi.fn(),
    setProperties: vi.fn(),
    addPage: vi.fn(),
    addFooter: vi.fn(),
    build: vi.fn(async () => new Blob()),
  };

  return {
    mockGenerateRentePdf: vi.fn(),
    mockGenerateRenteOversigtPdf: vi.fn(),
    mockWriteRentePdfContent: vi.fn(),
    mockBuildRentePdfBaseTitle: vi.fn(() => 'Procesrente, 1.000,00 kr. (01-01-2024 - 30-06-2024)'),
    mockCreateStandardPdfWriter: vi.fn(() => mockWriter),
    mockTriggerDocumentDownload: vi.fn(),
    mockWriter,
  };
});

vi.mock('../../document/generators/renteberegning/renteDocument', () => ({
  generateRenteDocument: mockGenerateRentePdf,
  writeRenteDocumentContent: mockWriteRentePdfContent,
  buildRenteDocumentBaseTitle: mockBuildRentePdfBaseTitle,
}));

vi.mock('../../document/generators/renteberegning/renteOversigtDocument', () => ({
  generateRenteOversigtDocument: mockGenerateRenteOversigtPdf,
}));

vi.mock('../../pdf/infrastructure/pdfWriter', () => ({
  createPdfChannelWriter: mockCreateStandardPdfWriter,
}));

vi.mock('../../document/downloadArtifact', () => ({
  triggerDocumentDownload: mockTriggerDocumentDownload,
}));

import {
  downloadAllStandaloneRentePdf,
  downloadStandaloneRenteOversigtPdf,
  downloadStandaloneRentePdf,
} from '../../pdf/infrastructure/standaloneRentePdfService';
import { setDocumentBrand } from '../../document/documentBrand';
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
    mockGenerateRentePdf.mockResolvedValue({ blob: new Blob(), filename: 'rente.pdf' });
    mockTriggerDocumentDownload.mockClear();
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
      isSourceCurrent: () => true,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateRentePdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'pdf' }),
      5000,
      '01-06-2024',
      toISODateString('2024-07-01'),
      [expect.objectContaining({ amount: 1000 })],
      {
        visBrevhoved: false,
        stamdata: null,
        kommentarer: 'Standalone',
        latestReferenceRateDate: null,
        metadata: {
          subject: 'Renteberegning',
          author: 'minprocesrente.dk',
        },
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
      isSourceCurrent: () => true,
    });

    expect(result).toEqual({ success: false, error: 'Kunne ikke generere rente-PDF' });
    // Standalone-appen er namespace-isoleret og må ikke bruge hovedappens systemIssueReporter;
    // fejl logges lokalt med console.error (jf. minprocesrenteStandaloneIsolation-guard).
    expect(consoleErrorSpy).toHaveBeenCalledWith('Kunne ikke generere rente-PDF', expect.any(Error));
  });

  it('starter ikke download, hvis input ændres under genereringen', async () => {
    let current = true;
    mockGenerateRentePdf.mockImplementationOnce(async () => {
      current = false;
      return { blob: new Blob(), filename: 'rente.pdf' };
    });

    const result = await downloadStandaloneRentePdf({
      beloeb: 1000,
      actualInterestDate: '01-01-2024',
      beregningsdato: toISODateString('2024-06-30'),
      periods: [makePeriod()],
      latestReferenceRateDate: null,
      isSourceCurrent: () => current,
    });

    expect(result.success).toBe(false);
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });
});

describe('downloadStandaloneRenteOversigtPdf', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGenerateRenteOversigtPdf.mockReset();
    mockGenerateRenteOversigtPdf.mockResolvedValue({ blob: new Blob(), filename: 'oversigt.pdf' });
    mockTriggerDocumentDownload.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('genererer oversigts-PDF med MinProcesrente-metadata', async () => {
    const result = await downloadStandaloneRenteOversigtPdf({
      beregningsdato: toISODateString('2024-07-01'),
      rows: [{ beloeb: 1000, renterFra: toISODateString('2024-01-01'), beregnetRente: 60.87 }],
      latestReferenceRateDate: toISODateString('2024-06-30'),
      kommentarer: 'Oversigt',
      isSourceCurrent: () => true,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateRenteOversigtPdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'pdf' }),
      toISODateString('2024-07-01'),
      [{ beloeb: 1000, renterFra: toISODateString('2024-01-01'), beregnetRente: 60.87 }],
      {
        visBrevhoved: false,
        stamdata: null,
        kommentarer: 'Oversigt',
        latestReferenceRateDate: toISODateString('2024-06-30'),
        metadata: {
          subject: 'Renteberegning',
          author: 'minprocesrente.dk',
        },
      }
    );
  });

  it('starter ikke download, hvis input ændres under genereringen', async () => {
    let current = true;
    mockGenerateRenteOversigtPdf.mockImplementationOnce(async () => {
      current = false;
      return { blob: new Blob(), filename: 'oversigt.pdf' };
    });

    const result = await downloadStandaloneRenteOversigtPdf({
      beregningsdato: toISODateString('2024-07-01'),
      rows: [{ beloeb: 1000, renterFra: toISODateString('2024-01-01'), beregnetRente: 60.87 }],
      isSourceCurrent: () => current,
    });

    expect(result.success).toBe(false);
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });
});

describe('downloadAllStandaloneRentePdf', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setDocumentBrand('minprocesrente.dk');
    mockWriteRentePdfContent.mockReset();
    mockBuildRentePdfBaseTitle.mockClear();
    mockCreateStandardPdfWriter.mockClear();
    mockWriter.setDisplayMode.mockClear();
    mockWriter.setProperties.mockClear();
    mockWriter.addPage.mockClear();
    mockWriter.addFooter.mockClear();
    mockWriter.build.mockClear();
    mockTriggerDocumentDownload.mockClear();
  });

  afterEach(() => {
    setDocumentBrand('mineo.dk');
    consoleErrorSpy.mockRestore();
  });

  it('returnerer fejl ved 0 rækker', async () => {
    const result = await downloadAllStandaloneRentePdf({ rows: [], isSourceCurrent: () => true });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Ingen rækker at downloade');
    }
    expect(mockCreateStandardPdfWriter).not.toHaveBeenCalled();
  });

  it('returnerer success ved 1 række med gyldige perioder', async () => {
    const result = await downloadAllStandaloneRentePdf({ rows: [ROW], isSourceCurrent: () => true });

    expect(result.success).toBe(true);
    expect(mockWriter.setProperties).toHaveBeenCalledWith({
      title: 'Procesrente',
      subject: 'Renteberegning',
      author: 'minprocesrente.dk',
      creator: 'minprocesrente.dk',
    });
    expect(mockWriteRentePdfContent).toHaveBeenCalledTimes(1);
    expect(mockWriter.addPage).not.toHaveBeenCalled();
    expect(mockWriter.addFooter).toHaveBeenCalledTimes(1);
    expect(mockWriter.build).toHaveBeenCalledTimes(1);
    expect(mockTriggerDocumentDownload).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'Procesrente, 1.000,00 kr. (01-01-2024 - 30-06-2024).pdf',
    }));
  });

  it('returnerer success ved 2 rækker og skriver ét samlet dokument', async () => {
    const result = await downloadAllStandaloneRentePdf({
      rows: [ROW, { ...ROW, beloeb: 2000 }],
      isSourceCurrent: () => true,
    });

    expect(result.success).toBe(true);
    expect(mockWriteRentePdfContent).toHaveBeenCalledTimes(2);
    expect(mockWriter.addPage).toHaveBeenCalledTimes(1);
    expect(mockWriter.addFooter).toHaveBeenCalledTimes(1);
    expect(mockTriggerDocumentDownload).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'Procesrente, 1.000,00 kr. (01-01-2024 - 30-06-2024) +1.pdf',
    }));
  });

  it('returnerer fejl ved tomme perioder i en række', async () => {
    const result = await downloadAllStandaloneRentePdf({
      rows: [{ ...ROW, periods: [] }],
      isSourceCurrent: () => true,
    });

    expect(result.success).toBe(false);
    expect(mockWriteRentePdfContent).not.toHaveBeenCalled();
    expect(mockWriter.build).not.toHaveBeenCalled();
    // Lokal console.error (ikke central systemIssueReporter) pga. standalone-isolation.
    expect(consoleErrorSpy).toHaveBeenCalledWith('Kunne ikke generere rente-PDF', expect.any(Error));
  });

  it('starter ikke download, hvis input ændres under renderingen', async () => {
    let current = true;
    mockWriter.build.mockImplementationOnce(async () => {
      current = false;
      return new Blob();
    });

    const result = await downloadAllStandaloneRentePdf({
      rows: [ROW],
      isSourceCurrent: () => current,
    });

    expect(result.success).toBe(false);
    expect(mockTriggerDocumentDownload).not.toHaveBeenCalled();
  });
});
