import type { AarsloenTableRow } from '../../types/common';
import { beregnDagPeriode, beregnPeriodiseringsDage, erNoejagtEtAar } from '../periodeBeregning';

const formatIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildIsoSet = (start: Date, end: Date): Set<string> => {
  const set = new Set<string>();
  const current = new Date(start.getTime());
  while (current <= end) {
    set.add(formatIso(current));
    current.setDate(current.getDate() + 1);
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
    const datoSet = buildIsoSet(new Date(2024, 0, 1), new Date(2024, 11, 31));
    expect(erNoejagtEtAar('dag', datoSet.size, datoSet)).toBe(true);
  });

  it('beregnPeriodiseringsDage counts kalenderdage inclusively across DST', () => {
    const days = beregnPeriodiseringsDage('30-03-2024', '02-04-2024', 'kalenderdage');
    expect(days).toBe(4);
  });
});
