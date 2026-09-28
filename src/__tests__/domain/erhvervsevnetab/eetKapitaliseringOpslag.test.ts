import { getKapitaliseringsTabelData } from '../../../data/kapitalisering/kapitaliseringsTabeller';
import {
  interpolateFactorBeyondTable,
  resolveFactorTable,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringOpslag';

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
  });
});
