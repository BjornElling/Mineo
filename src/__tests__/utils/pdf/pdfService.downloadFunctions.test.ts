/// <reference types="vitest/globals" />

import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';

// ─── Logger mock (forhindrer console-output fra error-stier) ─────────────────

vi.mock('../../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn(),
  getTimestamp: vi.fn(() => '2024-01-01T00:00:00.000Z'),
}));

// ─── Mocks til loadXxxPdfModule-funktionerne ──────────────────────────────────

const {
  mockGenerateSatserPdf,
  mockGenerateRentePdf,
  mockGenerateReguleringPdf,
  mockGenerateKRLPdf,
  mockGenerateLoebendeYdelserPdf,
  mockGenerateKapitaliseringPdf,
  mockGenerateEfterEalPdf,
  mockGenerateDifferencekravPdf,
  mockGenerateErstatningsopgoerelsePdf,
  mockGenerateTafFordeltPaaAarPdf,
  mockGenerateVarigeMenPdf,
  mockGenerateAarsloenPdf,
  mockGenerateSHDagePdf,
  mockEoSnapshotToEoPdfDocument,
  mockEoSnapshotToTafPerYearPdfDocument,
} = vi.hoisted(() => ({
  mockGenerateSatserPdf: vi.fn(),
  mockGenerateRentePdf: vi.fn(),
  mockGenerateReguleringPdf: vi.fn(),
  mockGenerateKRLPdf: vi.fn(),
  mockGenerateLoebendeYdelserPdf: vi.fn(),
  mockGenerateKapitaliseringPdf: vi.fn(),
  mockGenerateEfterEalPdf: vi.fn(),
  mockGenerateDifferencekravPdf: vi.fn(),
  mockGenerateErstatningsopgoerelsePdf: vi.fn(),
  mockGenerateTafFordeltPaaAarPdf: vi.fn(),
  mockGenerateVarigeMenPdf: vi.fn(),
  mockGenerateAarsloenPdf: vi.fn(),
  mockGenerateSHDagePdf: vi.fn(),
  mockEoSnapshotToEoPdfDocument: vi.fn(),
  mockEoSnapshotToTafPerYearPdfDocument: vi.fn(),
}));

