// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { useAarsloenDocumentGates } from '../../hooks/useAarsloenDocumentGates';
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
  downloadAarsloenPdfMock: vi.fn(async (): Promise<{ success: true } | { success: false; error: string }> => ({ success: true })),
  downloadSHDagePdfMock: vi.fn(async () => ({ success: true as const })),
}));

vi.mock('../../document/service/documentService', () => ({
  downloadAarsloenDokument: downloadAarsloenPdfMock,
  downloadSHDageDokument: downloadSHDagePdfMock,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';
import { toISODateString } from '../../types/branded';

const makeBaseProps = (overrides: Partial<Parameters<typeof useAarsloenDocumentGates>[0]> = {}) => ({
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
  beregningsData: { metode: 'ingen' as const, erEtAar: false as const },
  harFatalBeregningsFejl: false,
  tabelRef: React.createRef<StandardLoenTableHandle | null>(),
  persistedStamdata: null,
  settings: DEFAULT_APP_SETTINGS,
  ...overrides,
});

type CapturedHook = {
  canDownloadDocument: boolean;
  canDownloadSHDageDocument: boolean;
  handleAarsloenDocumentDownload: (() => Promise<void>) | null;
  downloadShake: boolean;
};

// Én render-instans pr. test, så gates og actions altid kommer fra samme hook-state.
// Før konsolideringen havde vi to parallelle renderers (renderGates/renderActions), hvilket
// kunne maskere sync-problemer mellem gate-udledning og action-logik.
const renderHook = (props: ReturnType<typeof makeBaseProps>): CapturedHook => {
  const captured: CapturedHook = {
    canDownloadDocument: false,
    canDownloadSHDageDocument: false,
    handleAarsloenDocumentDownload: null,
    downloadShake: false,
  };

  const Comp = () => {
    const result = useAarsloenDocumentGates(props);
    captured.canDownloadDocument = result.canDownloadDocument;
    captured.canDownloadSHDageDocument = result.canDownloadSHDageDocument;
    captured.handleAarsloenDocumentDownload = result.handleAarsloenDocumentDownload;
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

// ─── canDownloadDocument (getDocumentEligibility) ──────────────────────────────────────

describe('useAarsloenDocumentGates — canDownloadDocument', () => {
  it('er false når tableData er tom', () => {
    const { canDownloadDocument } = renderHook(makeBaseProps());
    expect(canDownloadDocument).toBe(false);
  });

  it('er false ved fatale beregningsfejl selv med data', () => {
    const { canDownloadDocument } = renderHook(makeBaseProps({
      harFatalBeregningsFejl: true,
      values: {
        ...makeBaseProps().values,
        tableData: [{ id: 'r1', col0_maaned: toISODateString('2024-01-01'), col1_maaned: toISODateString('2024-06-30'), col2: '50000' } as never],
      },
    }));
    expect(canDownloadDocument).toBe(false);
  });

  it('er false når omregningAktiveret=true men periodeData=null', () => {
    const { canDownloadDocument } = renderHook(makeBaseProps({
      omregningAktiveret: true,
      periodeData: null,
      values: {
        ...makeBaseProps().values,
        tableData: [{ id: 'r1', col0_maaned: toISODateString('2024-01-01'), col1_maaned: toISODateString('2024-06-30'), col2: '50000' } as never],
      },
    }));
    expect(canDownloadDocument).toBe(false);
  });
});

// ─── canDownloadSHDageDocument ─────────────────────────────────────────────────────

describe('useAarsloenDocumentGates — canDownloadSHDageDocument', () => {
  const mockPeriodeData = {
    perioder: [],
    datoSet: new Set<string>(),
  } as unknown as PeriodeResult;

  it('er false når periodeData=null', () => {
    const { canDownloadSHDageDocument } = renderHook(makeBaseProps({
      periodeData: null,
      shDageAntal: 5,
    }));
    expect(canDownloadSHDageDocument).toBe(false);
  });

  it('er false når shDageAntal=null', () => {
    const { canDownloadSHDageDocument } = renderHook(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: null,
    }));
    expect(canDownloadSHDageDocument).toBe(false);
  });

  it('er false når shDageAntal=0 (ingen SH-dage at vise)', () => {
    const { canDownloadSHDageDocument } = renderHook(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: 0,
    }));
    expect(canDownloadSHDageDocument).toBe(false);
  });

  it('er true når periodeData er sat og shDageAntal>0', () => {
    const { canDownloadSHDageDocument } = renderHook(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: 3,
    }));
    expect(canDownloadSHDageDocument).toBe(true);
  });
});

describe('useAarsloenDocumentGates — runtime PDF-fejl', () => {
  it('trigger ikke shake ved teknisk PDF-fejl, så den centrale fejlvisning kan tage over', async () => {
    downloadAarsloenPdfMock.mockResolvedValueOnce({
      success: false as const,
      error: 'Udviklingsserveren svarer ikke længere.',
    });

    const baseValues = makeBaseProps().values;
    const captured = renderHook(makeBaseProps({
      values: {
        ...baseValues,
        tableData: [{ id: 'r1', col0_maaned: toISODateString('2024-01-01'), col1_maaned: toISODateString('2024-06-30'), col2: '50000' } as never],
      },
    }));

    await act(async () => {
      await captured.handleAarsloenDocumentDownload?.();
    });

    expect(captured.downloadShake).toBe(false);
  });
});
