import type { SourceEntry } from './sourceGraph';
import {
  collectCalls,
  collectElementAccess,
  collectImports,
  collectMemberAccess,
  collectTypeAssertions,
  type CallRef,
  type CodePosition,
  type ElementAccessRef,
  type ImportRef,
  type MemberAccessRef,
  type TypeAssertionRef,
} from './astQueries';

/**
 * Regel-byggeklodser for det AST-baserede arkitektur-harness (greenfield #48).
 *
 * En {@link ArchitectureRule} er en ren funktion fra kilde-grafen til en liste af
 * {@link Violation}s med præcis fil:linje:kolonne-diagnostik. Hver regel bærer sine
 * egne positive/negative fixtures, så `architectureRules.test.ts` kan bevise
 * strukturelt at reglen ikke er inert (vacuous-pass-værnet) — i stedet for at hver
 * guard håndruller sin egen selvtest.
 */

export type Violation = Readonly<{
  ruleId: string;
  relativePath: string;
  position: CodePosition;
  message: string;
}>;

/** Et fund i én fil, før regel-id og sti sættes på af runneren. */
export type Finding = Readonly<{ position: CodePosition; message: string }>;

export type RuleFixture = Readonly<{
  /** Sti fixturen skal lade som om den ligger på (styrer scope/allow-matchning). */
  relativePath: string;
  /** Syntetisk kildekode. */
  code: string;
}>;

/**
 * Bevis for at reglen stadig har et MÅL i den levende kilde-graf.
 *
 * Fixtures beviser, at reglens walker VIRKER. De beviser ikke, at der er noget at gå efter:
 * slettes reglens mål, matcher fixtures stadig, mens grafen ikke længere indeholder noget,
 * reglen kan udtale sig om. Reglen bliver da grøn af TOMHED — samme fejlklasse som WI-007's
 * inerte AST-værn og WI-008's rene type-brand.
 *
 * Klassifikationen er EKSPLICIT pr. regel, ikke inferet: reglerne deler sig i to arter, hvor
 * "nul hits" betyder modsatte ting, og en fælles "≥1 hit"-kontrol ville ramme den ene forkert.
 */
export type LiveTarget =
  /**
   * FORUDSÆTNINGSREGEL: reglen kigger kun på filer, der gør noget bestemt (udløser en download,
   * renderer et felt, tilgår en sektion). Findes den slags fil ikke længere, er reglen inert.
   * `probe` svarer på "har grafen stadig en fil, jeg ville KONTROLLERE?" — uafhængigt af, om
   * filen overtræder. Nul probe-hits = dødt værn.
   */
  | Readonly<{ kind: 'precondition'; probe: (entry: SourceEntry) => boolean; rationale: string }>
  /**
   * FRAVÆRSREGEL: nul hits ER den ønskede tilstand (forbudte imports, døde symboler). Her kan
   * "reglen rammer noget" ikke bruges som liveness-bevis. I stedet skal reglen navngive, hvad
   * den forbyder, så `deletedLegacyAbsence.test.ts` kan bevise, at hvert navn faktisk er
   * fraværende — og reglen ikke stille skifter til at forbyde noget, der aldrig fandtes,
   * fordi navnet er stavet forkert.
   */
  | Readonly<{ kind: 'absence'; forbids: readonly string[]; rationale: string }>
  /**
   * SCOPEBUNDET regel: reglens eksistensberettigelse ER dens scope-rod. Findes roden, har
   * reglen et mål; forsvinder roden, er reglen død. Kontrolleres af scan-rod-kontrollen,
   * som samtidig fanger mappeflytninger, der ellers tavst indsnævrer et scope.
   */
  | Readonly<{ kind: 'scoped'; roots: readonly string[]; rationale: string }>;

