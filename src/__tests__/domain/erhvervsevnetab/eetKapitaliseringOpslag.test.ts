import { getKapitaliseringsTabelData } from '../../../data/kapitalisering/kapitaliseringsTabeller';
import {
  calculateAgeYearsMonths,
  interpolateFactorBeyondTable,
  interpolateFactorWithinTable,
  isUnderOrEqualTwoYearsToFpByBekendtgoerelse,
  resolveFactorTable,
  resolveKapitaliseringTabelvalg,
  resolveKapitaliseringTabelvalgForControlDate,
  resolveSaerfaktor,
  type AgeYearsMonths,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringOpslag';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const age = (years: number, months: number): AgeYearsMonths => ({
  years,
  months,
  totalMonths: years * 12 + months,
});

describe('eetKapitaliseringOpslag', () => {
  it('interpolerer ikke-månedsafhængig faktor mellem sidste tabelalder og særfaktorgrænsen', () => {
    const rows = [{ alder: 64, faktor: 1 }];

    expect(interpolateFactorBeyondTable(
      rows,
      { years: 64, months: 0, totalMonths: 768 },
      840,
      2,
      false
    )).toBe(1);
    expect(interpolateFactorBeyondTable(
      rows,
      { years: 66, months: 0, totalMonths: 792 },
      840,
      2,
      false
    )).toBe(1.5);
    expect(interpolateFactorBeyondTable(
      rows,
      { years: 68, months: 0, totalMonths: 816 },
      840,
      2,
      false
    )).toBe(2);
  });

  it('rapporterer manglende køn for en kønsopdelt kapitaliseringstabel', () => {
    const tableData = getKapitaliseringsTabelData('678/2007');
    if (tableData === undefined) throw new Error('Forventede historiske kapitaliseringsdata');

    expect(resolveFactorTable(tableData, 'A', undefined)).toEqual({
      rows: null,
      reason: 'missing-koen',
      koenOpdelt: true,
    });
  });

  it('mapper kvindefaktoren fra en kønsopdelt kapitaliseringstabel', () => {
    const tableData = getKapitaliseringsTabelData('678/2007');
    if (tableData === undefined) throw new Error('Forventede historiske kapitaliseringsdata');

    const result = resolveFactorTable(tableData, 'A', 'Kvinde');
    expect(result.reason).toBeNull();
    expect(result.koenOpdelt).toBe(true);
    expect(result.rows?.[0]).toEqual({ alder: 5, faktor: 27.626 });
    const maleResult = resolveFactorTable(tableData, 'A', 'Mand');
    expect(maleResult.rows?.[0]).toEqual({ alder: 5, faktor: 27.321 });
  });

  it('vælger en simpel tabel og fail-closer ved en ukendt tabel', () => {
    const tableData = getKapitaliseringsTabelData('10056/2025');
    if (tableData === undefined) throw new Error('Forventede historiske kapitaliseringsdata');

    const simpleTableResult = resolveFactorTable(tableData, 'A', 'Mand');
    expect(simpleTableResult.reason).toBeNull();
    expect(simpleTableResult.koenOpdelt).toBe(false);
    expect(simpleTableResult.rows?.[0]).toEqual({ alder: 5, faktor: 64.938 });
    expect(resolveFactorTable(tableData, 'MANGLER', 'Mand')).toEqual({
      rows: null,
      reason: 'missing-table',
      koenOpdelt: false,
    });
  });
});

