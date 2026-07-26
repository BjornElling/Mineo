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

  // Timeout på 120 s (ikke 30 s): denne case parser AST for hele kilde-grafen (~700 filer,
  // setParentNodes) og kører hver regels tree-walk over sit scope — reelt ~4 s CPU-arbejde lokalt.
  // Under thread-poolen på CI's 2-vCPU-runner konkurrerer det arbejde med parallelle test-workere
  // om kernerne, så wall-clock kan strække sig langt forbi 30 s afhængigt af samtidig belastning
  // (deraf de sporadiske timeouts). Arbejdet er endeligt og cachet — ikke en hængning — så et
  // rundhåndet loft fjerner flakiness uden at skjule en ægte deadlock.
  it('ingen arkitektur-overtrædelser i kilde-grafen', { timeout: 120000 }, () => {
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

  // Anti-rot gælder ALLE regler med en allowlist — uden `antiRot`-opt-in. En allowlist-post, hvis fil er
  // slettet eller ikke længere udløser reglen, er død konfiguration, der stille udvider grænsen næste gang
  // en fil med samme sti opstår. `antiRot: false` findes bevidst ikke: en undtagelse skal kunne bevises.
  // ---------------------------------------------------------------------------
  // Dødt-værn-detektor (Fase 6): har hver regel stadig noget at holde øje med?
  // ---------------------------------------------------------------------------
  //
  // Selvtesten ovenfor beviser, at reglens WALKER virker (fixtures flages). Den beviser IKKE, at
  // reglens mål stadig findes i produktionen. Slettes målet, matcher fixtures fortsat, mens grafen
  // ikke længere indeholder noget, reglen kan udtale sig om — reglen bliver grøn af TOMHED og
  // fremstår som dækning, den ikke leverer. Det er samme fejlklasse som WI-007's inerte AST-værn
  // og WI-008's rene type-brand, og Fase 6 gør princippet maskinelt frem for en vane pr. regel.
  //
  // Da denne detektor blev indført, rapporterede den tre døde værn i manifestet:
  // `pdf/download-committed-state` (Fase 5 slettede alle 18 `download*Dokument`),
  // `form/persisted-styled-field-error-reporter` (trin 13 slettede hele `Styled*Field`-vejen) og
  // `criticalAction/no-dom-scan-or-frame-wait` (scopet `src/criticalActions/` findes ikke).
  // Det var detektorens egen mutationstest: en observeret fejl, ikke en fixture.
  it('dødt værn: hver forudsætningsregel har stadig en fil, den ville kontrollere', { timeout: 120000 }, () => {
    const entries = getSourceGraph();
    const dead: string[] = [];

    for (const rule of ARCHITECTURE_RULES) {
      if (rule.liveTarget.kind !== 'precondition') continue;
      const { probe, rationale, minimumMatches = 1, requiredPaths = [] } = rule.liveTarget;
      const matches = entries.filter((entry) => probe(entry));
      if (matches.length < minimumMatches) {
        dead.push(
          `${rule.id}: INERT — kun ${matches.length} af mindst ${minimumMatches} filer i grafen opfylder `
          + `reglens forudsætning (${rationale}). Omskriv reglen mod det nuværende mål, eller slet den. `
          + 'En regel, hvis eneste bevis er dens egne fixtures, er falsk tryghed.'
        );
      }
      // Sammensatte mål: HVER forudsat fil skal findes og matche. Ellers er reglen halvt død, mens
      // "≥1 hit" fortsat er opfyldt af de overlevende filer.
      const matched = new Set(matches.map((entry) => entry.relativePath));
      for (const requiredPath of requiredPaths) {
        if (!matched.has(requiredPath)) {
          const exists = entries.some((entry) => entry.relativePath === requiredPath);
          dead.push(
            `${rule.id}: målet forudsætter ${requiredPath}, men filen `
            + `${exists ? 'opfylder ikke længere proben' : 'findes ikke i grafen'} (${rationale}).`
          );
        }
      }
    }

    expect(dead).toEqual([]);
  });

  // Fraværsregler: kontrollen er nu GENERISK og obligatorisk, og den kører i BEGGE retninger.
  //
  // Retning 1 (fravær): hvert forbudt navn skal være fraværende i grafen.
  // Retning 2 (prædikatet virker): navnet skal kunne FINDES i en syntetisk fil, der bruger det.
  //   Uden den retning kunne en stavefejl — `useRowDraftz` i stedet for `useRowDrafts` — "bevises
  //   fraværende" lige så let som det rigtige navn, og reglen ville være vakuøst grøn.
  it('dødt værn: hvert forbudt navn er beviseligt fraværende — og prædikatet kan finde det', { timeout: 120000 }, () => {
    const entries = getSourceGraph();
    const problems: string[] = [];

    for (const rule of ARCHITECTURE_RULES) {
      if (rule.liveTarget.kind !== 'absence') continue;
      const { forbids, rationale, verifyAbsent, absenceProbeCode } = rule.liveTarget;
      expect(forbids.length, `${rule.id}: fraværsregel uden forbudte navne`).toBeGreaterThan(0);

      for (const name of forbids) {
        if (!verifyAbsent(name, entries)) {
          problems.push(`${rule.id}: "${name}" findes stadig i grafen (${rationale}).`);
        }
        // Modsat retning: prædikatet SKAL kunne se navnet, når det faktisk bruges.
        const probeEntry = makeSyntheticEntry('src/__absence_probe__.ts', absenceProbeCode(name));
        if (verifyAbsent(name, [probeEntry])) {
          problems.push(
            `${rule.id}: "${name}" kan ikke FINDES af reglens eget prædikat, selv i en fil der bruger det. `
            + 'Fraværet er derfor vakuøst — navnet er sandsynligvis stavet forkert eller hører til en anden art.'
          );
        }
      }
    }

    expect(problems).toEqual([]);
  });

  // Scan-rødder: en regels scope-præfiks skal svare til en mappe, der faktisk findes. Et forældet
  // præfiks er død konfiguration, som stille udvider grænsen igen, hvis en fil med samme sti
  // nogensinde opstår — og som samtidig skjuler, at en mappeflytning har indsnævret et scope.
  it('dødt værn: hver scan-rod svarer til en levende mappe i grafen', { timeout: 120000 }, () => {
    const entries = getSourceGraph();
    const stale: string[] = [];

    for (const rule of ARCHITECTURE_RULES) {
      if (rule.liveTarget.kind !== 'scoped') continue;
      for (const root of rule.liveTarget.roots) {
        const prefix = root.endsWith('/') ? root : `${root}/`;
        const covers = entries.some(
          (entry) => entry.relativePath === root || entry.relativePath.startsWith(prefix)
        );
        if (!covers) {
          stale.push(`${rule.id}: scan-roden findes ikke i grafen: ${root}`);
        }
      }
    }

    expect(stale).toEqual([]);
  });

  it('anti-rot: hver allowlist-post udløser stadig sin regel', () => {
    const entries = getSourceGraph();
    const byPath = new Map(entries.map((entry) => [entry.relativePath, entry]));
    const stale: string[] = [];

    for (const rule of ARCHITECTURE_RULES) {
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
