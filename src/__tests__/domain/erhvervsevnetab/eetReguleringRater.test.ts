import {
  resolveAslReguleringRateForAar,
  resolveAslReguleringRateForKapAar,
  resolveAslReguleringRateForSatsAar,
} from '../../../domain/erhvervsevnetab/eetReguleringRater';
import type { EetIssue } from '../../../domain/erhvervsevnetab/eetTypes';

/**
 * Direkte unit-test af reguleringsrate-opslaget.
 *
 * Tidligere var disse funktioner kun dækket integrationstest gennem
 * kapitaliserings- og løbende-ydelses-beregningerne. Den centrale invariant —
 * at år 2024 KUN special-behandles (faktor 1) for skader før 2024-07-01, og
 * ellers slår op i Fra2024-tabellen — testes her isoleret.
 *
 * Værdierne stammer fra `reguleringsprocentErhvervsevnetab` (≤2023) og
 * `reguleringsprocentErhvervsevnetabFra2024` (≥2024) i lovbestemteRates.ts.
 */

describe('resolveAslReguleringRateForAar', () => {
  describe('skade før 2024-07-01 (before2024Skade = true)', () => {
    it('år ≤ 2023 bruger det tidligere indeks', () => {
      const issues: EetIssue[] = [];
      // 2023 → 60,1 %
      const result = resolveAslReguleringRateForAar(2023, true, issues, 'id');
      expect(result).toEqual({ factor: 1 + 60.1 / 100, reguleringPct: 60.1 });
      expect(issues).toHaveLength(0);
    });

    it('år === 2024 er referenceår: faktor 1, reguleringPct 0', () => {
      const issues: EetIssue[] = [];
      const result = resolveAslReguleringRateForAar(2024, true, issues, 'id');
      expect(result).toEqual({ factor: 1, reguleringPct: 0 });
      expect(issues).toHaveLength(0);
    });

    it('år > 2024 bruger Fra2024-indekset', () => {
      const issues: EetIssue[] = [];
      // 2025 → 3,9 %
      const result = resolveAslReguleringRateForAar(2025, true, issues, 'id');
      expect(result).toEqual({ factor: 1 + 3.9 / 100, reguleringPct: 3.9 });
      expect(issues).toHaveLength(0);
    });

    it('manglende sats for år ≤ 2023 producerer blokerende issue og null', () => {
      const issues: EetIssue[] = [];
      const result = resolveAslReguleringRateForAar(2004, true, issues, 'min-id');
      expect(result).toBeNull();
      expect(issues).toEqual([
        { id: 'min-id', severity: 'error', message: 'Reguleringssats mangler for år 2004' },
      ]);
    });

    it('manglende sats for år > 2024 producerer blokerende issue og null', () => {
      const issues: EetIssue[] = [];
      const result = resolveAslReguleringRateForAar(2099, true, issues, 'min-id');
      expect(result).toBeNull();
      expect(issues).toHaveLength(1);
      expect(issues[0]!.severity).toBe('error');
    });
  });

  describe('skade fra 2024-07-01 (before2024Skade = false)', () => {
    it('år 2024 special-behandles IKKE — slår op i Fra2024 (0,0 %)', () => {
      const issues: EetIssue[] = [];
      const result = resolveAslReguleringRateForAar(2024, false, issues, 'id');
      // Fra2024[2024] = 0,0 → faktor 1, men reguleringPct = 0 fra TABELLEN, ikke referenceårs-reglen.
      expect(result).toEqual({ factor: 1, reguleringPct: 0.0 });
      expect(issues).toHaveLength(0);
    });

    it('år 2025 bruger Fra2024-indekset uanset before2024Skade', () => {
      const issues: EetIssue[] = [];
      const result = resolveAslReguleringRateForAar(2025, false, issues, 'id');
      expect(result).toEqual({ factor: 1 + 3.9 / 100, reguleringPct: 3.9 });
    });

    it('år ≤ 2023 findes IKKE i Fra2024 → blokerende issue og null', () => {
      const issues: EetIssue[] = [];
      const result = resolveAslReguleringRateForAar(2023, false, issues, 'id');
      expect(result).toBeNull();
      expect(issues).toHaveLength(1);
    });
  });

  it('invariant: 2024-special-behandling adskiller before2024Skade fra ikke-before for år 2023', () => {
    // Samme år (2023), forskellig skade-flag → forskelligt resultat. Dette er kerne-invarianten.
    const beforeIssues: EetIssue[] = [];
    const afterIssues: EetIssue[] = [];
    const before = resolveAslReguleringRateForAar(2023, true, beforeIssues, 'id');
    const after = resolveAslReguleringRateForAar(2023, false, afterIssues, 'id');
    expect(before).not.toBeNull();
    expect(after).toBeNull();
  });
});

describe('resolveAslReguleringRateForKapAar / resolveAslReguleringRateForSatsAar', () => {
  it('KapAar bruger issue-id uden år-suffiks ved manglende sats', () => {
    const issues: EetIssue[] = [];
    resolveAslReguleringRateForKapAar(2004, true, issues);
    expect(issues[0]!.id).toBe('reguleringssats-missing');
  });

  it('SatsAar bruger år-suffikset issue-id ved manglende sats', () => {
    const issues: EetIssue[] = [];
    resolveAslReguleringRateForSatsAar(2004, true, issues);
    expect(issues[0]!.id).toBe('reguleringssats-missing-2004');
  });

  it('begge wrappere giver samme faktor for et gyldigt år', () => {
    const kapResult = resolveAslReguleringRateForKapAar(2025, true, []);
    const satsResult = resolveAslReguleringRateForSatsAar(2025, true, []);
    expect(kapResult).toEqual(satsResult);
  });
});
