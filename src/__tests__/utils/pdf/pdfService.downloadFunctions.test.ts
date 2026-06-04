/// <reference types="vitest/globals" />

import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
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
  mockReportSystemIssue,
  mockLoadSatserPdfModule,
  mockLoadRentePdfModule,
  mockLoadReguleringPdfModule,
  mockLoadKRLPdfModule,
  mockLoadLoebendeYdelserPdfModule,
  mockLoadKapitaliseringPdfModule,
  mockLoadEfterEalPdfModule,
  mockLoadDifferencekravPdfModule,
  mockLoadErstatningsopgoerelsePdfModule,
  mockLoadTafFordeltPaaAarPdfModule,
  mockLoadTafOpreguleretPaaAarPdfModule,
  mockLoadVarigeMenPdfModule,
  mockLoadAarsloenPdfModule,
  mockLoadSHDagePdfModule,
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
  mockGenerateTafOpreguleretPaaAarPdf,
  mockGenerateVarigeMenPdf,
  mockGenerateAarsloenPdf,
  mockGenerateSHDagePdf,
  mockEoSnapshotToEoPdfDocument,
  mockEoSnapshotToTafPerYearPdfDocument,
  mockEoSnapshotToTafPerYearOpreguleretPdfDocument,
} = vi.hoisted(() => ({
  mockReportSystemIssue: vi.fn(),
  mockLoadSatserPdfModule: vi.fn(),
  mockLoadRentePdfModule: vi.fn(),
  mockLoadReguleringPdfModule: vi.fn(),
  mockLoadKRLPdfModule: vi.fn(),
  mockLoadLoebendeYdelserPdfModule: vi.fn(),
  mockLoadKapitaliseringPdfModule: vi.fn(),
  mockLoadEfterEalPdfModule: vi.fn(),
  mockLoadDifferencekravPdfModule: vi.fn(),
  mockLoadErstatningsopgoerelsePdfModule: vi.fn(),
  mockLoadTafFordeltPaaAarPdfModule: vi.fn(),
  mockLoadTafOpreguleretPaaAarPdfModule: vi.fn(),
  mockLoadVarigeMenPdfModule: vi.fn(),
  mockLoadAarsloenPdfModule: vi.fn(),
  mockLoadSHDagePdfModule: vi.fn(),
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
  mockGenerateTafOpreguleretPaaAarPdf: vi.fn(),
  mockGenerateVarigeMenPdf: vi.fn(),
  mockGenerateAarsloenPdf: vi.fn(),
  mockGenerateSHDagePdf: vi.fn(),
  mockEoSnapshotToEoPdfDocument: vi.fn(),
  mockEoSnapshotToTafPerYearPdfDocument: vi.fn(),
  mockEoSnapshotToTafPerYearOpreguleretPdfDocument: vi.fn(),
}));

vi.mock('../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: mockReportSystemIssue,
}));

vi.mock('../../../pdf/infrastructure/pdfLoader', () => ({
  loadSatserPdfModule: mockLoadSatserPdfModule,
  loadRentePdfModule: mockLoadRentePdfModule,
  loadReguleringPdfModule: mockLoadReguleringPdfModule,
  loadKRLPdfModule: mockLoadKRLPdfModule,
  loadLoebendeYdelserPdfModule: mockLoadLoebendeYdelserPdfModule,
  loadKapitaliseringPdfModule: mockLoadKapitaliseringPdfModule,
  loadEfterEalPdfModule: mockLoadEfterEalPdfModule,
  loadDifferencekravPdfModule: mockLoadDifferencekravPdfModule,
  loadErstatningsopgoerelsePdfModule: mockLoadErstatningsopgoerelsePdfModule,
  loadTafFordeltPaaAarPdfModule: mockLoadTafFordeltPaaAarPdfModule,
  loadTafOpreguleretPaaAarPdfModule: mockLoadTafOpreguleretPaaAarPdfModule,
  loadVarigeMenPdfModule: mockLoadVarigeMenPdfModule,
  loadAarsloenPdfModule: mockLoadAarsloenPdfModule,
  loadSHDagePdfModule: mockLoadSHDagePdfModule,
}));

