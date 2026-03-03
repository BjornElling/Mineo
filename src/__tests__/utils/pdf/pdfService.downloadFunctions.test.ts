/// <reference types="vitest/globals" />

import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';

// ─── Logger mock (forhindrer console-output fra error-stier) ─────────────────

vi.mock('../../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn(),
}));

// ─── Mocks til loadXxxPdfModule-funktionerne ──────────────────────────────────

const mockGenerateSatserPdf = vi.fn();
const mockGenerateRentePdf = vi.fn();
const mockGenerateReguleringPdf = vi.fn();
const mockGenerateKRLPdf = vi.fn();
const mockGenerateErstatningsopgoerelsePdf = vi.fn();
const mockGenerateTafFordeltPaaAarPdf = vi.fn();
const mockGenerateVarigeMenPdf = vi.fn();
const mockGenerateAarsloenPdf = vi.fn();
const mockGenerateSHDagePdf = vi.fn();

vi.mock('../../../utils/pdf/pdfLoader', () => ({
  loadSatserPdfModule: vi.fn(async () => ({ generateSatserPdf: mockGenerateSatserPdf })),
  loadRentePdfModule: vi.fn(async () => ({ generateRentePdf: mockGenerateRentePdf })),
  loadReguleringPdfModule: vi.fn(async () => ({ generateReguleringPdf: mockGenerateReguleringPdf })),
  loadKRLPdfModule: vi.fn(async () => ({ generateKRLPdf: mockGenerateKRLPdf })),
  loadErstatningsopgoerelsePdfModule: vi.fn(async () => ({
    generateErstatningsopgoerelsePdf: mockGenerateErstatningsopgoerelsePdf,
  })),
  loadTafFordeltPaaAarPdfModule: vi.fn(async () => ({
    generateTafFordeltPaaAarPdf: mockGenerateTafFordeltPaaAarPdf,
  })),
  loadVarigeMenPdfModule: vi.fn(async () => ({ generateVarigeMenPdf: mockGenerateVarigeMenPdf })),
  loadAarsloenPdfModule: vi.fn(async () => ({ generateAarsloenPdf: mockGenerateAarsloenPdf })),
  loadSHDagePdfModule: vi.fn(async () => ({ generateSHDagePdf: mockGenerateSHDagePdf })),
}));

import {
  downloadSatserPdf,
  downloadRentePdf,
  downloadReguleringPdf,
  downloadKrlPdf,
  downloadErstatningsopgoerelsePdf,
  downloadTafFordeltPaaAarPdf,
  downloadVarigeMenPdf,
  downloadAarsloenPdf,
  downloadSHDagePdf,
} from '../../../utils/pdf/pdfService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const settings = DEFAULT_APP_SETTINGS;
const stamdata = STAMDATA_INITIAL_VALUES;
const eoValues = createErstatningsopgoerelseInitialValues();

// ─── downloadSatserPdf ────────────────────────────────────────────────────────

describe('downloadSatserPdf', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadSatserPdf({
      year: 2024,
      satser: {} as never,
      settings,
      persistedStamdata: stamdata,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateSatserPdf).toHaveBeenCalled();
  });

  it('returnerer success=false og error-string når generator kaster', async () => {
    mockGenerateSatserPdf.mockImplementationOnce(() => { throw new Error('PDF-fejl'); });
    const result = await downloadSatserPdf({
      year: 2024,
      satser: {} as never,
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });
});

// ─── downloadRentePdf ─────────────────────────────────────────────────────────

