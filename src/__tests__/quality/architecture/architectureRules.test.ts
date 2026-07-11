import { ARCHITECTURE_RULES } from './architectureRules';
import { formatViolations } from './ruleKit';
import { getSourceGraph, makeSyntheticEntry } from './sourceGraph';

/**
 * Kør-motor + selvtest for det AST-baserede arkitektur-harness (greenfield #48).
 *
 * Ét sted håndhæver:
 *   1. at kilde-grafen ikke overtræder nogen regel,
 *   2. at hver regel IKKE er inert (positive fixtures flages, rene fixtures ikke) —
 *      vacuous-pass-værnet, generaliseret ud af de per-guard håndrullede selvtests,
 *   3. at hver allowlist er anti-rot-fri (hver undtagelse udløser stadig reglen).
 */

describe('architectureRules — AST-baseret arkitekturgrænse-harness', () => {
  it('manifestet er velformet (unikke regel-id, fixtures til stede)', () => {
    const ids = ARCHITECTURE_RULES.map((rule) => rule.id);
    expect(new Set(ids).size, `Regel-id skal være unikke: ${ids.join(', ')}`).toBe(ids.length);

    for (const rule of ARCHITECTURE_RULES) {
      expect(rule.violatingFixtures.length, `${rule.id} mangler en overtrædende fixture`).toBeGreaterThan(0);
      expect(rule.cleanFixtures.length, `${rule.id} mangler en ren fixture`).toBeGreaterThan(0);
    }
  });

  it('ingen arkitektur-overtrædelser i kilde-grafen', { timeout: 30000 }, () => {
    const entries = getSourceGraph();
    const violations = ARCHITECTURE_RULES.flatMap((rule) => rule.evaluate(entries));

    expect(
      violations,
      violations.length > 0 ? `\n${formatViolations(violations)}` : undefined
    ).toEqual([]);
  });

  describe.each(ARCHITECTURE_RULES.map((rule) => [rule.id, rule] as const))(
    'regel %s er ikke inert',
    (_id, rule) => {
      it('flager hver overtrædende fixture', () => {
        for (const fixture of rule.violatingFixtures) {
          const entry = makeSyntheticEntry(fixture.relativePath, fixture.code);
          expect(
            rule.evaluate([entry]).length,
            `${rule.id} burde have flaget: ${fixture.code}`
          ).toBeGreaterThan(0);
        }
      });

      it('flager ingen ren fixture', () => {
        for (const fixture of rule.cleanFixtures) {
          const entry = makeSyntheticEntry(fixture.relativePath, fixture.code);
          expect(
            rule.evaluate([entry]),
            `${rule.id} burde IKKE have flaget: ${fixture.code}`
          ).toEqual([]);
        }
      });
    }
  );

  it('anti-rot: hver allowlist-post udløser stadig sin regel', () => {
    const entries = getSourceGraph();
    const byPath = new Map(entries.map((entry) => [entry.relativePath, entry]));
    const stale: string[] = [];

    for (const rule of ARCHITECTURE_RULES) {
      if (!rule.antiRot) continue;
      for (const allowedPath of rule.allow) {
        const entry = byPath.get(allowedPath);
        if (!entry) {
          stale.push(`${rule.id}: allowlist-fil findes ikke i grafen: ${allowedPath}`);
          continue;
        }
        if (rule.findInFile(entry).length === 0) {
          stale.push(`${rule.id}: allowlist-fil udløser ikke længere reglen (fjern den): ${allowedPath}`);
        }
      }
    }

    expect(stale).toEqual([]);
  });
});
