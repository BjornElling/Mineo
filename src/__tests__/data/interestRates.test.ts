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

  it('effectiveDate er ISO datoformat (åååå-mm-dd)', () => {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    for (const entry of referenceRates) {
      expect(entry.effectiveDate).toMatch(ISO_DATE);
    }
  });

  it('er sorteret strengt nyeste først', () => {
    // Tabellen er kontraktuelt nyeste-først (MIN_INTEREST_DATE udledes af sidste
    // element). ISO-strenge (åååå-mm-dd) er leksikografisk sammenlignelige som datoer,
    // så streng faldende orden fanger en fejlsortering ved manuel redigering.
    for (let i = 1; i < referenceRates.length; i++) {
      expect(referenceRates[i].effectiveDate < referenceRates[i - 1].effectiveDate).toBe(true);
    }
  });

  it('dækker fra mindst 2005', () => {
    // Der bør være entries for 2005
    const has2005 = referenceRates.some(e => e.effectiveDate.startsWith('2005'));
    expect(has2005).toBe(true);
  });

  it('indeholder kendte sats-værdier', () => {
    // 2026-01-01: 1.75 % (fra tabellen)
    const entry2026 = referenceRates.find(e => e.effectiveDate === '2026-01-01');
    expect(entry2026).toBeDefined();
    expect(entry2026?.ratePct).toBeCloseTo(1.75, 5);
  });

  it('har kun halvårets første dag som effektiv dato', () => {
    for (const entry of referenceRates) {
      expect(['01-01', '07-01']).toContain(entry.effectiveDate.slice(5));
    }
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
    const entry = surchargeRates.find(e => e.effectiveDate === '2013-03-01');
    expect(entry).toBeDefined();
    expect(entry?.ratePct).toBe(8.0);
  });
});

describe('MIN_INTEREST_DATE', () => {
  it('er 2005-01-01', () => {
    expect(MIN_INTEREST_DATE).toBe(toISODateString('2005-01-01'));
  });
});