vi.mock('../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoPdfDocument', () => ({
  eoSnapshotToEoPdfDocument: mockEoSnapshotToEoPdfDocument,
}));

vi.mock('../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearPdfDocument', () => ({
  eoSnapshotToTafPerYearPdfDocument: mockEoSnapshotToTafPerYearPdfDocument,
}));

vi.mock('../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretPdfDocument', () => ({
  eoSnapshotToTafPerYearOpreguleretPdfDocument: mockEoSnapshotToTafPerYearOpreguleretPdfDocument,
}));

import { toISODateString } from '../../../types/branded';
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
  downloadTafOpreguleretPaaAarPdf,
  downloadVarigeMenPdf,
  downloadAarsloenPdf,
  downloadSHDagePdf,
  resetPdfServiceDevServerStateForTests,
} from '../../../pdf/infrastructure/pdfService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const settings = DEFAULT_APP_SETTINGS;
const stamdata = STAMDATA_INITIAL_VALUES;
const eoValues = createErstatningsopgoerelseInitialValues();
const eoSnapshot = { revision: 'rev-1' } as never;

beforeEach(() => {
  resetPdfServiceDevServerStateForTests();
  mockReportSystemIssue.mockReset();
  mockLoadSatserPdfModule.mockReset();
  mockLoadRentePdfModule.mockReset();
  mockLoadReguleringPdfModule.mockReset();
  mockLoadKRLPdfModule.mockReset();
  mockLoadLoebendeYdelserPdfModule.mockReset();
  mockLoadKapitaliseringPdfModule.mockReset();
  mockLoadEfterEalPdfModule.mockReset();
  mockLoadDifferencekravPdfModule.mockReset();
  mockLoadErstatningsopgoerelsePdfModule.mockReset();
  mockLoadTafFordeltPaaAarPdfModule.mockReset();
  mockLoadTafOpreguleretPaaAarPdfModule.mockReset();
  mockLoadVarigeMenPdfModule.mockReset();
  mockLoadAarsloenPdfModule.mockReset();
  mockLoadSHDagePdfModule.mockReset();
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
  mockGenerateTafOpreguleretPaaAarPdf.mockReset();
  mockGenerateVarigeMenPdf.mockReset();
  mockGenerateAarsloenPdf.mockReset();
  mockGenerateSHDagePdf.mockReset();
  mockEoSnapshotToEoPdfDocument.mockReset();
  mockEoSnapshotToTafPerYearPdfDocument.mockReset();
  mockEoSnapshotToTafPerYearOpreguleretPdfDocument.mockReset();
  mockLoadSatserPdfModule.mockImplementation(async () => ({ generateSatserPdf: mockGenerateSatserPdf }));
  mockLoadRentePdfModule.mockImplementation(async () => ({ generateRentePdf: mockGenerateRentePdf }));
  mockLoadReguleringPdfModule.mockImplementation(async () => ({ generateReguleringPdf: mockGenerateReguleringPdf }));
  mockLoadKRLPdfModule.mockImplementation(async () => ({ generateKRLPdf: mockGenerateKRLPdf }));
  mockLoadLoebendeYdelserPdfModule.mockImplementation(async () => ({ generateLoebendeYdelserPdf: mockGenerateLoebendeYdelserPdf }));
  mockLoadKapitaliseringPdfModule.mockImplementation(async () => ({ generateKapitaliseringPdf: mockGenerateKapitaliseringPdf }));
  mockLoadEfterEalPdfModule.mockImplementation(async () => ({ generateEfterEalPdf: mockGenerateEfterEalPdf }));
  mockLoadDifferencekravPdfModule.mockImplementation(async () => ({ generateDifferencekravPdf: mockGenerateDifferencekravPdf }));
  mockLoadErstatningsopgoerelsePdfModule.mockImplementation(async () => ({
    generateErstatningsopgoerelsePdf: mockGenerateErstatningsopgoerelsePdf,
  }));
  mockLoadTafFordeltPaaAarPdfModule.mockImplementation(async () => ({
    generateTafFordeltPaaAarPdf: mockGenerateTafFordeltPaaAarPdf,
  }));
  mockLoadTafOpreguleretPaaAarPdfModule.mockImplementation(async () => ({
    generateTafOpreguleretPaaAarPdf: mockGenerateTafOpreguleretPaaAarPdf,
  }));
  mockLoadVarigeMenPdfModule.mockImplementation(async () => ({ generateVarigeMenPdf: mockGenerateVarigeMenPdf }));
  mockLoadAarsloenPdfModule.mockImplementation(async () => ({ generateAarsloenPdf: mockGenerateAarsloenPdf }));
  mockLoadSHDagePdfModule.mockImplementation(async () => ({ generateSHDagePdf: mockGenerateSHDagePdf }));
  mockEoSnapshotToEoPdfDocument.mockReturnValue({
    kind: 'ok',
    document: { titel: 'EO dokument' },
  });
  mockEoSnapshotToTafPerYearPdfDocument.mockReturnValue({
    kind: 'ok',
    document: { model: { titel: 'TAF dokument' }, presentation: null },
  });
  mockEoSnapshotToTafPerYearOpreguleretPdfDocument.mockReturnValue({
    kind: 'ok',
    document: { model: { titel: 'TAF opreguleret dokument' }, presentation: null, opreguleret: null },
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
});

afterEach(() => {
  vi.unstubAllGlobals();
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
      beregningsdato: toISODateString('2024-01-01'),
      periods: [],
      latestReferenceRateDate: null,
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
      beregningsdato: toISODateString('2024-01-01'),
      periods: [],
      latestReferenceRateDate: null,
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(false);
  });
});


