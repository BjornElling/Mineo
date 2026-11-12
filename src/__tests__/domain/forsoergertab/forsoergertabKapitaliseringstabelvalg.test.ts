import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { computeForsoergertabAslYdelser } from '../../../domain/forsoergertab/forsoergertabAslYdelser';
import { toISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

/**
 * Forsørgertabets tabelvalg kommer udelukkende fra kapitaliseringskildens `forsoergertabTabelvalg`. De tre
 * tilfælde herunder blokerede tidligere, fordi tabellerne manglede i registret eller kun kunne vælges via en
 * hardcodet liste i domænekoden.
 */
describe('forsørgertab – tabelvalg fra kapitaliseringskilden', () => {
  it('bruger tabel N i BEK 1403/2011 for en skade fra 2004-2007 kapitaliseret i 2012', () => {
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2005-06-01'),
      beregningsdato: toISODateString('2012-06-01'),
      virkningsdato: toISODateString('2012-06-01'),
      efterladteFodselsdato: toISODateString('1970-01-01'),
      koen: 'Kvinde',
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(300000),
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.kapitaliseringsTabel).toBe('N');
    // Tabel N (kvinder), fyldt alder 42, restperiode 9 år og 11 mdr.: 6,018 + 11/12 × (6,415 − 6,018).
    expect(result.computation?.kapitalfaktor).toBe(6.382);
  });

  it('bruger forsørgertabstabel F fra BEK 1339/2013 for kapitalisering i 2014 (via BEK 229/2014)', () => {
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2011-06-01'),
      beregningsdato: toISODateString('2014-06-02'),
      virkningsdato: toISODateString('2014-06-02'),
      efterladteFodselsdato: toISODateString('1980-01-01'),
      koen: 'Mand',
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(300000),
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.kapitaliseringsTabel).toBe('F');
    // Tabel F (mænd), fyldt alder 34, restperiode 9 år og 11 mdr.: 5,422 + 11/12 × (5,997 − 5,422).
    expect(result.computation?.kapitalfaktor).toBe(5.949);
  });

  it('interpolerer mellem de udvalgte aldre i BEK 1068/2003 tabel D (§ 3)', () => {
    const result = computeForsoergertabAslYdelser({
      skadedato: toISODateString('2005-06-01'),
      beregningsdato: toISODateString('2006-06-01'),
      virkningsdato: toISODateString('2006-06-01'),
      efterladteFodselsdato: toISODateString('1984-01-01'),
      koen: 'Mand',
      tilkendtForPeriodeAar: 10,
      aslAarsloen: asAmount(300000),
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.kapitaliseringsTabel).toBe('D');
    // Fyldt alder 22 ligger mellem 20 og 25: 9 restår 6,053 → 6,051 og 10 restår 6,457 → 6,4546;
    // restperiode 9 år og 11 mdr.: 6,051 + 11/12 × (6,4546 − 6,051).
    expect(result.computation?.kapitalfaktor).toBe(6.421);
  });
});
