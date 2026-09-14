import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { beregnDagPeriode } from '../../utils/periodeBeregning';

const iso = (value: string): ISODateString => value as ISODateString;

const row: StandardLoenTableRow = {
  id: '1900-februar-marts',
  col0_dag: iso('1900-02-28'),
  col1_dag: iso('1900-03-01'),
};

describe('beregnDagPeriode – uafhængigt århundrede-facit', () => {
  it('tæller 28. februar og 1. marts 1900 som to kalenderdage', () => {
    const result = beregnDagPeriode([row]);

    // 1900 er deleligt med 100, men ikke med 400, så februar har 28 dage.
    // Det inklusive interval fra 28. februar til 1. marts har derfor to dage.
    expect(result).not.toBeNull();
    expect(result?.totalEnheder).toBe(2);
    expect(result?.unikkeEnheder).toBe(2);
    expect([...result!.datoSet].sort()).toEqual([
      iso('1900-02-28'),
      iso('1900-03-01'),
    ]);
    expect(result?.perioder).toEqual([
      {
        start: new Date(Date.UTC(1900, 1, 28)),
        end: new Date(Date.UTC(1900, 2, 1)),
      },
    ]);
  });
});
