import type { AarsloenTableRow } from '../../schemas/formSchemas';
import { createDate } from '../dateUtils';
import { beregnDagPeriode, beregnPeriodiseringsDage, beregnUgePeriode, erNoejagtEtAar } from '../periodeBeregning';

const formatIso = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildIsoSet = (start: Date, end: Date): Set<string> => {
  const set = new Set<string>();
  const current = new Date(start.getTime());
  while (current <= end) {
    set.add(formatIso(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return set;
};

describe('periodeBeregning', () => {
  it('beregnDagPeriode counts inclusive days across DST', () => {
    const rows: AarsloenTableRow[] = [
      { id: 'row-1', col0_dag: '26-01-2024', col1_dag: '20-10-2024' },
    ];
    const result = beregnDagPeriode(rows);
    expect(result?.totalEnheder).toBe(269);
    expect(result?.unikkeEnheder).toBe(269);
  });

  it('erNoejagtEtAar accepts a full leap year in day periods', () => {
    const datoSet = buildIsoSet(createDate(2024, 0, 1), createDate(2024, 11, 31));
    expect(erNoejagtEtAar('dag', datoSet.size, datoSet)).toBe(true);
  });

  it('beregnPeriodiseringsDage counts kalenderdage inclusively across DST', () => {
    const days = beregnPeriodiseringsDage('30-03-2024', '02-04-2024', 'kalenderdage');
    expect(days).toBe(4);
  });

  it('beregnUgePeriode counts week 53 when crossing year boundary', () => {
    const rows: AarsloenTableRow[] = [{ id: 'row-1', col0_uge: '52/2020', col1_uge: '01/2021' }];
    const result = beregnUgePeriode(rows);
    expect(result?.totalEnheder).toBe(3);
    expect(result?.unikkeEnheder).toBe(3);
  });

  it('beregnUgePeriode handles start week 53 at year boundary', () => {
    const rows: AarsloenTableRow[] = [{ id: 'row-1', col0_uge: '53/2020', col1_uge: '01/2021' }];
    const result = beregnUgePeriode(rows);
    expect(result?.totalEnheder).toBe(2);
    expect(result?.unikkeEnheder).toBe(2);
  });
});