vi.mock('../../../utils/pdf/pdfLoader', () => ({
  loadSatserPdfModule: vi.fn(async () => ({ generateSatserPdf: mockGenerateSatserPdf })),
  loadRentePdfModule: vi.fn(async () => ({ generateRentePdf: mockGenerateRentePdf })),
  loadReguleringPdfModule: vi.fn(async () => ({ generateReguleringPdf: mockGenerateReguleringPdf })),
  loadKRLPdfModule: vi.fn(async () => ({ generateKRLPdf: mockGenerateKRLPdf })),
  loadLoebendeYdelserPdfModule: vi.fn(async () => ({ generateLoebendeYdelserPdf: mockGenerateLoebendeYdelserPdf })),
  loadKapitaliseringPdfModule: vi.fn(async () => ({ generateKapitaliseringPdf: mockGenerateKapitaliseringPdf })),
  loadEfterEalPdfModule: vi.fn(async () => ({ generateEfterEalPdf: mockGenerateEfterEalPdf })),
  loadDifferencekravPdfModule: vi.fn(async () => ({ generateDifferencekravPdf: mockGenerateDifferencekravPdf })),
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

vi.mock('../../../domain/erstatningsopgoerelse/eoSnapshotToEoPdfDocument', () => ({
  eoSnapshotToEoPdfDocument: mockEoSnapshotToEoPdfDocument,
}));

vi.mock('../../../domain/erstatningsopgoerelse/eoSnapshotToTafPerYearPdfDocument', () => ({
  eoSnapshotToTafPerYearPdfDocument: mockEoSnapshotToTafPerYearPdfDocument,
}));

import {
  downloadSatserPdf,
  downloadRentePdf,
  downloadReguleringPdf,
  downloadKrlPdf,
  downloadLoebendeYdelserPdf,
  downloadKapitaliseringPdf,
  downloadEfterEalPdf,
  downloadDifferencekravPdf,
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
const eoSnapshot = { revision: 'rev-1' } as never;

beforeEach(() => {
  mockGenerateSatserPdf.mockReset();
  mockGenerateRentePdf.mockReset();
  mockGenerateReguleringPdf.mockReset();
  mockGenerateKRLPdf.mockReset();
  mockGenerateLoebendeYdelserPdf.mockReset();
  mockGenerateKapitaliseringPdf.mockReset();
  mockGenerateEfterEalPdf.mockReset();
  mockGenerateDifferencekravPdf.mockReset();
  mockGenerateErstatningsopgoerelsePdf.mockReset();
  mockGenerateTafFordeltPaaAarPdf.mockReset();
  mockGenerateVarigeMenPdf.mockReset();
  mockGenerateAarsloenPdf.mockReset();
  mockGenerateSHDagePdf.mockReset();
  mockEoSnapshotToEoPdfDocument.mockReset();
  mockEoSnapshotToTafPerYearPdfDocument.mockReset();
  mockEoSnapshotToEoPdfDocument.mockReturnValue({
    kind: 'ok',
    document: { titel: 'EO dokument' },
  });
  mockEoSnapshotToTafPerYearPdfDocument.mockReturnValue({
    kind: 'ok',
    document: { model: { titel: 'TAF dokument' }, presentation: null },
  });
});

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

// ─── EET-PDF downloads ───────────────────────────────────────────────────────

describe('EET PDF downloads', () => {
  it('videresender løbende-yddelser computation uændret til generatoren', async () => {
    const computation = { beregningsdato: '2026-01-14', afgoerelser: [] } as never;

    const result = await downloadLoebendeYdelserPdf({
      computation,
      visUdvidetSpecifikation: true,
      settings,
      persistedStamdata: stamdata,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateLoebendeYdelserPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        computation,
        visUdvidetSpecifikation: true,
      })
    );
  });

  it('videresender kapitalisering-computation uændret til generatoren', async () => {
    const computation = { afgoerelser: [] } as never;

    const result = await downloadKapitaliseringPdf({
      computation,
      koen: 'Mand',
      settings,
      persistedStamdata: stamdata,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateKapitaliseringPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        computation,
        koen: 'Mand',
      })
    );
  });

  it('videresender EET efter EAL-computation uændret til generatoren', async () => {
    const computation = { beregningsdato: '2026-01-15', ealKrav: 123 } as never;

    const result = await downloadEfterEalPdf({
      computation,
      settings,
      persistedStamdata: stamdata,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateEfterEalPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        computation,
      })
    );
  });

  it('videresender differencekrav-computation uændret til generatoren, inklusive løbende bilag med dagen-før-beregningsdato', async () => {
    const computation = {
      beregningsdato: '2026-01-15',
      dagFoerBeregningsdato: '2026-01-14',
      loebendeComputation: { beregningsdato: '2026-01-14', afgoerelser: [] },
    } as never;
    const bilagSelection = {
      loebendeYdelser: true,
      kapitalisering: false,
      eetEfterEal: false,
      proformaKapitalisering: false,
      visUdvidetSpecifikationLoebendeYdelserBilag: false,
    } as const;

    const result = await downloadDifferencekravPdf({
      computation,
      koen: 'Mand',
      bilagSelection,
      settings,
      persistedStamdata: stamdata,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateDifferencekravPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        computation,
        bilagSelection,
      })
    );
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
      snapshot: eoSnapshot,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateErstatningsopgoerelsePdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateErstatningsopgoerelsePdf.mockImplementationOnce(() => { throw new Error('EO fejl'); });
    const result = await downloadErstatningsopgoerelsePdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
      snapshot: eoSnapshot,
    });
    expect(result).toMatchObject({ success: false, error: 'Kunne ikke generere erstatningsopgørelse-PDF' });
  });

  it('returnerer success=false når det givne snapshot blokerer EO-PDF', async () => {
    mockEoSnapshotToEoPdfDocument.mockReturnValue({
      kind: 'blocked',
      message: 'EO-PDF er blokeret af snapshot-kontroller.',
      invariants: [],
    });

    const result = await downloadErstatningsopgoerelsePdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
      snapshot: eoSnapshot,
    });

    expect(result).toEqual({ success: false, error: 'EO-PDF er blokeret af snapshot-kontroller.' });
    expect(mockGenerateErstatningsopgoerelsePdf).not.toHaveBeenCalled();
  });

  it('sender projekteret EO-dokument videre til generatoren når snapshot er gyldigt', async () => {
    const projectedDocument = { titel: 'Testdokument' };
    mockEoSnapshotToEoPdfDocument.mockReturnValue({
      kind: 'ok',
      document: projectedDocument,
    });

    const result = await downloadErstatningsopgoerelsePdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
      snapshot: eoSnapshot,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateErstatningsopgoerelsePdf).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ document: projectedDocument })
    );
  });
});

// ─── downloadTafFordeltPaaAarPdf ──────────────────────────────────────────────

describe('downloadTafFordeltPaaAarPdf', () => {
  it('returnerer success=true ved gyldigt payload', async () => {
    const result = await downloadTafFordeltPaaAarPdf({
      stamdataValues: stamdata,
      eoValues,
      settings,
      snapshot: eoSnapshot,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateTafFordeltPaaAarPdf).toHaveBeenCalled();
  });

  it('returnerer success=false når det givne snapshot blokerer TAF-PDF', async () => {
    mockEoSnapshotToTafPerYearPdfDocument.mockReturnValue({
      kind: 'blocked',
      message: 'TAF fordelt på år er blokeret af snapshot-kontroller.',
      invariants: [],
    });

    const result = await downloadTafFordeltPaaAarPdf({
      stamdataValues: stamdata,
      eoValues,
      settings,
      snapshot: eoSnapshot,
    });

    expect(result).toEqual({ success: false, error: 'TAF fordelt på år er blokeret af snapshot-kontroller.' });
    expect(mockGenerateTafFordeltPaaAarPdf).not.toHaveBeenCalled();
  });

  it('sender projekteret TAF-dokument videre til generatoren når snapshot er gyldigt', async () => {
    const projectedDocument = { model: { titel: 'TAF' }, presentation: null };
    mockEoSnapshotToTafPerYearPdfDocument.mockReturnValue({
      kind: 'ok',
      document: projectedDocument,
    });

    const result = await downloadTafFordeltPaaAarPdf({
      stamdataValues: stamdata,
      eoValues,
      settings,
      snapshot: eoSnapshot,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateTafFordeltPaaAarPdf).toHaveBeenCalledWith(
      expect.objectContaining({ document: projectedDocument })
    );
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
