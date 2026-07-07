import {
  assertSortedByStartIso,
  findLatestByDateInSortedList,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringSeriesLookup';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const entry = (startIso: string, value: number) => ({ startIso: iso(startIso), value });

describe('findLatestByDateInSortedList', () => {
  const series = [entry('2023-01-01', 10), entry('2024-01-01', 20), entry('2025-01-01', 30)];

  it('returnerer den seneste post med startIso <= dato (carry-forward)', () => {
    expect(findLatestByDateInSortedList(series, iso('2024-06-01'), 'test')?.value).toBe(20);
  });

  it('rammer posten eksakt på dens startdato', () => {
    expect(findLatestByDateInSortedList(series, iso('2025-01-01'), 'test')?.value).toBe(30);
  });

  it('viderefører seneste post for datoer efter sidste post', () => {
    expect(findLatestByDateInSortedList(series, iso('2030-12-31'), 'test')?.value).toBe(30);
  });

  it('returnerer undefined når datoen ligger før første post', () => {
    expect(findLatestByDateInSortedList(series, iso('2022-12-31'), 'test')).toBeUndefined();
  });

  it('returnerer undefined for en tom serie', () => {
    expect(findLatestByDateInSortedList([], iso('2024-01-01'), 'test')).toBeUndefined();
  });

  it('vælger den sidst placerede post ved lige startIso (fx basis + række på samme dato)', () => {
    // Lige startdatoer er tilladt; den sidste i rækkefølgen vinder (bevidst for manuel procentsats,
    // hvor en række dateret præcis på basisdatoen ligger efter basis-entryen og gælder fra dag ét).
    const withDuplicate = [entry('2024-01-01', 100), entry('2024-01-01', 105)];
    expect(findLatestByDateInSortedList(withDuplicate, iso('2024-01-01'), 'test')?.value).toBe(105);
  });

  it('kaster på usorteret serie frem for at returnere et forkert (tavst) opslag', () => {
    const unsorted = [entry('2025-01-01', 30), entry('2023-01-01', 10)];
    expect(() => findLatestByDateInSortedList(unsorted, iso('2024-06-01'), 'usorteret')).toThrow(
      /usorteret startdato-liste \(usorteret\)/
    );
  });
});

describe('assertSortedByStartIso', () => {
  it('accepterer ikke-aftagende (inkl. lige) startdatoer', () => {
    expect(() =>
      assertSortedByStartIso([entry('2023-01-01', 1), entry('2023-01-01', 2), entry('2024-01-01', 3)], 'test')
    ).not.toThrow();
  });

  it('kaster ved aftagende startdato', () => {
    expect(() => assertSortedByStartIso([entry('2024-01-01', 1), entry('2023-01-01', 2)], 'test')).toThrow(
      /usorteret startdato-liste/
    );
  });
});