// ─── downloadReguleringPdf ────────────────────────────────────────────────────

describe('downloadReguleringPdf', () => {
  const validInterval = { fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-12-31') };

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
    const computation = { beregningsdato: toISODateString('2026-01-14'), afgoerelser: [] } as never;

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
    const computation = { beregningsdato: toISODateString('2026-01-15'), ealKrav: 123 } as never;

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
      beregningsdato: toISODateString('2026-01-15'),
      dagFoerBeregningsdato: toISODateString('2026-01-14'),
      loebendeComputation: { beregningsdato: toISODateString('2026-01-14'), afgoerelser: [] },
    } as never;
    const bilagSelection = {
      loebendeYdelser: true,
      kapitalisering: false,
      eetEfterEal: false,
      proformaKapitalisering: false,
    merErstatningPensionsalder: false,
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

  it('tilpasser blokeret-besked til det aktive format (Word) så signalet matcher downloaden', async () => {
    mockEoSnapshotToEoPdfDocument.mockReturnValue({
      kind: 'blocked',
      message: 'EO-PDF kan ikke genereres for den aktuelle sag.',
      invariants: [],
    });

    const result = await downloadErstatningsopgoerelsePdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings: { ...DEFAULT_APP_SETTINGS, documentDownloadFormat: 'word' },
      snapshot: eoSnapshot,
    });

    expect(result).toEqual({ success: false, error: 'EO-Word kan ikke genereres for den aktuelle sag.' });
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

  it('videresender midlertidigt EET-grupper til generatoren', async () => {
    const midlertidigtEetGroups = [{
      afgoerelsesdato: toISODateString('2024-01-01'),
      rows: [{
        id: 'oy-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'midlertidigt_eet',
      }],
      perioder: [],
    }];

    await downloadErstatningsopgoerelsePdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
      snapshot: eoSnapshot,
      midlertidigtEetGroups,
    });

    expect(mockGenerateErstatningsopgoerelsePdf).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ midlertidigtEetGroups })
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

// ─── downloadTafOpreguleretPaaAarPdf ──────────────────────────────────────────

describe('downloadTafOpreguleretPaaAarPdf', () => {
  it('returnerer success=true ved gyldigt payload', async () => {
    const result = await downloadTafOpreguleretPaaAarPdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
      snapshot: eoSnapshot,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateTafOpreguleretPaaAarPdf).toHaveBeenCalled();
  });

  it('returnerer success=false når det givne snapshot blokerer den opregulerede TAF-PDF', async () => {
    mockEoSnapshotToTafPerYearOpreguleretPdfDocument.mockReturnValue({
      kind: 'blocked',
      message: 'TAF opreguleret til beregningsåret er blokeret af snapshot-kontroller.',
      invariants: [],
    });

    const result = await downloadTafOpreguleretPaaAarPdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
      snapshot: eoSnapshot,
    });

    expect(result).toEqual({ success: false, error: 'TAF opreguleret til beregningsåret er blokeret af snapshot-kontroller.' });
    expect(mockGenerateTafOpreguleretPaaAarPdf).not.toHaveBeenCalled();
  });

  it('sender projekteret opreguleret TAF-dokument videre til generatoren når snapshot er gyldigt', async () => {
    const projectedDocument = { model: { titel: 'TAF opreguleret' }, presentation: null, opreguleret: null };
    mockEoSnapshotToTafPerYearOpreguleretPdfDocument.mockReturnValue({
      kind: 'ok',
      document: projectedDocument,
    });

    const result = await downloadTafOpreguleretPaaAarPdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
      snapshot: eoSnapshot,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateTafOpreguleretPaaAarPdf).toHaveBeenCalledWith(
      expect.objectContaining({ document: projectedDocument })
    );
  });

  it('returnerer success=false og rapporterer systemfejl ved generator-fejl (fail-closed)', async () => {
    mockGenerateTafOpreguleretPaaAarPdf.mockImplementationOnce(() => { throw new Error('TAF-opreg fejl'); });
    const result = await downloadTafOpreguleretPaaAarPdf({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
      snapshot: eoSnapshot,
    });
    expect(result.success).toBe(false);
    expect(mockReportSystemIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        area: 'document',
        context: 'pdfService.downloadTafOpreguleretPaaAarPdf',
      })
    );
  });
});

