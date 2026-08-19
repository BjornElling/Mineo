import {
  assertSortedByDateKey,
  assertSortedByStartIso,
  findLatestByDateInSortedList,
  findLatestByDateKeyInSortedList,
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

/**
 * Nøglevælger-formen (greenfield #35). Den findes, fordi to serier med PRÆCIS samme
 * carry-forward-semantik bar datoen under et andet feltnavn (`startDato` i de manuelle
 * lønudviklings-rækker, `dato`/`iso` i inspektionens indeksrækker) og derfor havde
 * overlevet den første konsolidering som hver sin re-derivation.
 */
describe('findLatestByDateKeyInSortedList', () => {
  const keyed = (startDato: string, value: number) => ({ startDato: iso(startDato), value });
  const getStartDato = (item: Readonly<{ startDato: ReturnType<typeof iso> }>) => item.startDato;
  const series = [keyed('2023-01-01', 10), keyed('2024-01-01', 20), keyed('2025-01-01', 30)];

  it('slår op på et vilkårligt datofeltnavn med samme carry-forward-semantik', () => {
    expect(findLatestByDateKeyInSortedList(series, iso('2024-06-01'), getStartDato, 'test')?.value).toBe(20);
    expect(findLatestByDateKeyInSortedList(series, iso('2025-01-01'), getStartDato, 'test')?.value).toBe(30);
    expect(findLatestByDateKeyInSortedList(series, iso('2030-12-31'), getStartDato, 'test')?.value).toBe(30);
  });

  it('returnerer undefined før første post og for en tom serie', () => {
    expect(findLatestByDateKeyInSortedList(series, iso('2022-12-31'), getStartDato, 'test')).toBeUndefined();
    expect(findLatestByDateKeyInSortedList([], iso('2024-01-01'), getStartDato, 'test')).toBeUndefined();
  });

  it('vælger den sidst placerede post ved lige datoer – samme tie-break som startIso-formen', () => {
    const withDuplicate = [keyed('2024-01-01', 100), keyed('2024-01-01', 105)];
    expect(findLatestByDateKeyInSortedList(withDuplicate, iso('2024-01-01'), getStartDato, 'test')?.value).toBe(105);
  });

  it('kaster på usorteret serie – invarianten følger med til nøglevælger-formen', () => {
    const unsorted = [keyed('2025-01-01', 30), keyed('2023-01-01', 10)];
    expect(() => findLatestByDateKeyInSortedList(unsorted, iso('2024-06-01'), getStartDato, 'usorteret')).toThrow(
      /usorteret startdato-liste \(usorteret\)/
    );
  });

  it('giver samme svar som startIso-formen for den samme serie', () => {
    // Beviser at den ergonomiske form ER kernen med en fast nøglevælger – ikke en
    // parallel implementering der kan drive fra den.
    const dates = ['2022-12-31', '2023-01-01', '2023-06-15', '2024-01-01', '2031-01-01'];
    for (const date of dates) {
      const viaStartIso = findLatestByDateInSortedList(
        series.map((item) => ({ startIso: item.startDato, value: item.value })),
        iso(date),
        'test'
      );
      const viaKey = findLatestByDateKeyInSortedList(series, iso(date), getStartDato, 'test');
      expect(viaKey?.value).toBe(viaStartIso?.value);
    }
  });

  it('assertSortedByDateKey accepterer ikke-aftagende og kaster ved aftagende', () => {
    expect(() => assertSortedByDateKey(series, getStartDato, 'test')).not.toThrow();
    expect(() =>
      assertSortedByDateKey([keyed('2024-01-01', 1), keyed('2023-01-01', 2)], getStartDato, 'test')
    ).toThrow(/usorteret startdato-liste/);
  });
});
