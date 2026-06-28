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

// ─── Mocks til loadXxxDocumentModule-funktionerne ──────────────────────────────────

const {
  mockReportSystemIssue,
  mockLoadSatserPdfModule,
  mockLoadRentePdfModule,
  mockLoadReguleringPdfModule,
  mockLoadKRLPdfModule,
  mockLoadKlLoenaftalerPdfModule,
  mockLoadLoebendeYdelserPdfModule,
  mockLoadKapitaliseringPdfModule,
  mockLoadEfterEalPdfModule,
  mockLoadDifferencekravPdfModule,
  mockLoadErstatningsopgoerelsePdfModule,
  mockLoadTafFordeltPaaAarPdfModule,
  mockLoadTafKravGrafPdfModule,
  mockLoadTafOpreguleretPaaAarPdfModule,
  mockLoadVarigeMenPdfModule,
  mockLoadAarsloenPdfModule,
  mockLoadSHDagePdfModule,
  mockGenerateSatserPdf,
  mockGenerateRentePdf,
  mockGenerateReguleringPdf,
  mockGenerateKRLPdf,
  mockGenerateKlLoenaftalerPdf,
  mockGenerateLoebendeYdelserPdf,
  mockGenerateKapitaliseringPdf,
  mockGenerateEfterEalPdf,
  mockGenerateDifferencekravPdf,
  mockGenerateErstatningsopgoerelsePdf,
  mockGenerateTafFordeltPaaAarPdf,
  mockGenerateTafKravGrafPdf,
  mockGenerateTafOpreguleretPaaAarPdf,
  mockGenerateVarigeMenPdf,
  mockGenerateAarsloenPdf,
  mockGenerateSHDagePdf,
  mockEoSnapshotToEoDocument,
  mockEoSnapshotToTafPerYearDocument,
  mockEoSnapshotToTafKravGrafDocument,
  mockEoSnapshotToTafPerYearOpreguleretDocument,
} = vi.hoisted(() => ({
  mockReportSystemIssue: vi.fn(),
  mockLoadSatserPdfModule: vi.fn(),
  mockLoadRentePdfModule: vi.fn(),
  mockLoadReguleringPdfModule: vi.fn(),
  mockLoadKRLPdfModule: vi.fn(),
  mockLoadKlLoenaftalerPdfModule: vi.fn(),
  mockLoadLoebendeYdelserPdfModule: vi.fn(),
  mockLoadKapitaliseringPdfModule: vi.fn(),
  mockLoadEfterEalPdfModule: vi.fn(),
  mockLoadDifferencekravPdfModule: vi.fn(),
  mockLoadErstatningsopgoerelsePdfModule: vi.fn(),
  mockLoadTafFordeltPaaAarPdfModule: vi.fn(),
  mockLoadTafKravGrafPdfModule: vi.fn(),
  mockLoadTafOpreguleretPaaAarPdfModule: vi.fn(),
  mockLoadVarigeMenPdfModule: vi.fn(),
  mockLoadAarsloenPdfModule: vi.fn(),
  mockLoadSHDagePdfModule: vi.fn(),
  mockGenerateSatserPdf: vi.fn(),
  mockGenerateRentePdf: vi.fn(),
  mockGenerateReguleringPdf: vi.fn(),
  mockGenerateKRLPdf: vi.fn(),
  mockGenerateKlLoenaftalerPdf: vi.fn(),
  mockGenerateLoebendeYdelserPdf: vi.fn(),
  mockGenerateKapitaliseringPdf: vi.fn(),
  mockGenerateEfterEalPdf: vi.fn(),
  mockGenerateDifferencekravPdf: vi.fn(),
  mockGenerateErstatningsopgoerelsePdf: vi.fn(),
  mockGenerateTafFordeltPaaAarPdf: vi.fn(),
  mockGenerateTafKravGrafPdf: vi.fn(),
  mockGenerateTafOpreguleretPaaAarPdf: vi.fn(),
  mockGenerateVarigeMenPdf: vi.fn(),
  mockGenerateAarsloenPdf: vi.fn(),
  mockGenerateSHDagePdf: vi.fn(),
  mockEoSnapshotToEoDocument: vi.fn(),
  mockEoSnapshotToTafPerYearDocument: vi.fn(),
  mockEoSnapshotToTafKravGrafDocument: vi.fn(),
  mockEoSnapshotToTafPerYearOpreguleretDocument: vi.fn(),
}));

vi.mock('../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: mockReportSystemIssue,
}));