// ─── downloadVarigeMenPdf ─────────────────────────────────────────────────────

describe('downloadVarigeMenPdf', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadVarigeMenPdf({
      fodselsdato: undefined,
      skadedato: undefined,
      mengrad: 0,
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
      skadedato: undefined,
      mengrad: 0,
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

  it('blokerer ikke første downloadforsøg alene fordi dev-server-ping fejler, når modulindlæsning lykkes', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadAarsloenPdf({
      input: {} as never,
      settings,
      persistedStamdata: null,
    });

    expect(result).toEqual({ success: true });
    expect(mockLoadAarsloenPdfModule).toHaveBeenCalledTimes(1);
    expect(mockReportSystemIssue).not.toHaveBeenCalled();
  });

  it('rapporterer dev-server nede særskilt efter fejlet modulindlæsning og rechecker ved næste download', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);
    mockLoadAarsloenPdfModule.mockRejectedValueOnce(
      new TypeError('Failed to fetch dynamically imported module')
    );

    const result = await downloadAarsloenPdf({
      input: {} as never,
      settings,
      persistedStamdata: null,
    });

    expect(result).toEqual({
      success: false,
      error: 'Udviklingsserveren svarer ikke længere. Genstart `npm run dev` og prøv dokument-download igen.',
    });
    expect(mockReportSystemIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'document:dev_server_unavailable',
        area: 'document',
        context: 'pdfService.downloadAarsloenPdf',
        diagnostics: expect.objectContaining({
          check: 'post_failure',
        }),
      })
    );
    expect(mockLoadAarsloenPdfModule).toHaveBeenCalledTimes(1);

    const secondResult = await downloadAarsloenPdf({
      input: {} as never,
      settings,
      persistedStamdata: null,
    });

    expect(secondResult).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(mockReportSystemIssue).toHaveBeenCalledTimes(1);
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