describe('eetKapitaliseringOpslag – alders- og interpolationsgrænser', () => {
  it('beregner alder med og uden fødselsdag og afviser en reference før fødsel', () => {
    expect(calculateAgeYearsMonths(iso('1974-02-28'), iso('2015-12-29'))).toEqual({
      years: 41,
      months: 10,
      totalMonths: 502,
    });
    expect(calculateAgeYearsMonths(iso('1980-06-15'), iso('2024-06-14'))).toEqual({
      years: 43,
      months: 11,
      totalMonths: 527,
    });
    expect(calculateAgeYearsMonths(iso('1980-06-15'), iso('1980-06-14'))).toBeNull();
  });

  it('håndterer tomme rækker, tabelgrænser og månedsinterpolation', () => {
    const rows = [
      { alder: 40, faktor: 10 },
      { alder: 41, faktor: 9 },
    ] as const;

    expect(interpolateFactorWithinTable([], age(40, 0), true)).toBeNull();
    expect(interpolateFactorWithinTable(rows, age(39, 0), true)).toBeNull();
    expect(interpolateFactorWithinTable(rows, age(42, 0), true)).toBeNull();
    expect(interpolateFactorWithinTable(rows, age(40, 3), true)).toBe(9.75);
    expect(interpolateFactorWithinTable(rows, age(40, 3), false)).toBe(10);
    expect(interpolateFactorWithinTable(rows, age(41, 0), true)).toBe(9);
    expect(interpolateFactorWithinTable(rows, age(41, 1), true)).toBeNull();
  });

  it('returnerer null for en manglende mellemårsrække', () => {
    expect(interpolateFactorWithinTable(
      [{ alder: 40, faktor: 10 }, { alder: 42, faktor: 8 }],
      age(40, 6),
      true
    )).toBeNull();
  });

  it('dækker månedsafhængig ekstrapolation og fail-closed grænse', () => {
    const rows = [{ alder: 64, faktor: 1 }];

    expect(interpolateFactorBeyondTable([], age(65, 0), 840, 2, true)).toBeNull();
    expect(interpolateFactorBeyondTable(rows, age(65, 0), 756, 2, true)).toBeNull();
    expect(interpolateFactorBeyondTable(rows, age(64, 0), 840, 2, true)).toBe(1);
    expect(interpolateFactorBeyondTable(rows, age(66, 0), 840, 2, true)).toBe(1.5);
    expect(interpolateFactorBeyondTable(rows, age(68, 0), 840, 2, true)).toBe(2);
  });
});

describe('eetKapitaliseringOpslag – særfaktor og kontrolopslag', () => {
  it('vælger den tidligste moderne tabel for en fødselsdato før minimumsårgangen', () => {
    const tableData = getKapitaliseringsTabelData('10056/2025');
    if (tableData === undefined) throw new Error('Forventede moderne kapitaliseringsdata');

    expect(resolveKapitaliseringTabelvalg(
      tableData,
      iso('2021-01-01'),
      iso('1900-01-01'),
      iso('2026-01-01')
    )).toEqual({
      tabel: 'D',
      folkepensionsalderMaaneder: 780,
      folkepensionsalderLabel: '65 år',
      usesKoen: false,
    });
  });

  it('vælger seneste særfaktor og afviser dato før første interval', () => {
    const tableData = getKapitaliseringsTabelData('10056/2025');
    if (tableData === undefined) throw new Error('Forventede historiske kapitaliseringsdata');

    expect(resolveSaerfaktor(tableData, iso('2021-01-01'))).toBe(1.246);
    expect(resolveSaerfaktor(tableData, iso('2011-01-01'))).toBe(1.246);
    expect(resolveSaerfaktor(tableData, iso('2006-12-31'))).toBeNull();
  });

  it('resolver et kontrolopslag og fail-closer ved manglende kontrolinput', () => {
    expect(resolveKapitaliseringTabelvalgForControlDate(undefined, iso('1972-01-08'), iso('2021-01-01')))
      .toBeNull();
    expect(resolveKapitaliseringTabelvalgForControlDate(iso('1900-01-01'), iso('1972-01-08'), iso('2021-01-01')))
      .toBeNull();

    const result = resolveKapitaliseringTabelvalgForControlDate(
      iso('2007-07-01'),
      iso('1972-01-08'),
      iso('2021-01-01')
    );
    expect(result).toEqual({
      tabel: 'A',
      folkepensionsalderMaaneder: 828,
      folkepensionsalderLabel: '69 år',
      usesKoen: false,
    });
  });

  it('fastholder kontrolgrænsen på højst to år til folkepension', () => {
    expect(isUnderOrEqualTwoYearsToFpByBekendtgoerelse(
      iso('2025-01-01'),
      iso('1959-01-01'),
      iso('2025-07-01')
    )).toBe(true);
    expect(isUnderOrEqualTwoYearsToFpByBekendtgoerelse(
      iso('1900-01-01'),
      iso('1900-01-01'),
      iso('2004-01-01')
    )).toBe(false);
  });
});
