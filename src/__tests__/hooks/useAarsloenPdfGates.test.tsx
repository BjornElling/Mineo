// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { useAarsloenPdfGates } from '../../hooks/useAarsloenPdfGates';
import type { StandardLoenTableHandle } from '../../types/handles';
import type { AarsloenValues } from '../../schemas/formSchemas';
import type { PeriodeResult } from '../../utils/periodeBeregning';

// ─── Logger mock ──────────────────────────────────────────────────────────────

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  logInfo: vi.fn(),
}));

// ─── PDF service mock ─────────────────────────────────────────────────────────

const { downloadAarsloenPdfMock, downloadSHDagePdfMock } = vi.hoisted(() => ({
  downloadAarsloenPdfMock: vi.fn(async () => ({ success: true as const })),
  downloadSHDagePdfMock: vi.fn(async () => ({ success: true as const })),
}));

vi.mock('../../pdf/infrastructure/pdfService', () => ({
  downloadAarsloenPdf: downloadAarsloenPdfMock,
  downloadSHDagePdf: downloadSHDagePdfMock,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';

const makeBaseProps = (overrides: Partial<Parameters<typeof useAarsloenPdfGates>[0]> = {}) => ({
  values: {
    tableData: [],
    loenperiode: 'maaned',
    feriePct: 12.5,
    fritvalgPct: 1,
    shSoPct: 0.45,
    storeBededagPct: 0,
    pensionPct: 0,
    fuldLoenUnderFerie: true,
    retTilSjetteFerieuge: false,
    antalFeriedage: undefined,
    loenPaaHelligdage: 'Grundloen',
  } as unknown as AarsloenValues,
  omregningAktiveret: false,
  periodeData: null,
  shDageAntal: null,
  beregnetAarsloen: 0,
  beregningsData: { metode: 'ingen' as const, erEtAar: false },
  harFatalBeregningsFejl: false,
  tabelRef: React.createRef<StandardLoenTableHandle | null>(),
  persistedStamdata: null,
  settings: DEFAULT_APP_SETTINGS,
  ...overrides,
});

type CapturedHook = {
  canDownloadPdf: boolean;
  canDownloadSHDagePdf: boolean;
  handleAarsloenPdfDownload: (() => Promise<void>) | null;
  downloadShake: boolean;
};

// Én render-instans pr. test, så gates og actions altid kommer fra samme hook-state.
// Før konsolideringen havde vi to parallelle renderers (renderGates/renderActions), hvilket
// kunne maskere sync-problemer mellem gate-udledning og action-logik.
const renderHook = (props: ReturnType<typeof makeBaseProps>): CapturedHook => {
  const captured: CapturedHook = {
    canDownloadPdf: false,
    canDownloadSHDagePdf: false,
    handleAarsloenPdfDownload: null,
    downloadShake: false,
  };

  const Comp = () => {
    const result = useAarsloenPdfGates(props);
    captured.canDownloadPdf = result.canDownloadPdf;
    captured.canDownloadSHDagePdf = result.canDownloadSHDagePdf;
    captured.handleAarsloenPdfDownload = result.handleAarsloenPdfDownload;
    captured.downloadShake = result.downloadShake;
    return null;
  };

  render(<Comp />);
  return captured;
};

beforeEach(() => {
  downloadAarsloenPdfMock.mockReset();
  downloadSHDagePdfMock.mockReset();
  downloadAarsloenPdfMock.mockImplementation(async () => ({ success: true as const }));
  downloadSHDagePdfMock.mockImplementation(async () => ({ success: true as const }));
});

// ─── canDownloadPdf (getPdfEligibility) ──────────────────────────────────────

describe('useAarsloenPdfGates — canDownloadPdf', () => {
  it('er false når tableData er tom', () => {
    const { canDownloadPdf } = renderHook(makeBaseProps());
    expect(canDownloadPdf).toBe(false);
  });

  it('er false ved fatale beregningsfejl selv med data', () => {
    const { canDownloadPdf } = renderHook(makeBaseProps({
      harFatalBeregningsFejl: true,
      values: {
        ...makeBaseProps().values,
        tableData: [{ id: 'r1', col0_maaned: '2024-01-01', col1_maaned: '2024-06-30', col2: '50000' } as never],
      },
    }));
    expect(canDownloadPdf).toBe(false);
  });

  it('er false når omregningAktiveret=true men periodeData=null', () => {
    const { canDownloadPdf } = renderHook(makeBaseProps({
      omregningAktiveret: true,
      periodeData: null,
      values: {
        ...makeBaseProps().values,
        tableData: [{ id: 'r1', col0_maaned: '2024-01-01', col1_maaned: '2024-06-30', col2: '50000' } as never],
      },
    }));
    expect(canDownloadPdf).toBe(false);
  });
});

// ─── canDownloadSHDagePdf ─────────────────────────────────────────────────────

describe('useAarsloenPdfGates — canDownloadSHDagePdf', () => {
  const mockPeriodeData = {
    perioder: [],
    datoSet: new Set<string>(),
  } as unknown as PeriodeResult;

  it('er false når periodeData=null', () => {
    const { canDownloadSHDagePdf } = renderHook(makeBaseProps({
      periodeData: null,
      shDageAntal: 5,
    }));
    expect(canDownloadSHDagePdf).toBe(false);
  });

  it('er false når shDageAntal=null', () => {
    const { canDownloadSHDagePdf } = renderHook(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: null,
    }));
    expect(canDownloadSHDagePdf).toBe(false);
  });

  it('er false når shDageAntal=0 (ingen SH-dage at vise)', () => {
    const { canDownloadSHDagePdf } = renderHook(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: 0,
    }));
    expect(canDownloadSHDagePdf).toBe(false);
  });

  it('er true når periodeData er sat og shDageAntal>0', () => {
    const { canDownloadSHDagePdf } = renderHook(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: 3,
    }));
    expect(canDownloadSHDagePdf).toBe(true);
  });
});

describe('useAarsloenPdfGates — runtime PDF-fejl', () => {
  it('trigger ikke shake ved teknisk PDF-fejl, så den centrale fejlvisning kan tage over', async () => {
    downloadAarsloenPdfMock.mockResolvedValueOnce({
      success: false as const,
      error: 'Udviklingsserveren svarer ikke længere.',
    });

    const baseValues = makeBaseProps().values;
    const captured = renderHook(makeBaseProps({
      values: {
        ...baseValues,
        tableData: [{ id: 'r1', col0_maaned: '2024-01-01', col1_maaned: '2024-06-30', col2: '50000' } as never],
      },
    }));

    await act(async () => {
      await captured.handleAarsloenPdfDownload?.();
    });

    expect(captured.downloadShake).toBe(false);
  });
});