export type ArchitectureRule = Readonly<{
  id: string;
  description: string;
  /** Bevis for at reglen stadig har noget at holde øje med. Håndhæves af dødt-værn-detektoren. */
  liveTarget: LiveTarget;
  /** Producerer alle overtrædelser over hele kilde-grafen. */
  evaluate: (entries: readonly SourceEntry[]) => readonly Violation[];
  /** Rå fund i én fil UDEN at anvende allow/scope — bruges af anti-rot-selvtesten. */
  findInFile: (entry: SourceEntry) => readonly Finding[];
  /** Repo-relative stier der er eksplicit undtaget (auditerede undtagelser). */
  allow: readonly string[];
  /**
   * Hvis sand: hver `allow`-post SKAL stadig udløse reglen (ellers er den forældet og
   * skal fjernes, ikke efterlades som stiltiende undtagelse). Håndhæves generisk af
   * runneren, så anti-rot ikke længere håndrulles pr. guard.
   */
  /** Kildeeksempler reglen SKAL flage (mindst én). */
  violatingFixtures: readonly RuleFixture[];
  /** Kildeeksempler reglen IKKE må flage (mindst én). */
  cleanFixtures: readonly RuleFixture[];
}>;

const formatViolation = (v: Violation): string =>
  `${v.relativePath}:${v.position.line}:${v.position.column} — ${v.message}`;

export const formatViolations = (violations: readonly Violation[]): string =>
  violations.map(formatViolation).join('\n');

type RuleConfig = Readonly<{
  id: string;
  description: string;
  liveTarget: LiveTarget;
  /** Begrænser hvilke filer reglen kontrollerer (default: alle). */
  appliesTo?: (relativePath: string) => boolean;
  /** Repo-relative stier der er eksplicit undtaget (auditerede undtagelser). */
  allow?: readonly string[];
  /** Håndhæv at hver allow-post stadig udløser reglen (default: false). */
  /** Finder overtrædelser i én fil. */
  find: (entry: SourceEntry) => readonly Finding[];
  violatingFixtures: readonly RuleFixture[];
  cleanFixtures: readonly RuleFixture[];
}>;

/** Den generelle regel-konstruktør. De specialiserede factories nedenfor bygger på den. */
export const defineRule = (config: RuleConfig): ArchitectureRule => {
  const allowList = config.allow ?? [];
  const allow = new Set(allowList);
  return {
    id: config.id,
    description: config.description,
    liveTarget: config.liveTarget,
    allow: allowList,
    findInFile: config.find,
    violatingFixtures: config.violatingFixtures,
    cleanFixtures: config.cleanFixtures,
    evaluate: (entries) => {
      const violations: Violation[] = [];
      for (const entry of entries) {
        if (config.appliesTo && !config.appliesTo(entry.relativePath)) continue;
        if (allow.has(entry.relativePath)) continue;
        for (const finding of config.find(entry)) {
          violations.push({
            ruleId: config.id,
            relativePath: entry.relativePath,
            position: finding.position,
            message: finding.message,
          });
        }
      }
      return violations;
    },
  };
};

// ---------------------------------------------------------------------------
// Specialiserede factories
// ---------------------------------------------------------------------------

type ImportRuleConfig = Readonly<{
  id: string;
  description: string;
  liveTarget: LiveTarget;
  appliesTo?: (relativePath: string) => boolean;
  allow?: readonly string[];
  /**
   * Sand for imports der er forbudt (uden for `allow`). `fromRelativePath` er den
   * importerende fils repo-relative sti — nødvendig for at opløse relative specifiers
   * (lag-grænse-regler).
   */
  forbidden: (ref: ImportRef, fromRelativePath: string) => boolean;
  message: (ref: ImportRef, fromRelativePath: string) => string;
  violatingFixtures: readonly RuleFixture[];
  cleanFixtures: readonly RuleFixture[];
}>;

/** Forbyder import af et modul (evt. kun uden for en allowlist / kun i et scope). */
export const forbidImports = (config: ImportRuleConfig): ArchitectureRule =>
  defineRule({
    id: config.id,
    description: config.description,
    liveTarget: config.liveTarget,
    appliesTo: config.appliesTo,
    allow: config.allow,
    find: (entry) =>
      collectImports(entry)
        .filter((ref) => config.forbidden(ref, entry.relativePath))
        .map((ref) => ({ position: ref.position, message: config.message(ref, entry.relativePath) })),
    violatingFixtures: config.violatingFixtures,
    cleanFixtures: config.cleanFixtures,
  });