vi.mock('../../../document/service/documentLoader', () => ({
  loadSatserDocumentModule: mockLoadSatserPdfModule,
  loadRenteDocumentModule: mockLoadRentePdfModule,
  loadReguleringDocumentModule: mockLoadReguleringPdfModule,
  loadKRLDocumentModule: mockLoadKRLPdfModule,
  loadKlLoenaftalerDocumentModule: mockLoadKlLoenaftalerPdfModule,
  loadLoebendeYdelserDocumentModule: mockLoadLoebendeYdelserPdfModule,
  loadKapitaliseringDocumentModule: mockLoadKapitaliseringPdfModule,
  loadEfterEalDocumentModule: mockLoadEfterEalPdfModule,
  loadDifferencekravDocumentModule: mockLoadDifferencekravPdfModule,
  loadErstatningsopgoerelseDocumentModule: mockLoadErstatningsopgoerelsePdfModule,
  loadTafFordeltPaaAarDocumentModule: mockLoadTafFordeltPaaAarPdfModule,
  loadTafKravGrafDocumentModule: mockLoadTafKravGrafPdfModule,
  loadTafOpreguleretPaaAarDocumentModule: mockLoadTafOpreguleretPaaAarPdfModule,
  loadVarigeMenDocumentModule: mockLoadVarigeMenPdfModule,
  loadAarsloenDocumentModule: mockLoadAarsloenPdfModule,
  loadSHDageDocumentModule: mockLoadSHDagePdfModule,
}));

vi.mock('../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument', () => ({
  eoSnapshotToEoDocument: mockEoSnapshotToEoDocument,
}));

vi.mock('../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearDocument', () => ({
  eoSnapshotToTafPerYearDocument: mockEoSnapshotToTafPerYearDocument,
}));

vi.mock('../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument', () => ({
  eoSnapshotToTafKravGrafDocument: mockEoSnapshotToTafKravGrafDocument,
}));

vi.mock('../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretDocument', () => ({
  eoSnapshotToTafPerYearOpreguleretDocument: mockEoSnapshotToTafPerYearOpreguleretDocument,
}));

