import { describe, expect, it } from 'vitest';
import { calculateAarsloenRowDerived, type AarsloenSatserInput } from '../aarsloenTableCalculations';
import type { AarsloenTableRow } from '../../schemas/formSchemas';

const createRow = (overrides: Partial<AarsloenTableRow> = {}): AarsloenTableRow => ({
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

describe('calculateAarsloenRowDerived', () => {
  it('beregner ferieberettiget løn, fp/fv/sh/so, pension og samlet korrekt', () => {
    const row = createRow({
      col2: 30000,
      col3: 2000,
      col4: 1000,
      col5: 300,
    });
    const satser: AarsloenSatserInput = {
      feriePct: '12,5',
      fritvalgPct: '1,0',
      shSoPct: '2,0',
      storeBededagPct: '0,45',
      pensionPct: '10,0',
    };

    const result = calculateAarsloenRowDerived(row, satser);
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
    const satser: AarsloenSatserInput = {
      feriePct: '0',
      fritvalgPct: '0',
      shSoPct: '0',
      storeBededagPct: '0',
      pensionPct: '10',
    };

    const result = calculateAarsloenRowDerived(row, satser);
    expect(result.fpFvShSo).toBe(0);
    expect(result.pension).toBe(1500);
    expect(result.samlet).toBe(17500);
  });
});