type MemberAccessRuleConfig = Readonly<{
  id: string;
  description: string;
  liveTarget: LiveTarget;
  appliesTo?: (relativePath: string) => boolean;
  allow?: readonly string[];
  forbidden: (ref: MemberAccessRef) => boolean;
  message: (ref: MemberAccessRef) => string;
  violatingFixtures: readonly RuleFixture[];
  cleanFixtures: readonly RuleFixture[];
}>;

/** Forbyder en prik-medlemsadgang (fx `window.localStorage`) uden for en allowlist. */
export const forbidMemberAccess = (config: MemberAccessRuleConfig): ArchitectureRule =>
  defineRule({
    id: config.id,
    description: config.description,
    liveTarget: config.liveTarget,
    appliesTo: config.appliesTo,
    allow: config.allow,
    find: (entry) =>
      collectMemberAccess(entry)
        .filter(config.forbidden)
        .map((ref) => ({ position: ref.position, message: config.message(ref) })),
    violatingFixtures: config.violatingFixtures,
    cleanFixtures: config.cleanFixtures,
  });

type CallRuleConfig = Readonly<{
  id: string;
  description: string;
  liveTarget: LiveTarget;
  appliesTo?: (relativePath: string) => boolean;
  allow?: readonly string[];
  forbidden: (ref: CallRef) => boolean;
  message: (ref: CallRef) => string;
  violatingFixtures: readonly RuleFixture[];
  cleanFixtures: readonly RuleFixture[];
}>;

/** Forbyder et kald (matchet på callee og/eller argumenter) uden for en allowlist. */
export const forbidCalls = (config: CallRuleConfig): ArchitectureRule =>
  defineRule({
    id: config.id,
    description: config.description,
    liveTarget: config.liveTarget,
    appliesTo: config.appliesTo,
    allow: config.allow,
    find: (entry) =>
      collectCalls(entry)
        .filter(config.forbidden)
        .map((ref) => ({ position: ref.position, message: config.message(ref) })),
    violatingFixtures: config.violatingFixtures,
    cleanFixtures: config.cleanFixtures,
  });

type ElementAccessRuleConfig = Readonly<{
  id: string;
  description: string;
  liveTarget: LiveTarget;
  appliesTo?: (relativePath: string) => boolean;
  allow?: readonly string[];
  forbidden: (ref: ElementAccessRef) => boolean;
  message: (ref: ElementAccessRef) => string;
  violatingFixtures: readonly RuleFixture[];
  cleanFixtures: readonly RuleFixture[];
}>;

/** Forbyder en element-adgang (fx rå `aarsloenAslMax[år]`) uden for en allowlist. */
export const forbidElementAccess = (config: ElementAccessRuleConfig): ArchitectureRule =>
  defineRule({
    id: config.id,
    description: config.description,
    liveTarget: config.liveTarget,
    appliesTo: config.appliesTo,
    allow: config.allow,
    find: (entry) =>
      collectElementAccess(entry)
        .filter(config.forbidden)
        .map((ref) => ({ position: ref.position, message: config.message(ref) })),
    violatingFixtures: config.violatingFixtures,
    cleanFixtures: config.cleanFixtures,
  });

type TypeAssertionRuleConfig = Readonly<{
  id: string;
  description: string;
  liveTarget: LiveTarget;
  appliesTo?: (relativePath: string) => boolean;
  allow?: readonly string[];
  forbidden: (ref: TypeAssertionRef) => boolean;
  message: (ref: TypeAssertionRef) => string;
  violatingFixtures: readonly RuleFixture[];
  cleanFixtures: readonly RuleFixture[];
}>;

/** Forbyder en eksplicit type-assertion til en bestemt target-type. */
export const forbidTypeAssertions = (config: TypeAssertionRuleConfig): ArchitectureRule =>
  defineRule({
    id: config.id,
    description: config.description,
    liveTarget: config.liveTarget,
    appliesTo: config.appliesTo,
    allow: config.allow,
    find: (entry) =>
      collectTypeAssertions(entry)
        .filter(config.forbidden)
        .map((ref) => ({ position: ref.position, message: config.message(ref) })),
    violatingFixtures: config.violatingFixtures,
    cleanFixtures: config.cleanFixtures,
  });
