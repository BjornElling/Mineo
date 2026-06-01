import { referenceRates, surchargeRates, MIN_INTEREST_DATE } from '../../data/interestRates';
import { toISODateString } from '../../types/branded';

describe('referenceRates', () => {
  it('er ikke tom', () => {
    expect(referenceRates.length).toBeGreaterThan(0);
  });

  it('alle entries har effectiveDate og ratePct', () => {
    for (const entry of referenceRates) {
      expect(entry.effectiveDate).toBeTruthy();
      expect(typeof entry.ratePct).toBe('number');
      expect(Number.isFinite(entry.ratePct)).toBe(true);
    }
  });

  it('effectiveDate er dansk datoformat (dd-mm-åååå)', () => {
    const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;
    for (const entry of referenceRates) {
      expect(entry.effectiveDate).toMatch(DANISH_DATE);
    }
  });

  it('er sorteret strengt nyeste først', () => {
    // Tabellen er kontraktuelt nyeste-først (MIN_INTEREST_DATE udledes af sidste
    // element). Konvertér dd-mm-åååå → sammenligneligt tal og bekræft streng faldende
    // orden, så en fejlsortering ved manuel redigering fanges af testen.
    const toNum = (d: string): number => {
      const [day, month, year] = d.split('-');
      return Number(`${year}${month}${day}`);
    };
    for (let i = 1; i < referenceRates.length; i++) {
      expect(toNum(referenceRates[i].effectiveDate)).toBeLessThan(
        toNum(referenceRates[i - 1].effectiveDate)
      );
    }
  });

  it('dækker fra mindst 2005', () => {
    // Der bør være entries for 2005
    const has2005 = referenceRates.some(e => e.effectiveDate.endsWith('2005'));
    expect(has2005).toBe(true);
  });

  it('indeholder kendte sats-værdier', () => {
    // 01-01-2026: 1.75 % (fra tabellen)
    const entry2026 = referenceRates.find(e => e.effectiveDate === '01-01-2026');
    expect(entry2026).toBeDefined();
    expect(entry2026?.ratePct).toBeCloseTo(1.75, 5);
  });
});

describe('surchargeRates', () => {
  it('er ikke tom', () => {
    expect(surchargeRates.length).toBeGreaterThan(0);
  });

  it('alle entries er gyldige', () => {
    for (const entry of surchargeRates) {
      expect(entry.effectiveDate).toBeTruthy();
      expect(Number.isFinite(entry.ratePct)).toBe(true);
    }
  });

  it('indeholder 8% sats fra 2013', () => {
    const entry = surchargeRates.find(e => e.effectiveDate === '01-03-2013');
    expect(entry).toBeDefined();
    expect(entry?.ratePct).toBe(8.0);
  });
});

describe('MIN_INTEREST_DATE', () => {
  it('er 2005-01-01', () => {
    expect(MIN_INTEREST_DATE).toBe(toISODateString('2005-01-01'));
  });
});
