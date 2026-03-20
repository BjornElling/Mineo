import {
  calculateStandardLoenRowDerived,
  roundStandardLoenAmountToTwoDecimals,
  isStandardLoenTableCellEffectivelyEmpty,
  isStandardLoenRowEffectivelyEmpty,
  hasCompletePeriodForLoenperiode,
  hasAtLeastOneValidRow,
  type StandardLoenSatserInput,
} from '../../../domain/aarsloen/standardLoenRowCalculations';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';

const createRow = (overrides: Partial<StandardLoenTableRow> = {}): StandardLoenTableRow => ({
  id: 'row-1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: '',
  col1_dag: '',
  col2: 0,
  col3: 0,
  col4: 0,
  col5: 0,
  ...overrides,
});

describe('calculateStandardLoenRowDerived', () => {
  it('beregner ferieberettiget løn, fp/fv/sh/so, pension og samlet korrekt', () => {
    const row = createRow({
      col2: 30000,
      col3: 2000,
      col4: 1000,
      col5: 300,
    });
    const satser: StandardLoenSatserInput = {
      feriePct: '12,5',
      fritvalgPct: '1,0',
      shSoPct: '2,0',
      storeBededagPct: '0,45',
      pensionPct: '10,0',
    };

    const result = calculateStandardLoenRowDerived(row, satser);
    expect(result.ferieberet).toBe(33000);
    expect(result.fpFvShSo).toBeCloseTo(5263.5, 6);
    expect(result.pension).toBeCloseTo(3710.4, 6);
    expect(result.samlet).toBeCloseTo(42273.9, 6);
  });

  it('medtager ATP direkte i samlet, men ikke i pensionsgrundlag', () => {
    const row = createRow({
      col2: 10000,
      col3: 5000,
      col4: 0,
      col5: 1000,
    });
    const satser: StandardLoenSatserInput = {
      feriePct: '0',
      fritvalgPct: '0',
      shSoPct: '0',
      storeBededagPct: '0',
      pensionPct: '10',
    };

    const result = calculateStandardLoenRowDerived(row, satser);
    expect(result.fpFvShSo).toBe(0);
    expect(result.pension).toBe(1500);
    expect(result.samlet).toBe(17500);
  });
});

// ─── roundStandardLoenAmountToTwoDecimals ────────────────────────────────────────

describe('roundStandardLoenAmountToTwoDecimals', () => {
  it('afrunder til 2 decimaler med halfAwayFromZero', () => {
    // 1.005 er i floating-point faktisk 1.004999... → afrunder ned til 1.00
    expect(roundStandardLoenAmountToTwoDecimals(1.005)).toBe(1);
    // 2.005 er i floating-point faktisk 2.005000... → afrunder op til 2.01
    expect(roundStandardLoenAmountToTwoDecimals(2.005)).toBe(2.01);
    expect(roundStandardLoenAmountToTwoDecimals(1.234)).toBe(1.23);
    expect(roundStandardLoenAmountToTwoDecimals(1.235)).toBe(1.24);
  });

  it('NaN → 0 (fail-closed)', () => {
    expect(roundStandardLoenAmountToTwoDecimals(Number.NaN)).toBe(0);
  });

  it('Infinity → 0 (fail-closed)', () => {
    expect(roundStandardLoenAmountToTwoDecimals(Number.POSITIVE_INFINITY)).toBe(0);
    expect(roundStandardLoenAmountToTwoDecimals(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('heltal er uændret', () => {
    expect(roundStandardLoenAmountToTwoDecimals(42)).toBe(42);
    expect(roundStandardLoenAmountToTwoDecimals(0)).toBe(0);
  });
});

// ─── isStandardLoenTableCellEffectivelyEmpty ─────────────────────────────────────

describe('isStandardLoenTableCellEffectivelyEmpty', () => {
  it('undefined → true', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty(undefined)).toBe(true);
  });

  it('null → true', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty(null)).toBe(true);
  });

  it('tom streng → true', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty('')).toBe(true);
  });

  it('whitespace-streng → true', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty('   ')).toBe(true);
  });

  it('streng med indhold → false', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty('01-2024')).toBe(false);
    expect(isStandardLoenTableCellEffectivelyEmpty('1')).toBe(false);
  });

  it('tal (0) → false (kun strenge er "empty")', () => {
    // Implementeringen returnerer false for ikke-strenge (typeof value !== 'string')
    expect(isStandardLoenTableCellEffectivelyEmpty(0)).toBe(false);
  });

  it('tal (1000) → false', () => {
    expect(isStandardLoenTableCellEffectivelyEmpty(1000)).toBe(false);
  });
});

// ─── isStandardLoenRowEffectivelyEmpty ───────────────────────────────────────────

