import type { StandardLoenTableRow } from '../../schemas/formSchemas';
import { toISODateString, type ISODateString } from '../../types/branded';
import { beregnDagPeriode } from '../../utils/periodeBeregning';

type DagPeriodeFacit = Readonly<{
  totalEnheder: number;
  unikkeEnheder: number;
  datoer: readonly ISODateString[];
}>;

const rows: StandardLoenTableRow[] = [
  {
    id: 'skuddag-foerste',
    col0_dag: toISODateString('2024-02-28'),
    col1_dag: toISODateString('2024-03-01'),
  },
  {
    id: 'skuddag-overlap',
    col0_dag: toISODateString('2024-02-29'),
    col1_dag: toISODateString('2024-03-02'),
  },
];

// Håndberegnet union: 28. februar, skuddagen, 1. marts og 2. marts 2024.
const facit: DagPeriodeFacit = {
  totalEnheder: 4,
  unikkeEnheder: 4,
  datoer: [
    toISODateString('2024-02-28'),
    toISODateString('2024-02-29'),
    toISODateString('2024-03-01'),
    toISODateString('2024-03-02'),
  ],
};

describe('beregnDagPeriode – uafhængigt skudårs-/overlapfacit', () => {
  it('bevarer skuddagen og tæller den samlede union inklusivt', () => {
    const result = beregnDagPeriode(rows);

    expect(result).not.toBeNull();
    expect(result!.totalEnheder).toBe(facit.totalEnheder);
    expect(result!.unikkeEnheder).toBe(facit.unikkeEnheder);
    expect([...result!.datoSet].sort()).toEqual([...facit.datoer].sort());
  });
});
