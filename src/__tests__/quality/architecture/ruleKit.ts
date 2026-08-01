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
   * filen overtræder.
   *
   * `minimumMatches` og `requiredPaths` lukker de to huller en ren "≥1 hit"-kontrol havde:
   * - Et SAMMENSAT mål (fx "alle fire reader-projektioner") var opfyldt, så snart ÉN fil matchede.
   *   Sletning af de tre andre var derfor usynlig. `requiredPaths` navngiver de filer, målet
   *   forudsætter, og hver enkelt skal både findes OG matche proben.
   * - En regel, hvis mål naturligt findes mange steder, kunne skrumpe til én tilfældig rest uden
   *   at nogen bemærkede det. `minimumMatches` sætter gulvet eksplicit.
   */
  | Readonly<{
    kind: 'precondition';
    probe: (entry: SourceEntry) => boolean;
    rationale: string;
    /** Mindste antal filer proben skal ramme (default 1). */
    minimumMatches?: number;
    /** Filer målet forudsætter. Hver skal findes i grafen OG opfylde proben. */
    requiredPaths?: readonly string[];
  }>
  /**
   * FRAVÆRSREGEL: nul hits ER den ønskede tilstand (forbudte imports, døde symboler). Her kan
   * "reglen rammer noget" ikke bruges som liveness-bevis.
   *
   * `forbids` navngiver hvad reglen forbyder, og `verifyAbsent` er kontrollen, harnesset kører for
   * HVERT navn. Kontrollen er nu generisk og obligatorisk: tidligere lå den i en separat testfil,
   * der kun kendte nogle af arterne, så et forkert stavet navn ("useRowDraftz") kunne "bevises
   * fraværende" lige så nemt som det rigtige. Nu skal reglen selv kunne svare på, hvordan et navn
   * eftervises — og et navn, der ikke KAN findes i nogen form, er en fejl i reglen, ikke et bevis.
   */
  | Readonly<{
    kind: 'absence';
    forbids: readonly string[];
    rationale: string;
    /**
     * Findes navnet stadig i grafen i den form, reglen forbyder? Skal returnere `false` for hvert
     * navn i `forbids` — ellers ER der en overtrædelse, som `evaluate` burde have fanget.
     *
     * Harnesset kører desuden en MODSAT kontrol: navnet skal kunne findes i en syntetisk fil, der
     * bruger det. Ellers er prædikatet (eller stavemåden) forkert, og fraværet er vakuøst.
     */
    verifyAbsent: (name: string, entries: readonly SourceEntry[]) => boolean;
    /**
     * Syntetisk kildekode, der BRUGER navnet, så harnesset kan bevise at `verifyAbsent` faktisk
     * kan svare nej. `name` interpoleres ind.
     */
    absenceProbeCode: (name: string) => string;
  }>
  /**
   * SCOPEBUNDET regel: reglens eksistensberettigelse ER dens scope-rod. Findes roden, har
   * reglen et mål; forsvinder roden, er reglen død. Kontrolleres af scan-rod-kontrollen,
   * som samtidig fanger mappeflytninger, der ellers tavst indsnævrer et scope.
   *
   * ALLE rødder skal findes — ikke bare én. En regel med to rødder, hvor den ene er slettet,
   * scanner halvt så meget som konfigurationen påstår.
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
  /**
   * Finder overtrædelser i én fil.
   *
   * `graph` er HELE kilde-grafen, når reglen evalueres over produktionen, og kun fixture-filen selv
   * under fixture-selvtesten. En regel, hvis grænse afhænger af importGRAFEN (transitiv kobling,
   * facade-stier), bruger den; en rent lokal regel ignorerer den. Uden den kunne en grænse omgås ved
   * at flytte koblingen ét modul væk — reglen ville se en ren fil og være tavs.
   */
  find: (entry: SourceEntry, graph: readonly SourceEntry[]) => readonly Finding[];
  violatingFixtures: readonly RuleFixture[];
  cleanFixtures: readonly RuleFixture[];
}>;

export type TextPattern = Readonly<{
  pattern: RegExp;
  message: string;
}>;

type TextPatternRuleConfig = Readonly<{
  id: string;
  description: string;
  liveTarget: LiveTarget;
  patterns: readonly TextPattern[];
  appliesTo?: (relativePath: string) => boolean;
  allow?: readonly string[];
  /** Fjerner bevidst ignoreret tekst, fx linjekommentarer, før mønstrene køres. */
  normalizeText?: (text: string) => string;
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
    // Anti-rot ser kun filen selv: en allow-post skal kunne begrundes lokalt, uden at hele grafen
    // afgør om undtagelsen stadig gælder.
    findInFile: (entry) => config.find(entry, [entry]),
    violatingFixtures: config.violatingFixtures,
    cleanFixtures: config.cleanFixtures,
    evaluate: (entries) => {
      const violations: Violation[] = [];
      for (const entry of entries) {
        if (config.appliesTo && !config.appliesTo(entry.relativePath)) continue;
        if (allow.has(entry.relativePath)) continue;
        for (const finding of config.find(entry, entries)) {
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

/**
 * Tekstbaseret regel under samme liveness-, fixture- og allowlist-harness som AST-reglerne.
 * Bruges kun når selve kildeformen er kontrakten; semantiske kodegrænser skal fortsat bruge AST.
 */
export const forbidTextPatterns = (config: TextPatternRuleConfig): ArchitectureRule =>
  defineRule({
    id: config.id,
    description: config.description,
    liveTarget: config.liveTarget,
    appliesTo: config.appliesTo,
    allow: config.allow,
    find: (entry) => {
      const text = config.normalizeText?.(entry.text) ?? entry.text;
      const findings: Finding[] = [];
      for (const { pattern, message } of config.patterns) {
        const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
        const matcher = new RegExp(pattern.source, flags);
        let match: RegExpExecArray | null;
        while ((match = matcher.exec(text)) !== null) {
          const prefix = text.slice(0, match.index);
          const line = prefix.split('\n').length;
          const lastNewline = prefix.lastIndexOf('\n');
          findings.push({
            position: { line, column: match.index - lastNewline },
            message,
          });
          if (match[0].length === 0) matcher.lastIndex += 1;
        }
      }
      return findings;
    },
    violatingFixtures: config.violatingFixtures,
    cleanFixtures: config.cleanFixtures,
  });

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
