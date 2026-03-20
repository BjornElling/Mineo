// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
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

vi.mock('../../utils/pdf/pdfService', () => ({
  downloadAarsloenPdf: vi.fn(async () => ({ success: true })),
  downloadSHDagePdf: vi.fn(async () => ({ success: true })),
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
  getPersistedData: vi.fn(() => null),
  settings: DEFAULT_APP_SETTINGS,
  ...overrides,
});

type CapturedGates = {
  canDownloadPdf: boolean;
  canDownloadSHDagePdf: boolean;
};

const renderGates = (props: ReturnType<typeof makeBaseProps>): CapturedGates => {
  const captured: CapturedGates = { canDownloadPdf: false, canDownloadSHDagePdf: false };

  const Comp = () => {
    const { canDownloadPdf, canDownloadSHDagePdf } = useAarsloenPdfGates(props);
    captured.canDownloadPdf = canDownloadPdf;
    captured.canDownloadSHDagePdf = canDownloadSHDagePdf;
    return null;
  };

  render(<Comp />);
  return captured;
};

// ─── canDownloadPdf (getPdfEligibility) ──────────────────────────────────────

describe('useAarsloenPdfGates — canDownloadPdf', () => {
  it('er false når tableData er tom', () => {
    const { canDownloadPdf } = renderGates(makeBaseProps());
    expect(canDownloadPdf).toBe(false);
  });

  it('er false ved fatale beregningsfejl selv med data', () => {
    const { canDownloadPdf } = renderGates(makeBaseProps({
      harFatalBeregningsFejl: true,
      values: {
        ...makeBaseProps().values,
        tableData: [{ id: 'r1', col0_maaned: '2024-01-01', col1_maaned: '2024-06-30', col2: '50000' } as never],
      },
    }));
    expect(canDownloadPdf).toBe(false);
  });

  it('er false når omregningAktiveret=true men periodeData=null', () => {
    const { canDownloadPdf } = renderGates(makeBaseProps({
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
    const { canDownloadSHDagePdf } = renderGates(makeBaseProps({
      periodeData: null,
      shDageAntal: 5,
    }));
    expect(canDownloadSHDagePdf).toBe(false);
  });

  it('er false når shDageAntal=null', () => {
    const { canDownloadSHDagePdf } = renderGates(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: null,
    }));
    expect(canDownloadSHDagePdf).toBe(false);
  });

  it('er false når shDageAntal=0 (ingen SH-dage at vise)', () => {
    const { canDownloadSHDagePdf } = renderGates(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: 0,
    }));
    expect(canDownloadSHDagePdf).toBe(false);
  });

  it('er true når periodeData er sat og shDageAntal>0', () => {
    const { canDownloadSHDagePdf } = renderGates(makeBaseProps({
      periodeData: mockPeriodeData,
      shDageAntal: 3,
    }));
    expect(canDownloadSHDagePdf).toBe(true);
  });
});
