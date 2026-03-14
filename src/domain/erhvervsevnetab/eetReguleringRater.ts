import {
  reguleringsprocentErhvervsevnetab,
  reguleringsprocentErhvervsevnetabFra2024,
} from '../../data/regulationRates';

export type AslReguleringRateInfo = Readonly<{
  factor: number;
  reguleringPct: number;
}>;

type Issue = Readonly<{ id: string; severity: 'error' | 'warning'; message: string }>;

/**
 * Fælles kerne for reguleringsrate-opslag.
 *
 * Logik:
 * - Skader FØR 2024-07-01 (before2024Skade):
 *   - År ≤ 2023: brug reguleringsprocentErhvervsevnetab (det historiske indeks)
 *   - År === 2024: faktor 1 (2024 er referenceår; selve 2024-opreguleringen anvendes separat på grundydelsen)
 *   - År > 2024: brug reguleringsprocentErhvervsevnetabFra2024
 * - Skader FRA 2024-07-01: brug reguleringsprocentErhvervsevnetabFra2024 for alle år
 *
 * issueId: bruges som issue-ID ved manglende sats. Kald med 'reguleringssats-missing' for
 * kapitaliseringsberegninger (fane 3 og 5) og `reguleringssats-missing-${year}` for løbende
 * ydelsesberegninger (fane 2), hvor hvert år har sit eget blokerende issue.
 */
export const resolveAslReguleringRateForAar = (
  year: number,
  before2024Skade: boolean,
  issues: Issue[],
  issueId: string
): AslReguleringRateInfo | null => {
  if (before2024Skade) {
    if (year <= 2023) {
      const pct = reguleringsprocentErhvervsevnetab[year];
      if (!Number.isFinite(pct)) {
        issues.push({ id: issueId, severity: 'error', message: `Reguleringssats mangler for år ${year}` });
        return null;
      }
      return { factor: 1 + pct / 100, reguleringPct: pct };
    }
    if (year === 2024) {
      return { factor: 1, reguleringPct: 0 };
    }
    const pct = reguleringsprocentErhvervsevnetabFra2024[year];
    if (!Number.isFinite(pct)) {
      issues.push({ id: issueId, severity: 'error', message: `Reguleringssats mangler for år ${year}` });
      return null;
    }
    return { factor: 1 + pct / 100, reguleringPct: pct };
  }
  const pct = reguleringsprocentErhvervsevnetabFra2024[year];
  if (!Number.isFinite(pct)) {
    issues.push({ id: issueId, severity: 'error', message: `Reguleringssats mangler for år ${year}` });
    return null;
  }
  return { factor: 1 + pct / 100, reguleringPct: pct };
};

/**
 * Reguleringsrate for kapitaliseringsberegninger (fane 3 og 5).
 * Issue-ID er 'reguleringssats-missing' (uden år-suffiks) — samme issue for alle år.
 */
export const resolveAslReguleringRateForKapAar = (
  kapitaliseringsaar: number,
  before2024Skade: boolean,
  issues: Issue[]
): AslReguleringRateInfo | null =>
  resolveAslReguleringRateForAar(kapitaliseringsaar, before2024Skade, issues, 'reguleringssats-missing');

/**
 * Reguleringsrate for løbende ydelsesberegninger (fane 2).
 * Issue-ID er 'reguleringssats-missing-${year}' (med år-suffiks) — hvert år har sit eget blokerende issue,
 * så beregningen kan rapportere præcist hvilket år der mangler sats for.
 */
export const resolveAslReguleringRateForSatsAar = (
  year: number,
  before2024Skade: boolean,
  issues: Issue[]
): AslReguleringRateInfo | null =>
  resolveAslReguleringRateForAar(year, before2024Skade, issues, `reguleringssats-missing-${year}`);