describe('downloadRentePdf', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadRentePdf({
      beloeb: 5000,
      actualInterestDate: '01-06-2024',
      beregningsdato: '01-01-2024',
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateRentePdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateRentePdf.mockImplementationOnce(() => { throw new Error('Fejl'); });
    const result = await downloadRentePdf({
      beloeb: 0,
      actualInterestDate: '01-01-2024',
      beregningsdato: '01-01-2024',
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(false);
  });
});

// ─── downloadReguleringPdf ────────────────────────────────────────────────────

describe('downloadReguleringPdf', () => {
  const validInterval = { fraDato: '2024-01-01', tilDato: '2024-12-31' };

  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadReguleringPdf({
      input: {
        overenskomstLabel: 'Test',
        loenudviklingBasis: 'Overenskomst',
        overenskomstId: undefined,
        statistikModelLabel: undefined,
        interval: validInterval,
        applyAlmindeligLoenPaaShDageRegel: false,
      },
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateReguleringPdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved ugyldigt interval', async () => {
    const result = await downloadReguleringPdf({
      input: {
        overenskomstLabel: 'Test',
        loenudviklingBasis: 'Overenskomst',
        overenskomstId: undefined,
        statistikModelLabel: undefined,
        interval: { fraDato: 'not-a-date', tilDato: 'not-a-date' },
        applyAlmindeligLoenPaaShDageRegel: false,
      },
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(false);
  });
});

// ─── downloadKrlPdf ───────────────────────────────────────────────────────────

describe('downloadKrlPdf', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadKrlPdf({ settings, persistedStamdata: null });
    expect(result.success).toBe(true);
    expect(mockGenerateKRLPdf).toHaveBeenCalled();
  });

  it('arver brevhoved-indstilling 1-til-1 fra regulering', async () => {
    const settingsWithReguleringBrevhoved = {
      ...DEFAULT_APP_SETTINGS,
      brevhovedIndstillinger: {
        ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger,
        regulering: true,
      },
    };
    const result = await downloadKrlPdf({ settings: settingsWithReguleringBrevhoved, persistedStamdata: stamdata });
    expect(result.success).toBe(true);

    const lastCall = mockGenerateKRLPdf.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({ visBrevhoved: true });
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateKRLPdf.mockImplementationOnce(() => { throw new Error('KRL fejl'); });
    const result = await downloadKrlPdf({ settings, persistedStamdata: null });
    expect(result.success).toBe(false);
  });
});

// ─── downloadErstatningsopgoerelsePdf ────────────────────────────────────────

describe('downloadErstatningsopgoerelsePdf', () => {
  it('returnerer success=true ved gyldigt payload', async () => {
    const result = await downloadErstatningsopgoerelsePdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateErstatningsopgoerelsePdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved ugyldigt payload', async () => {
    const result = await downloadErstatningsopgoerelsePdf({
      stamdataValues: { ugyldig: true },
      eoValues: { ugyldig: true },
      selectedElements: {} as never,
      settings,
    });
    expect(result.success).toBe(false);
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateErstatningsopgoerelsePdf.mockImplementationOnce(() => { throw new Error('EO fejl'); });
    const result = await downloadErstatningsopgoerelsePdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
    });
    expect(result).toMatchObject({ success: false, error: 'Kunne ikke generere erstatningsopgørelse-PDF' });
  });
});

// ─── downloadTafFordeltPaaAarPdf ──────────────────────────────────────────────

describe('downloadTafFordeltPaaAarPdf', () => {
  it('returnerer success=true ved gyldigt payload', async () => {
    const result = await downloadTafFordeltPaaAarPdf({
      stamdataValues: stamdata,
      eoValues,
      settings,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateTafFordeltPaaAarPdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved ugyldigt payload', async () => {
    const result = await downloadTafFordeltPaaAarPdf({
      stamdataValues: { ugyldig: true },
      eoValues: { ugyldig: true },
      settings,
    });
    expect(result.success).toBe(false);
  });
});

// ─── downloadVarigeMenPdf ─────────────────────────────────────────────────────

describe('downloadVarigeMenPdf', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadVarigeMenPdf({
      fodselsdato: undefined,
      skadesdato: undefined,
      mengrad: undefined,
      beregningsdato: undefined,
      beregningsResultat: {} as never,
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateVarigeMenPdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateVarigeMenPdf.mockImplementationOnce(() => { throw new Error('VM fejl'); });
    const result = await downloadVarigeMenPdf({
      fodselsdato: undefined,
      skadesdato: undefined,
      mengrad: undefined,
      beregningsdato: undefined,
      beregningsResultat: {} as never,
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(false);
  });
});

// ─── downloadAarsloenPdf ──────────────────────────────────────────────────────

describe('downloadAarsloenPdf', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadAarsloenPdf({
      input: {} as never,
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateAarsloenPdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateAarsloenPdf.mockImplementationOnce(() => { throw new Error('ASL fejl'); });
    const result = await downloadAarsloenPdf({
      input: {} as never,
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(false);
  });
});

// ─── downloadSHDagePdf ────────────────────────────────────────────────────────

describe('downloadSHDagePdf', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadSHDagePdf({
      perioder: [],
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateSHDagePdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateSHDagePdf.mockImplementationOnce(() => { throw new Error('SH fejl'); });
    const result = await downloadSHDagePdf({
      perioder: [],
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(false);
  });
});
