import { renderHook } from '@testing-library/react';
import { useAarsloenBeregning } from '../../hooks/useAarsloenBeregning';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE } from '../../types/loen';
import type { AarsloenValues } from '../../schemas/formSchemas';
import { safeCompute } from '../../utils/safeComputation';
import { beregnSHDageForDatoSet } from '../../domain/dates/shDageBeregning';
import { beregnOmregnetAarsloen } from '../../domain/aarsloen/aarsloenCalculations';
import { harTabelData } from '../../domain/aarsloen/aarsloenValidationPolicies';
import { beregnMaanedPeriode } from '../../utils/periodeBeregning';

vi.mock('../../utils/safeComputation', () => ({
  safeCompute: vi.fn(),
}));

vi.mock('../../domain/aarsloen/standardLoenRowCalculations', () => ({
  calculateStandardLoenRowDerived: vi.fn(() => ({ samlet: 100 })),
  roundStandardLoenAmountToTwoDecimals: vi.fn((value: number) => value),
}));

vi.mock('../../utils/periodeBeregning', () => ({
  beregnMaanedPeriode: vi.fn(),
  beregnUgePeriode: vi.fn(),
  beregnDagPeriode: vi.fn(),
}));

vi.mock('../../domain/dates/shDageBeregning', () => ({
  beregnSHDageForDatoSet: vi.fn(),
}));

vi.mock('../../domain/aarsloen/aarsloenCalculations', () => ({
  beregnOmregnetAarsloen: vi.fn(),
}));

vi.mock('../../domain/aarsloen/aarsloenValidationPolicies', () => ({
  beregnFejlmeddelelser: vi.fn(() => []),
  harTabelData: vi.fn(),
}));

const mockedSafeCompute = vi.mocked(safeCompute);
const mockedBeregnSHDageForDatoSet = vi.mocked(beregnSHDageForDatoSet);
const mockedBeregnOmregnetAarsloen = vi.mocked(beregnOmregnetAarsloen);
const mockedHarTabelData = vi.mocked(harTabelData);
const mockedBeregnMaanedPeriode = vi.mocked(beregnMaanedPeriode);

const makeValues = (patch: Partial<AarsloenValues> = {}): AarsloenValues => ({
  feriePct: undefined,
  fritvalgPct: undefined,
  shSoPct: undefined,
  storeBededagPct: undefined,
  pensionPct: undefined,
  loenperiode: LOENPERIODE.MAANED,
  tableData: [
    {
      id: 'r1',
      col0_maaned: '1',
      col1_maaned: '2024',
      col0_uge: '',
      col1_uge: '',
      col0_dag: '',
      col1_dag: '',
      col2: undefined,
      col3: undefined,
      col4: undefined,
      col5: undefined,
    },
  ],
  omregningTilFuldtAar: false,
  fuldLoenUnderFerie: true,
  retTilSjetteFerieuge: true,
  antalFeriedage: undefined,
  loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.SH_UDBETALING,
  ...patch,
});

describe('useAarsloenBeregning (wire-up/control-flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSafeCompute.mockImplementation((fn) => ({ success: true, value: fn() }));
    mockedHarTabelData.mockReturnValue(true);
    mockedBeregnMaanedPeriode.mockReturnValue({
      antalEnheder: 1,
      periodeDage: 31,
      datoSet: new Set(['2024-01-01']),
    });
    mockedBeregnSHDageForDatoSet.mockReturnValue(2);
    mockedBeregnOmregnetAarsloen.mockReturnValue({ metode: 'periode', erEtAar: false });
  });

  it('beregner ikke SH-dage når omregning er deaktiveret', () => {
    const { result } = renderHook(() =>
      useAarsloenBeregning({
        values: makeValues(),
        omregningAktiveret: false,
      })
    );

    expect(result.current.shDageAntal).toBeNull();
    expect(mockedBeregnSHDageForDatoSet).not.toHaveBeenCalled();
  });

  it('beregner ikke SH-dage ved ikke-relevant helligdagstype', () => {
    const { result } = renderHook(() =>
      useAarsloenBeregning({
        values: makeValues({ loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG }),
        omregningAktiveret: true,
      })
    );

    expect(result.current.shDageAntal).toBeNull();
    expect(mockedBeregnSHDageForDatoSet).not.toHaveBeenCalled();
  });

  it('returnerer metode=ingen når periodeData mangler', () => {
    mockedHarTabelData.mockReturnValue(false);

    const { result } = renderHook(() =>
      useAarsloenBeregning({
        values: makeValues(),
        omregningAktiveret: true,
      })
    );

    expect(result.current.periodeData).toBeNull();
    expect(result.current.beregningsData).toEqual({ metode: 'ingen', erEtAar: false });
  });

  it('sætter fatal fejl når SH-dagsberegning fejler', () => {
    mockedSafeCompute.mockImplementation((fn, context) => {
      if (context === 'useAarsloenBeregning.shDageBeregning') {
        return { success: false, error: new Error('boom') };
      }
      return { success: true, value: fn() };
    });

    const { result } = renderHook(() =>
      useAarsloenBeregning({
        values: makeValues(),
        omregningAktiveret: true,
      })
    );

    expect(result.current.shDageAntal).toBeNull();
    expect(result.current.harFatalBeregningsFejl).toBe(true);
    expect(result.current.beregningsFejl).toBe('Fejl ved beregning af SH-dage');
  });
});
