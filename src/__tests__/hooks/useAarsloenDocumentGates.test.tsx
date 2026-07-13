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

// ─── Dokument-service mock ─────────────────────────────────────────────────────────

const { downloadAarsloenDokumentMock, downloadSHDageDokumentMock } = vi.hoisted(() => ({
  downloadAarsloenDokumentMock: vi.fn(async (): Promise<{ success: true } | { success: false; error: string }> => ({ success: true })),
  downloadSHDageDokumentMock: vi.fn(async () => ({ success: true as const })),
}));

vi.mock('../../document/service/documentService', () => ({
  downloadAarsloenDokument: downloadAarsloenDokumentMock,
  downloadSHDageDokument: downloadSHDageDokumentMock,
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
  documentDisabledReason: string | null;
  canDownloadSHDageDocument: boolean;
  shDageDisabledReason: string | null;
  handleAarsloenDocumentDownload: (() => Promise<void>) | null;
  downloadShake: boolean;
};

// Én render-instans pr. test, så gates og actions altid kommer fra samme hook-state.
// Før konsolideringen havde vi to parallelle renderers (renderGates/renderActions), hvilket
// kunne maskere sync-problemer mellem gate-udledning og action-logik.
const renderHook = (props: ReturnType<typeof makeBaseProps>): CapturedHook => {
  const captured: CapturedHook = {
    canDownloadDocument: false,
    documentDisabledReason: null,
    canDownloadSHDageDocument: false,
    shDageDisabledReason: null,
    handleAarsloenDocumentDownload: null,
    downloadShake: false,
  };

  const Comp = () => {
    const result = useAarsloenDocumentGates(props);
    captured.canDownloadDocument = result.canDownloadDocument;
    captured.documentDisabledReason = result.documentDisabledReason;
    captured.canDownloadSHDageDocument = result.canDownloadSHDageDocument;
    captured.shDageDisabledReason = result.shDageDisabledReason;
    captured.handleAarsloenDocumentDownload = result.handleAarsloenDocumentDownload;
    captured.downloadShake = result.downloadShake;
    return null;
  };

  render(<Comp />);
  return captured;
};

beforeEach(() => {
  downloadAarsloenDokumentMock.mockReset();
  downloadSHDageDokumentMock.mockReset();
  downloadAarsloenDokumentMock.mockImplementation(async () => ({ success: true as const }));
  downloadSHDageDokumentMock.mockImplementation(async () => ({ success: true as const }));
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

// ─── disabledReason (til nedtonet ikon-tooltip) ─────────────────────────────────────

describe('useAarsloenDocumentGates — disabledReason', () => {
  const mockPeriodeData = {
    perioder: [],
    datoSet: new Set<string>(),
  } as unknown as PeriodeResult;

  it('documentDisabledReason har en årsag når download er blokeret (tom tabel)', () => {
    const { canDownloadDocument, documentDisabledReason } = renderHook(makeBaseProps());
    expect(canDownloadDocument).toBe(false);
    expect(documentDisabledReason).toBe('Ingen data i tabel');
  });

  it('documentDisabledReason og canDownloadDocument er koblet (reason ikke-null præcis når blokeret)', () => {
    // Invariant: en årsag findes hvis og kun hvis download er blokeret.
    const { canDownloadDocument, documentDisabledReason } = renderHook(makeBaseProps());
    expect(documentDisabledReason === null).toBe(canDownloadDocument);
  });

  it('shDageDisabledReason er null når SH-dage kan downloades', () => {
    const { canDownloadSHDageDocument, shDageDisabledReason } = renderHook(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: 3,
    }));
    expect(canDownloadSHDageDocument).toBe(true);
    expect(shDageDisabledReason).toBeNull();
  });

  it('shDageDisabledReason forklarer at der ikke er SH-dage når antal=0', () => {
    const { canDownloadSHDageDocument, shDageDisabledReason } = renderHook(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: 0,
    }));
    expect(canDownloadSHDageDocument).toBe(false);
    expect(shDageDisabledReason).toBe('Ingen SH-dage i de indtastede perioder');
  });
});

describe('useAarsloenDocumentGates — runtime dokument-fejl', () => {
  it('trigger ikke shake ved teknisk dokument-fejl, så den centrale fejlvisning kan tage over', async () => {
    downloadAarsloenDokumentMock.mockResolvedValueOnce({
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