describe('isStandardLoenRowEffectivelyEmpty', () => {
  it('alle editable felter undefined → true', () => {
    const row: StandardLoenTableRow = {
      id: 'r',
      col0_maaned: undefined,
      col1_maaned: undefined,
      col0_uge: undefined,
      col1_uge: undefined,
      col0_dag: undefined,
      col1_dag: undefined,
      col2: undefined,
      col3: undefined,
      col4: undefined,
      col5: undefined,
    };
    expect(isStandardLoenRowEffectivelyEmpty(row)).toBe(true);
  });

  it('alle editable felter er tomme strings og undefined → true', () => {
    const row: StandardLoenTableRow = {
      id: 'r',
      col0_maaned: '',
      col1_maaned: '',
      col0_uge: '',
      col1_uge: '',
      col0_dag: '',
      col1_dag: '',
      col2: undefined,
      col3: undefined,
      col4: undefined,
      col5: undefined,
    };
    expect(isStandardLoenRowEffectivelyEmpty(row)).toBe(true);
  });

  it('createRow() med col2=0 (number) → false (0 er tal, ikke string)', () => {
    // col2: 0 → typeof number → isStandardLoenTableCellEffectivelyEmpty(0) = false
    expect(isStandardLoenRowEffectivelyEmpty(createRow({ col2: 0 }))).toBe(false);
  });

  it('row med col0_maaned = "1" og undefined numerics → ikke empty', () => {
    const row: StandardLoenTableRow = { id: 'r', col0_maaned: '1', col2: undefined, col3: undefined, col4: undefined, col5: undefined };
    expect(isStandardLoenRowEffectivelyEmpty(row)).toBe(false);
  });
});

// ─── hasCompletePeriodForLoenperiode ─────────────────────────────────────────

describe('hasCompletePeriodForLoenperiode', () => {
  it('maaned: begge felter sat → true', () => {
    const row = createRow({ col0_maaned: '1', col1_maaned: '2024' });
    expect(hasCompletePeriodForLoenperiode(row, 'maaned')).toBe(true);
  });

  it('maaned: kun fra-felt sat → false', () => {
    const row = createRow({ col0_maaned: '1', col1_maaned: '' });
    expect(hasCompletePeriodForLoenperiode(row, 'maaned')).toBe(false);
  });

  it('uge: begge felter sat → true', () => {
    const row = createRow({ col0_uge: '1/2024', col1_uge: '12/2024' });
    expect(hasCompletePeriodForLoenperiode(row, 'uge')).toBe(true);
  });

  it('uge: ingen felter sat → false', () => {
    const row = createRow();
    expect(hasCompletePeriodForLoenperiode(row, 'uge')).toBe(false);
  });

  it('dag: begge felter sat → true', () => {
    const row = createRow({ col0_dag: '01-01-2024', col1_dag: '31-01-2024' });
    expect(hasCompletePeriodForLoenperiode(row, 'dag')).toBe(true);
  });

  it('dag: kun til-felt sat → false', () => {
    const row = createRow({ col0_dag: '', col1_dag: '31-01-2024' });
    expect(hasCompletePeriodForLoenperiode(row, 'dag')).toBe(false);
  });
});

// ─── hasAtLeastOneValidRow ───────────────────────────────────────────────────

describe('hasAtLeastOneValidRow', () => {
  const satser: StandardLoenSatserInput = { feriePct: '0', fritvalgPct: '0', shSoPct: '0', storeBededagPct: '0', pensionPct: '0' };

  it('tom liste → false', () => {
    expect(hasAtLeastOneValidRow([], 'maaned', satser)).toBe(false);
  });

  it('row med komplet periode og samlet > 0 → true', () => {
    const row = createRow({ col0_maaned: '1', col1_maaned: '2024', col2: 10000 });
    expect(hasAtLeastOneValidRow([row], 'maaned', satser)).toBe(true);
  });

  it('row med komplet periode men samlet = 0 → false', () => {
    const row = createRow({ col0_maaned: '1', col1_maaned: '2024', col2: 0, col3: 0, col4: 0, col5: 0 });
    expect(hasAtLeastOneValidRow([row], 'maaned', satser)).toBe(false);
  });

  it('row uden komplet periode → false', () => {
    const row = createRow({ col0_maaned: '1', col2: 10000 }); // col1_maaned mangler
    expect(hasAtLeastOneValidRow([row], 'maaned', satser)).toBe(false);
  });

  it('blandet liste: én gyldig og én ugyldig → true', () => {
    const valid = createRow({ col0_maaned: '1', col1_maaned: '2024', col2: 5000 });
    const invalid = createRow({ col0_maaned: '2' }); // ingen col1_maaned
    expect(hasAtLeastOneValidRow([invalid, valid], 'maaned', satser)).toBe(true);
  });
});
