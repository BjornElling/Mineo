import { ARCHITECTURE_RULES } from './architectureRules';
import { formatViolations } from './ruleKit';
import { getSourceGraph, makeSyntheticEntry } from './sourceGraph';
import { pageSectionAccessBoundary } from './rules/domainRules';

/**
 * Kør-motor + selvtest for det AST-baserede arkitektur-harness.
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

  // Timeout på 300 s (ikke 30 s): denne case parser AST for hele kilde-grafen (~700 filer,
  // setParentNodes) og kører hver regels tree-walk over sit scope — reelt ~4 s CPU-arbejde lokalt.
  // Under thread-poolen konkurrerer det arbejde med parallelle test-workere om kernerne, så
  // wall-clock kan strække sig langt forbi 30 s afhængigt af samtidig belastning.
  //
  // Loftet blev hævet fra 120 s til 300 s 2026-08-07 på et MÅLT grundlag: under `test:coverage`
  // instrumenterer V8 hele kilde-grafen, og prisen rammer netop denne case hårdest. Alene under
  // coverage tager den ~143 s (mod ~74 s uden), og i den fulde suite — hvor den deler maskinen med
  // 535 andre testfiler — blev den målt til ~239 s. Det gamle loft på 120 s gjorde derfor
  // `verify:release` deterministisk rødt, uden at nogen arkitekturregel var overtrådt. Fejlen var
  // latent: gaten stoppede altid tidligere på `check:runtime`, så timeoutet blev aldrig nået.
  //
  // Arbejdet er endeligt og cachet — ikke en hængning — så et rundhåndet loft fjerner den falske
  // rødfarvning uden at skjule en ægte deadlock: en reel hængning rammer stadig loftet.
  it('ingen arkitektur-overtrædelser i kilde-grafen', { timeout: 300000 }, () => {
    const entries = getSourceGraph();
    const violations = ARCHITECTURE_RULES.flatMap((rule) => rule.evaluate(entries));

    expect(
      violations,
      violations.length > 0 ? `\n${formatViolations(violations)}` : undefined
    ).toEqual([]);
  });

  it('page-grænsen følger en reel transitiv importgraf', () => {
    const page = makeSyntheticEntry(
      'src/components/pages/Aarsloen.tsx',
      "import { project } from '../../domain/example/projection'; project();"
    );
    const projection = makeSyntheticEntry(
      'src/domain/example/projection.ts',
      "import { satserField } from '../../inputCore/catalog/satserDescriptors'; export const project = () => satserField;"
    );

    expect(pageSectionAccessBoundary.evaluate([page, projection])).not.toEqual([]);
  });

  it('page-grænsen stopper ved en godkendt cross-domain-port', () => {
    const page = makeSyntheticEntry(
      'src/components/pages/Erhvervsevnetab.tsx',
      "import { forligInputFields } from '../../domain/erstatningsopgoerelse/forligInputPort'; void forligInputFields;"
    );
    const port = makeSyntheticEntry(
      'src/domain/erstatningsopgoerelse/forligInputPort.ts',
      "import { eoForligDatoField } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors'; export const forligInputFields = eoForligDatoField;"
    );

    expect(pageSectionAccessBoundary.evaluate([page, port])).toEqual([]);
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
  // Dødt-værn-detektor: har hver regel stadig noget at holde øje med?
  // ---------------------------------------------------------------------------
  //
  // Selvtesten ovenfor beviser, at reglens WALKER virker (fixtures flages). Den beviser IKKE, at
  // reglens mål stadig findes i produktionen. Slettes målet, matcher fixtures fortsat, mens grafen
  // ikke længere indeholder noget, reglen kan udtale sig om — reglen bliver grøn af TOMHED og
  // fremstår som dækning, den ikke leverer. Detektoren gør det princip maskinelt frem for en vane
  // pr. regel.
  //
  // Den er selv mutationstestet af virkeligheden: da den blev indført, rapporterede den tre døde
  // værn i manifestet, hvis mål var slettet eller omdøbt under dem. Det var observerede fejl, ikke
  // fixtures — og hvert af de tre værn fremstod grønt indtil da.
  it('dødt værn: hver forudsætningsregel har stadig en fil, den ville kontrollere', { timeout: 300000 }, () => {
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

  // ---------------------------------------------------------------------------
  // En liveness-probe må ikke kunne opfyldes af en KOMMENTAR
  // ---------------------------------------------------------------------------
  //
  // Flere prober brugte `entry.text.includes(...)` eller et regex over hele filteksten. En kommentar kunne
  // derfor opfylde liveness, selv om det levende AST-mål var slettet — og reglen ville fremstå load-bearing
  // efter mekanismens faktiske fjernelse. Storage-reglens egen RENE fixture var netop en sådan kommentar:
  // evaluatoren flagede den korrekt ikke, mens proben sagde "levende".
  //
  // Kontrollen er generisk og maskinel: for hver forudsætningsregel tages en fil, der FAKTISK opfylder
  // proben, og hele dens indhold kommenteres ud. Kildeteksten er dermed uændret ord for ord, mens hver
  // eneste AST-node er væk. En probe, der stadig svarer `true`, måler tekst — ikke mekanismen.
  //
  // Kommentering skjuler også `*/`-sekvenser, så en blok-kommentar i kilden ikke kan lukke vores egen: hver
  // linje præfikses med `// `, hvilket er robust for enhver kilde uden line-continuations i strenge.
  //
  // STI-baserede prober er bevidst undtaget, og undtagelsen er selv maskinel frem for en liste: en probe, der
  // også er opfyldt af en TOM fil på samme sti, spørger kun "findes modulet?". Det er et legitimt og
  // AST-uafhængigt liveness-signal (`requiredPaths` + dødt-værn-detektoren beviser, at filen findes), og
  // kommentar-mutationen kan pr. konstruktion ikke sige noget om den. Kun en probe, der er opfyldt af
  // KOMMENTARER men IKKE af tomhed, læser filens indhold som tekst — og det er præcis fejlformen.
  it('liveness: ingen forudsætningsprobe kan opfyldes af ren kommentartekst', { timeout: 300000 }, () => {
    const entries = getSourceGraph();
    const textOnlyProbes: string[] = [];

    for (const rule of ARCHITECTURE_RULES) {
      if (rule.liveTarget.kind !== 'precondition') continue;
      const { probe } = rule.liveTarget;
      const match = entries.find((entry) => probe(entry));
      if (match === undefined) continue; // dødt-værn-detektoren ovenfor rapporterer dette separat.

      // Sti-baseret probe: indholdet er irrelevant, så kommentar-mutationen er ikke anvendelig.
      if (probe(makeSyntheticEntry(match.relativePath, ''))) continue;

      const commentedOut = makeSyntheticEntry(
        match.relativePath,
        match.text.split('\n').map((line) => `// ${line}`).join('\n')
      );
      if (probe(commentedOut)) {
        textOnlyProbes.push(
          `${rule.id}: proben er stadig opfyldt, når HELE ${match.relativePath} er kommenteret ud. `
          + 'Den måler altså tekst frem for AST-noder, og en kommentar kan holde reglen kunstigt levende '
          + 'Brug `hasIdentifier`/`hasAnyIdentifier`/`hasTypeReference`/`hasImportFrom`/'
          + '`hasJsxAttribute`/`hasDeclaredMember`/`hasMemberRead` eller en anden AST-query.'
        );
      }
    }

    expect(textOnlyProbes).toEqual([]);
  });

  // Fraværsregler: kontrollen er nu GENERISK og obligatorisk, og den kører i BEGGE retninger.
  //
  // Retning 1 (fravær): hvert forbudt navn skal være fraværende i grafen.
  // Retning 2 (prædikatet virker): navnet skal kunne FINDES i en syntetisk fil, der bruger det.
  //   Uden den retning kunne en stavefejl — `useRowDraftz` i stedet for `useRowDrafts` — "bevises
  //   fraværende" lige så let som det rigtige navn, og reglen ville være vakuøst grøn.
  it('dødt værn: hvert forbudt navn er beviseligt fraværende — og prædikatet kan finde det', { timeout: 300000 }, () => {
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
  it('dødt værn: hver scan-rod svarer til en levende mappe i grafen', { timeout: 300000 }, () => {
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
