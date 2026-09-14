import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../types/branded';
import { beregnMaanedPeriode } from '../../utils/periodeBeregning';

const row: StandardLoenTableRow = {
  id: 'februar-2024',
  col0_maaned: '2',
  col1_maaned: '2024',
};

// Håndskrevet facit: februar 2024 er et skudår og har derfor 29 kalenderdage.
const facitDatoer: readonly ISODateString[] = [
  toISODateString('2024-02-01'),
  toISODateString('2024-02-02'),
  toISODateString('2024-02-03'),
  toISODateString('2024-02-04'),
  toISODateString('2024-02-05'),
  toISODateString('2024-02-06'),
  toISODateString('2024-02-07'),
  toISODateString('2024-02-08'),
  toISODateString('2024-02-09'),
  toISODateString('2024-02-10'),
  toISODateString('2024-02-11'),
  toISODateString('2024-02-12'),
  toISODateString('2024-02-13'),
  toISODateString('2024-02-14'),
  toISODateString('2024-02-15'),
  toISODateString('2024-02-16'),
  toISODateString('2024-02-17'),
  toISODateString('2024-02-18'),
  toISODateString('2024-02-19'),
  toISODateString('2024-02-20'),
  toISODateString('2024-02-21'),
  toISODateString('2024-02-22'),
  toISODateString('2024-02-23'),
  toISODateString('2024-02-24'),
  toISODateString('2024-02-25'),
  toISODateString('2024-02-26'),
  toISODateString('2024-02-27'),
  toISODateString('2024-02-28'),
  toISODateString('2024-02-29'),
];

describe('beregnMaanedPeriode – uafhængigt skudårs-facit', () => {
  it('materialiserer alle 29 dage i februar 2024 inklusive skuddagen', () => {
    const result = beregnMaanedPeriode([row]);

    expect(result).not.toBeNull();
    expect(result?.totalEnheder).toBe(1);
    expect(result?.unikkeEnheder).toBe(1);
    expect([...result!.datoSet].sort()).toEqual([...facitDatoer].sort());
    expect(result?.perioder).toEqual([
      {
        start: new Date(Date.UTC(2024, 1, 1)),
        end: new Date(Date.UTC(2024, 1, 29)),
      },
    ]);
  });
});