import { toISODateString } from '../../../types/branded';
import {
  downloadSatserDokument,
  downloadRenteDokument,
  downloadReguleringDokument,
  downloadKrlDokument,
  downloadKlLoenaftalerDokument,
  downloadLoebendeYdelserDokument,
  downloadKapitaliseringDokument,
  downloadEfterEalDokument,
  downloadDifferencekravDokument,
  downloadErstatningsopgoerelseDokument,
  downloadTafFordeltPaaAarDokument,
  downloadTafKravGrafDokument,
  downloadTafOpreguleretPaaAarDokument,
  downloadVarigeMenDokument,
  downloadAarsloenDokument,
  downloadSHDageDokument,
  resetPdfServiceDevServerStateForTests,
} from '../../../document/service/documentService';

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
  mockLoadKlLoenaftalerPdfModule.mockReset();
  mockLoadLoebendeYdelserPdfModule.mockReset();
  mockLoadKapitaliseringPdfModule.mockReset();
  mockLoadEfterEalPdfModule.mockReset();
  mockLoadDifferencekravPdfModule.mockReset();
  mockLoadErstatningsopgoerelsePdfModule.mockReset();
  mockLoadTafFordeltPaaAarPdfModule.mockReset();
  mockLoadTafKravGrafPdfModule.mockReset();
  mockLoadTafOpreguleretPaaAarPdfModule.mockReset();
  mockLoadVarigeMenPdfModule.mockReset();
  mockLoadAarsloenPdfModule.mockReset();
  mockLoadSHDagePdfModule.mockReset();
  mockGenerateSatserPdf.mockReset();
  mockGenerateRentePdf.mockReset();
  mockGenerateReguleringPdf.mockReset();
  mockGenerateKRLPdf.mockReset();
  mockGenerateKlLoenaftalerPdf.mockReset();
  mockGenerateLoebendeYdelserPdf.mockReset();
  mockGenerateKapitaliseringPdf.mockReset();
  mockGenerateEfterEalPdf.mockReset();
  mockGenerateDifferencekravPdf.mockReset();
  mockGenerateErstatningsopgoerelsePdf.mockReset();
  mockGenerateTafFordeltPaaAarPdf.mockReset();
  mockGenerateTafKravGrafPdf.mockReset();
  mockGenerateTafOpreguleretPaaAarPdf.mockReset();
  mockGenerateVarigeMenPdf.mockReset();
  mockGenerateAarsloenPdf.mockReset();
  mockGenerateSHDagePdf.mockReset();
  mockEoSnapshotToEoDocument.mockReset();
  mockEoSnapshotToTafPerYearDocument.mockReset();
  mockEoSnapshotToTafKravGrafDocument.mockReset();
  mockEoSnapshotToTafPerYearOpreguleretDocument.mockReset();
  mockLoadSatserPdfModule.mockImplementation(async () => ({ generateSatserDocument: mockGenerateSatserPdf }));
  mockLoadRentePdfModule.mockImplementation(async () => ({ generateRenteDocument: mockGenerateRentePdf }));
  mockLoadReguleringPdfModule.mockImplementation(async () => ({ generateReguleringDocument: mockGenerateReguleringPdf }));
  mockLoadKRLPdfModule.mockImplementation(async () => ({ generateKRLDocument: mockGenerateKRLPdf }));
  mockLoadKlLoenaftalerPdfModule.mockImplementation(async () => ({ generateKlLoenaftalerDocument: mockGenerateKlLoenaftalerPdf }));
  mockLoadLoebendeYdelserPdfModule.mockImplementation(async () => ({ generateLoebendeYdelserDocument: mockGenerateLoebendeYdelserPdf }));
  mockLoadKapitaliseringPdfModule.mockImplementation(async () => ({ generateKapitaliseringDocument: mockGenerateKapitaliseringPdf }));
  mockLoadEfterEalPdfModule.mockImplementation(async () => ({ generateEfterEalDocument: mockGenerateEfterEalPdf }));
  mockLoadDifferencekravPdfModule.mockImplementation(async () => ({ generateDifferencekravDocument: mockGenerateDifferencekravPdf }));
  mockLoadErstatningsopgoerelsePdfModule.mockImplementation(async () => ({
    generateErstatningsopgoerelseDocument: mockGenerateErstatningsopgoerelsePdf,
  }));
  mockLoadTafFordeltPaaAarPdfModule.mockImplementation(async () => ({
    generateTafFordeltPaaAarDocument: mockGenerateTafFordeltPaaAarPdf,
  }));
  mockLoadTafKravGrafPdfModule.mockImplementation(async () => ({
    generateTafKravGrafDocument: mockGenerateTafKravGrafPdf,
  }));
  mockLoadTafOpreguleretPaaAarPdfModule.mockImplementation(async () => ({
    generateTafOpreguleretPaaAarDocument: mockGenerateTafOpreguleretPaaAarPdf,
  }));
  mockLoadVarigeMenPdfModule.mockImplementation(async () => ({ generateVarigeMenDocument: mockGenerateVarigeMenPdf }));
  mockLoadAarsloenPdfModule.mockImplementation(async () => ({ generateAarsloenDocument: mockGenerateAarsloenPdf }));
  mockLoadSHDagePdfModule.mockImplementation(async () => ({ generateSHDageDocument: mockGenerateSHDagePdf }));
  mockEoSnapshotToEoDocument.mockReturnValue({
    kind: 'ok',
    document: { titel: 'EO dokument' },
  });
  mockEoSnapshotToTafPerYearDocument.mockReturnValue({
    kind: 'ok',
    document: { model: { titel: 'TAF dokument' }, presentation: null },
  });
  mockEoSnapshotToTafKravGrafDocument.mockReturnValue({
    kind: 'ok',
    document: { model: { titel: 'TAF graf dokument' }, unit: 'maaned', series: [], timeWindows: [], beregningsperiode: null, skadeMarker: null },
  });
  mockEoSnapshotToTafPerYearOpreguleretDocument.mockReturnValue({
    kind: 'ok',
    document: { model: { titel: 'TAF opreguleret dokument' }, presentation: null, opreguleret: null },
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── downloadSatserDokument ────────────────────────────────────────────────────────

describe('downloadSatserDokument', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadSatserDokument({
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
    const result = await downloadSatserDokument({
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

// ─── downloadRenteDokument ─────────────────────────────────────────────────────────

describe('downloadRenteDokument', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadRenteDokument({
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
    const result = await downloadRenteDokument({
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


// ─── downloadReguleringDokument ────────────────────────────────────────────────────

describe('downloadReguleringDokument', () => {
  const validInterval = { fraDato: toISODateString('2024-01-01'), tilDato: toISODateString('2024-12-31') };

  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadReguleringDokument({
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
    const result = await downloadReguleringDokument({
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

// ─── downloadKrlDokument ───────────────────────────────────────────────────────────

describe('downloadKrlDokument', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadKrlDokument({ settings, persistedStamdata: null });
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
    const result = await downloadKrlDokument({ settings: settingsWithReguleringBrevhoved, persistedStamdata: stamdata });
    expect(result.success).toBe(true);

    const lastCall = mockGenerateKRLPdf.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({ visBrevhoved: true });
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateKRLPdf.mockImplementationOnce(() => { throw new Error('KRL fejl'); });
    const result = await downloadKrlDokument({ settings, persistedStamdata: null });
    expect(result.success).toBe(false);
  });
});

// ─── downloadKlLoenaftalerDokument ───────────────────────────────────────────────────────────

describe('downloadKlLoenaftalerDokument', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadKlLoenaftalerDokument({ settings, persistedStamdata: null });
    expect(result.success).toBe(true);
    expect(mockGenerateKlLoenaftalerPdf).toHaveBeenCalled();
  });

  it('arver brevhoved-indstilling 1-til-1 fra regulering', async () => {
    const settingsWithReguleringBrevhoved = {
      ...DEFAULT_APP_SETTINGS,
      brevhovedIndstillinger: {
        ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger,
        regulering: true,
      },
    };
    const result = await downloadKlLoenaftalerDokument({ settings: settingsWithReguleringBrevhoved, persistedStamdata: stamdata });
    expect(result.success).toBe(true);

    const lastCall = mockGenerateKlLoenaftalerPdf.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({ visBrevhoved: true });
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateKlLoenaftalerPdf.mockImplementationOnce(() => { throw new Error('KL-lønaftaler fejl'); });
    const result = await downloadKlLoenaftalerDokument({ settings, persistedStamdata: null });
    expect(result.success).toBe(false);
  });
});

// ─── EET-PDF downloads ───────────────────────────────────────────────────────

describe('EET PDF downloads', () => {
  it('videresender løbende-yddelser computation uændret til generatoren', async () => {
    const computation = { beregningsdato: toISODateString('2026-01-14'), afgoerelser: [] } as never;

    const result = await downloadLoebendeYdelserDokument({
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

    const result = await downloadKapitaliseringDokument({
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

    const result = await downloadEfterEalDokument({
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

    const result = await downloadDifferencekravDokument({
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

// ─── downloadErstatningsopgoerelseDokument ────────────────────────────────────────

describe('downloadErstatningsopgoerelseDokument', () => {
  it('returnerer success=true ved gyldigt payload', async () => {
    const result = await downloadErstatningsopgoerelseDokument({
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
    const result = await downloadErstatningsopgoerelseDokument({
      stamdataValues: stamdata,
      eoValues,
      selectedElements: {} as never,
      settings,
      snapshot: eoSnapshot,
    });
    expect(result).toMatchObject({ success: false, error: 'Kunne ikke generere erstatningsopgørelse-PDF' });
  });

  it('returnerer success=false når det givne snapshot blokerer EO-PDF', async () => {
    mockEoSnapshotToEoDocument.mockReturnValue({
      kind: 'blocked',
      message: 'EO-PDF er blokeret af snapshot-kontroller.',
      invariants: [],
    });

    const result = await downloadErstatningsopgoerelseDokument({
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
    mockEoSnapshotToEoDocument.mockReturnValue({
      kind: 'blocked',
      message: 'EO-PDF kan ikke genereres for den aktuelle sag.',
      invariants: [],
    });

    const result = await downloadErstatningsopgoerelseDokument({
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
    mockEoSnapshotToEoDocument.mockReturnValue({
      kind: 'ok',
      document: projectedDocument,
    });

    const result = await downloadErstatningsopgoerelseDokument({
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

    await downloadErstatningsopgoerelseDokument({
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

// ─── downloadTafFordeltPaaAarDokument ──────────────────────────────────────────────

describe('downloadTafFordeltPaaAarDokument', () => {
  it('returnerer success=true ved gyldigt payload', async () => {
    const result = await downloadTafFordeltPaaAarDokument({
      stamdataValues: stamdata,
      eoValues,
      settings,
      snapshot: eoSnapshot,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateTafFordeltPaaAarPdf).toHaveBeenCalled();
  });

  it('returnerer success=false når det givne snapshot blokerer TAF-PDF', async () => {
    mockEoSnapshotToTafPerYearDocument.mockReturnValue({
      kind: 'blocked',
      message: 'TAF fordelt på år er blokeret af snapshot-kontroller.',
      invariants: [],
    });

    const result = await downloadTafFordeltPaaAarDokument({
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
    mockEoSnapshotToTafPerYearDocument.mockReturnValue({
      kind: 'ok',
      document: projectedDocument,
    });

    const result = await downloadTafFordeltPaaAarDokument({
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

// ─── downloadTafKravGrafDokument ──────────────────────────────────────────────────

describe('downloadTafKravGrafDokument', () => {
  it('returnerer success=true ved gyldigt payload', async () => {
    const result = await downloadTafKravGrafDokument({
      eoValues,
      settings,
      snapshot: eoSnapshot,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateTafKravGrafPdf).toHaveBeenCalled();
  });

  it('returnerer success=false når det givne snapshot blokerer TAF-grafen', async () => {
    mockEoSnapshotToTafKravGrafDocument.mockReturnValue({
      kind: 'blocked',
      message: 'Visuel graf over indtægtsniveau er blokeret af snapshot-kontroller.',
      invariants: [],
    });

    const result = await downloadTafKravGrafDokument({
      eoValues,
      settings,
      snapshot: eoSnapshot,
    });

    expect(result).toEqual({ success: false, error: 'Visuel graf over indtægtsniveau er blokeret af snapshot-kontroller.' });
    expect(mockGenerateTafKravGrafPdf).not.toHaveBeenCalled();
  });

  it('sender projekteret TAF-grafdokument videre til generatoren når snapshot er gyldigt', async () => {
    const projectedDocument = { model: { titel: 'TAF graf' }, unit: 'maaned', series: [], timeWindows: [], beregningsperiode: null, skadeMarker: null };
    mockEoSnapshotToTafKravGrafDocument.mockReturnValue({
      kind: 'ok',
      document: projectedDocument,
    });

    const result = await downloadTafKravGrafDokument({
      eoValues,
      settings,
      snapshot: eoSnapshot,
    });

    expect(result.success).toBe(true);
    expect(mockGenerateTafKravGrafPdf).toHaveBeenCalledWith(
      expect.objectContaining({ document: projectedDocument })
    );
  });
});

// ─── downloadTafOpreguleretPaaAarDokument ──────────────────────────────────────────

describe('downloadTafOpreguleretPaaAarDokument', () => {
  it('returnerer success=true ved gyldigt payload', async () => {
    const result = await downloadTafOpreguleretPaaAarDokument({
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
    mockEoSnapshotToTafPerYearOpreguleretDocument.mockReturnValue({
      kind: 'blocked',
      message: 'TAF opreguleret til beregningsåret er blokeret af snapshot-kontroller.',
      invariants: [],
    });

    const result = await downloadTafOpreguleretPaaAarDokument({
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
    mockEoSnapshotToTafPerYearOpreguleretDocument.mockReturnValue({
      kind: 'ok',
      document: projectedDocument,
    });

    const result = await downloadTafOpreguleretPaaAarDokument({
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
    const result = await downloadTafOpreguleretPaaAarDokument({
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
        context: 'pdfService.downloadTafOpreguleretPaaAarDokument',
      })
    );
  });
});

// ─── downloadVarigeMenDokument ─────────────────────────────────────────────────────

describe('downloadVarigeMenDokument', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadVarigeMenDokument({
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
    const result = await downloadVarigeMenDokument({
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

// ─── downloadAarsloenDokument ──────────────────────────────────────────────────────

describe('downloadAarsloenDokument', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadAarsloenDokument({
      input: {} as never,
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateAarsloenPdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateAarsloenPdf.mockImplementationOnce(() => { throw new Error('ASL fejl'); });
    const result = await downloadAarsloenDokument({
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

    const result = await downloadAarsloenDokument({
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

    const result = await downloadAarsloenDokument({
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
        context: 'pdfService.downloadAarsloenDokument',
        diagnostics: expect.objectContaining({
          check: 'post_failure',
        }),
      })
    );
    expect(mockLoadAarsloenPdfModule).toHaveBeenCalledTimes(1);

    const secondResult = await downloadAarsloenDokument({
      input: {} as never,
      settings,
      persistedStamdata: null,
    });

    expect(secondResult).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(mockReportSystemIssue).toHaveBeenCalledTimes(1);
  });
});

// ─── downloadSHDageDokument ────────────────────────────────────────────────────────

describe('downloadSHDageDokument', () => {
  it('returnerer success=true og kalder generator', async () => {
    const result = await downloadSHDageDokument({
      perioder: [],
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(true);
    expect(mockGenerateSHDagePdf).toHaveBeenCalled();
  });

  it('returnerer success=false ved generator-fejl', async () => {
    mockGenerateSHDagePdf.mockImplementationOnce(() => { throw new Error('SH fejl'); });
    const result = await downloadSHDageDokument({
      perioder: [],
      settings,
      persistedStamdata: null,
    });
    expect(result.success).toBe(false);
  });
});
