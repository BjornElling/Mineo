import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../types/branded';
import { beregnMaanedPeriode } from '../../utils/periodeBeregning';

const rows: StandardLoenTableRow[] = [
  {
    id: 'december-2024',
    col0_maaned: '12',
    col1_maaned: '2024',
  },
  {
    id: 'januar-2025',
    col0_maaned: '1',
    col1_maaned: '2025',
  },
];

// Håndberegnet kalenderfacit: december 2024 har 31 dage, og januar 2025 har 31 dage.
const facitDatoer: readonly ISODateString[] = [
  toISODateString('2024-12-01'),
  toISODateString('2024-12-02'),
  toISODateString('2024-12-03'),
  toISODateString('2024-12-04'),
  toISODateString('2024-12-05'),
  toISODateString('2024-12-06'),
  toISODateString('2024-12-07'),
  toISODateString('2024-12-08'),
  toISODateString('2024-12-09'),
  toISODateString('2024-12-10'),
  toISODateString('2024-12-11'),
  toISODateString('2024-12-12'),
  toISODateString('2024-12-13'),
  toISODateString('2024-12-14'),
  toISODateString('2024-12-15'),
  toISODateString('2024-12-16'),
  toISODateString('2024-12-17'),
  toISODateString('2024-12-18'),
  toISODateString('2024-12-19'),
  toISODateString('2024-12-20'),
  toISODateString('2024-12-21'),
  toISODateString('2024-12-22'),
  toISODateString('2024-12-23'),
  toISODateString('2024-12-24'),
  toISODateString('2024-12-25'),
  toISODateString('2024-12-26'),
  toISODateString('2024-12-27'),
  toISODateString('2024-12-28'),
  toISODateString('2024-12-29'),
  toISODateString('2024-12-30'),
  toISODateString('2024-12-31'),
  toISODateString('2025-01-01'),
  toISODateString('2025-01-02'),
  toISODateString('2025-01-03'),
  toISODateString('2025-01-04'),
  toISODateString('2025-01-05'),
  toISODateString('2025-01-06'),
  toISODateString('2025-01-07'),
  toISODateString('2025-01-08'),
  toISODateString('2025-01-09'),
  toISODateString('2025-01-10'),
  toISODateString('2025-01-11'),
  toISODateString('2025-01-12'),
  toISODateString('2025-01-13'),
  toISODateString('2025-01-14'),
  toISODateString('2025-01-15'),
  toISODateString('2025-01-16'),
  toISODateString('2025-01-17'),
  toISODateString('2025-01-18'),
  toISODateString('2025-01-19'),
  toISODateString('2025-01-20'),
  toISODateString('2025-01-21'),
  toISODateString('2025-01-22'),
  toISODateString('2025-01-23'),
  toISODateString('2025-01-24'),
  toISODateString('2025-01-25'),
  toISODateString('2025-01-26'),
  toISODateString('2025-01-27'),
  toISODateString('2025-01-28'),
  toISODateString('2025-01-29'),
  toISODateString('2025-01-30'),
  toISODateString('2025-01-31'),
];

describe('beregnMaanedPeriode – uafhængigt årsskiftefacit', () => {
  it('materialiserer december og januar som 62 sammenhængende kalenderdage', () => {
    const result = beregnMaanedPeriode(rows);

    expect(result).not.toBeNull();
    expect(result?.totalEnheder).toBe(2);
    expect(result?.unikkeEnheder).toBe(2);
    expect([...result!.datoSet].sort()).toEqual([...facitDatoer].sort());
    expect(result?.perioder).toEqual([
      {
        start: new Date(Date.UTC(2024, 11, 1)),
        end: new Date(Date.UTC(2024, 11, 31)),
      },
      {
        start: new Date(Date.UTC(2025, 0, 1)),
        end: new Date(Date.UTC(2025, 0, 31)),
      },
    ]);
  });
});
