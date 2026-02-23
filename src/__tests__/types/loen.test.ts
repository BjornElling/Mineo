import { describe, expect, it } from 'vitest';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE } from '../../types/loen';
import type { Loenperiode, LoenPaaHelligdage } from '../../types/loen';

describe('LOENPERIODE', () => {
  it('har de tre forventede nøgler', () => {
    expect(LOENPERIODE.MAANED).toBe('maaned');
    expect(LOENPERIODE.UGE).toBe('uge');
    expect(LOENPERIODE.DAG).toBe('dag');
  });

  it('alle værdier er unikke', () => {
    const values = Object.values(LOENPERIODE);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('matcher Loenperiode-typen', () => {
    // Statisk type-check: disse assignments skal kompilere
    const a: Loenperiode = LOENPERIODE.MAANED;
    const b: Loenperiode = LOENPERIODE.UGE;
    const c: Loenperiode = LOENPERIODE.DAG;
    expect([a, b, c]).toHaveLength(3);
  });
});

describe('LOEN_PAA_HELLIGDAGE', () => {
  it('har de tre forventede nøgler', () => {
    expect(LOEN_PAA_HELLIGDAGE.ALMINDELIG).toBe('Almindelig løn');
    expect(LOEN_PAA_HELLIGDAGE.SH_UDBETALING).toBe('SH-udbetaling');
    expect(LOEN_PAA_HELLIGDAGE.INGEN).toBe('Ingen');
  });

  it('alle værdier er unikke', () => {
    const values = Object.values(LOEN_PAA_HELLIGDAGE);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('matcher LoenPaaHelligdage-typen', () => {
    const a: LoenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;
    const b: LoenPaaHelligdage = LOEN_PAA_HELLIGDAGE.SH_UDBETALING;
    const c: LoenPaaHelligdage = LOEN_PAA_HELLIGDAGE.INGEN;
    expect([a, b, c]).toHaveLength(3);
  });
});
