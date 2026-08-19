import {
  calculateStandardLoenDerivedFromAmounts,
  calculateStandardLoenRowDerived,
  calculateStandardLoenProjectedAmounts,
  isStandardLoenRowEffectivelyEmpty,
  type StandardLoenAmounts,
  type StandardLoenSatserInput,
} from '../../../domain/aarsloen/standardLoenRowCalculations';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

// Tester Beløb-tilstand (tillaegAngivesSom='beloeb'): tillæg angives direkte som beløb i tabellen,
// satserne ignoreres, og Samlet løn er den rene rækkesum. Den kritiske invariant er tilstands-isolation:
// den fravalgte tilstands input må aldrig påvirke resultatet.

const asAmount = (value: number | undefined): StandardLoenTableRow['col2'] =>
  typeof value === 'number' ? { kind: 'number', value } : undefined;

const createRow = (overrides: Partial<Record<'col2' | 'col3' | 'col4' | 'col5' | 'fpFvShSoBeloeb' | 'pensionBeloeb', number>> & {
  col0_maaned?: string;
  col1_maaned?: string;
} = {}): StandardLoenTableRow => ({
  id: 'row-1',
  col0_maaned: overrides.col0_maaned ?? '',
  col1_maaned: overrides.col1_maaned ?? '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: asAmount(overrides.col2),
  col3: asAmount(overrides.col3),
  col4: asAmount(overrides.col4),
  col5: asAmount(overrides.col5),
  fpFvShSoBeloeb: asAmount(overrides.fpFvShSoBeloeb),
  pensionBeloeb: asAmount(overrides.pensionBeloeb),
});

const FULDE_SATSER: StandardLoenSatserInput = {
  feriePct: 12.5,
  fritvalgPct: 4,
  shSoPct: 2.7,
  storeBededagPct: 0.45,
  pensionPct: 8.15,
};

describe('calculateStandardLoenDerivedFromAmounts – Beløb-tilstand', () => {
  const amounts: StandardLoenAmounts = {
    loen: 25000,
    loen2: 2500,
    ikkePensionsgivende: 250,
    atp: 25,
    fpFvShSoBeloeb: 4218,
    pensionBeloeb: 2581.92,
  };

  it('bruger de indtastede tillægsbeløb direkte og ignorerer satserne', () => {
    const result = calculateStandardLoenDerivedFromAmounts(amounts, FULDE_SATSER, 'beloeb');
    expect(result.fpFvShSo).toBe(4218);
    expect(result.pension).toBe(2581.92);
  });

  it('Samlet løn er den rene rækkesum (alle beløbskolonner lagt sammen)', () => {
    const result = calculateStandardLoenDerivedFromAmounts(amounts, FULDE_SATSER, 'beloeb');
    // 25000 + 2500 + 250 + 4218 + 2581,92 + 25
    expect(result.samlet).toBeCloseTo(34574.92, 6);
  });

  it('tilstands-isolation: resultatet er uændret uanset satserne', () => {
    const medSatser = calculateStandardLoenDerivedFromAmounts(amounts, FULDE_SATSER, 'beloeb');
    const udenSatser = calculateStandardLoenDerivedFromAmounts(amounts, {}, 'beloeb');
    expect(medSatser).toEqual(udenSatser);
  });

  it('tilstands-isolation: Procent-tilstand ignorerer de direkte tillægsbeløb', () => {
    const medBeloeb = calculateStandardLoenDerivedFromAmounts(amounts, FULDE_SATSER, 'procent');
    const udenBeloeb = calculateStandardLoenDerivedFromAmounts(
      { ...amounts, fpFvShSoBeloeb: 0, pensionBeloeb: 0 },
      FULDE_SATSER,
      'procent'
    );
    expect(medBeloeb).toEqual(udenBeloeb);
  });

  it('default mode er procent (beregner tillæg ud fra satser)', () => {
    const eksplicitProcent = calculateStandardLoenDerivedFromAmounts(amounts, FULDE_SATSER, 'procent');
    const defaultMode = calculateStandardLoenDerivedFromAmounts(amounts, FULDE_SATSER);
    expect(defaultMode).toEqual(eksplicitProcent);
  });
});

describe('calculateStandardLoenRowDerived – Beløb-tilstand', () => {
  it('Samlet = rækkesum og afhænger kun af Beløb-felterne', () => {
    const row = createRow({ col2: 30000, col3: 0, col4: 1000, col5: 300, fpFvShSoBeloeb: 5000, pensionBeloeb: 2000 });
    const result = calculateStandardLoenRowDerived(row, FULDE_SATSER, { mode: 'beloeb' });
    expect(result.fpFvShSo).toBe(5000);
    expect(result.pension).toBe(2000);
    expect(result.samlet).toBe(38300);
  });

  it('en række med kun tillægsbeløb (uden løn) tæller med i Beløb-tilstand', () => {
    const row = createRow({ col0_maaned: '5', col1_maaned: '2016', fpFvShSoBeloeb: 4218 });
    expect(isStandardLoenRowEffectivelyEmpty(row, 'maaned', 'beloeb')).toBe(false);
    // I Procent-tilstand er tillægsbeløb-kolonnerne ikke redigerbare og indgår ikke i tomheds-tjekket.
    expect(isStandardLoenRowEffectivelyEmpty(
      createRow({ fpFvShSoBeloeb: 4218 }),
      'maaned',
      'procent'
    )).toBe(true);
  });
});

describe('calculateStandardLoenProjectedAmounts – Beløb-tilstand', () => {
  it('Samlet bevares som rækkesum efter dag-for-dag-projektion', () => {
    const row = createRow({ col0_maaned: '1', col1_maaned: '2024', col2: 31000, fpFvShSoBeloeb: 4000, pensionBeloeb: 2500 });
    const allocationDates = [
      toISODateString('2024-01-01'),
      toISODateString('2024-01-15'),
      toISODateString('2024-01-31'),
    ];
    const projected = calculateStandardLoenProjectedAmounts(row, FULDE_SATSER, {
      loenperiode: 'maaned',
      allocationDates,
      mode: 'beloeb',
    });
    expect(projected.fpFvShSo).toBeCloseTo(4000, 6);
    expect(projected.pension).toBeCloseTo(2500, 6);
    expect(projected.samlet).toBeCloseTo(37500, 6);
  });
});
