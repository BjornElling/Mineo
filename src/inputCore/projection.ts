import type { CollectionRef } from './fieldAddress';
import type { FieldRef } from './fieldDescriptor';
import { toAnyFieldRef } from './fieldDescriptor';
import type { ConsumerIssue, FieldIssue } from './inputIssue';
import type { EntityRef, InputReader } from './inputReader';
import type { EvaluationSourceToken } from './evaluationSource';

// Inputkernen (§3.4/§11): domæneprojektioner er ALMINDELIGE rene funktioner. De læser konkrete refs
// gennem readeren, samler issues og returnerer et lille `ready | blocked`-resultat. Ingen generisk
// projektions-DSL, ingen symbols/brands, intet manuelt `global|section|row`-scope: den præcise dependency
// følger af de refs, funktionen faktisk læser.

/**
 * Der er bevidst INTET `warnings`-felt. Feltet fandtes, blev fyldt af en
 * `collector.warn`, ingen kaldte, og læst af ingen consumer — advarsler dannes i domænernes egne typer.
 * Se noten i `inputIssue.ts`.
 */
export type ProjectionResult<T> =
  | Readonly<{
      status: 'ready';
      value: T;
      issues: readonly (FieldIssue | ConsumerIssue)[];
      sourceToken: EvaluationSourceToken;
    }>
  | Readonly<{
      status: 'blocked';
      issues: readonly (FieldIssue | ConsumerIssue)[];
      sourceToken: EvaluationSourceToken;
    }>;

export type ProjectionReadResult<T> =
  | Readonly<{ status: 'usable'; value: T }>
  | Readonly<{ status: 'unavailable'; issue: FieldIssue | ConsumerIssue }>;

/** Alle læsninger registreres; kroppen kan derfor ikke ignorere en feltfejl og stadig få `ready`. */
export type ProjectionCollector = Readonly<{
  /**
   * Læser et PÅKRÆVET felt. `usable` udelukker `undefined` i TYPEN, fordi `require` allerede har afvist
   * tomhed som en `missing`-consumerfejl — ellers skulle hver kaldssted gentage en undefined-guard, som
   * kroppen kunne glemme at udvide, når et nyt read tilføjes.
   *
   * Indsnævringen er kun sand for felter, hvis tomværdi ER `undefined`. Et felt med en ikke-undefined
   * tomværdi (fx en required-choice, hvis `isEmpty` altid er falsk) kan aldrig blive `unavailable` af
   * tomhedsgrunde, så `NonNullable` fjerner der intet, der kunne forekomme.
   */
  require: <T>(field: FieldRef<T>) => ProjectionReadResult<NonNullable<T>>;
  optional: <T>(field: FieldRef<T>) => ProjectionReadResult<T | undefined>;
  listEntities: (collection: CollectionRef) => readonly EntityRef[];
}>;

const missingIssue = <V>(consumerId: string, field: FieldRef<V>): ConsumerIssue => Object.freeze({
  kind: 'consumer',
  code: `${consumerId}.missing.${field.descriptor.id}`,
  severity: 'error',
  consumerId,
  reason: 'missing',
  message: field.descriptor.controlKind === 'choice'
    ? `${field.descriptor.label} er ikke valgt`
    : field.descriptor.controlKind === 'toggle'
      ? `${field.descriptor.label} er ikke angivet`
      : `Feltet ${field.descriptor.label} er ikke udfyldt`,
  field: toAnyFieldRef(field),
});

/**
 * Kører en ren projektion mod én reader. Enhver rød feltfejl på et læst felt blokerer (§1.6/§1.10). Et
 * tomt `require`-felt giver en `missing`-consumerfejl (§1.7).
 */
export const runProjection = <T>(
  reader: InputReader,
  consumerId: string,
  body: (collector: ProjectionCollector) => T | undefined
): ProjectionResult<T> => {
  const issues: (FieldIssue | ConsumerIssue)[] = [];
  const issueKeys = new Set<string>();

  const addIssue = (issue: FieldIssue | ConsumerIssue): void => {
    const key = `${issue.kind}:${issue.code}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push(issue);
  };

  const collector: ProjectionCollector = Object.freeze({
    require: <V>(field: FieldRef<V>): ProjectionReadResult<NonNullable<V>> => {
      const result = reader.read(field);
      if (result.status === 'error') {
        addIssue(result.issue);
        return Object.freeze({ status: 'unavailable', issue: result.issue });
      }
      if (field.descriptor.isEmpty(result.value)) {
        const issue = missingIssue(consumerId, field);
        addIssue(issue);
        return Object.freeze({ status: 'unavailable', issue });
      }
      // Assertionen er begrundet af den umiddelbart foregående guard: descriptorens `isEmpty` har netop
      // afvist tomheden, og et felt, hvis tomværdi er `undefined`, er derfor ikke-undefined her. En
      // `isEmpty`-prædikat-signatur kunne udtrykke det i typen, men den ville skulle holdes af hver
      // descriptor og ville flytte forpligtelsen ud til ~239 definitioner frem for at holde den på ét sted.
      return Object.freeze({ status: 'usable', value: result.value as NonNullable<V> });
    },
    optional: <V>(field: FieldRef<V>): ProjectionReadResult<V | undefined> => {
      const result = reader.read(field);
      if (result.status === 'error') {
        addIssue(result.issue);
        return Object.freeze({ status: 'unavailable', issue: result.issue });
      }
      return Object.freeze({
        status: 'usable',
        value: field.descriptor.isEmpty(result.value) ? undefined : result.value,
      });
    },
    listEntities: (collection) => reader.listEntities(collection),
  });

  // ⚠️ `body` udfører FØR statussen er afgjort nedenfor. Den må derfor bygge motorinput, men ALDRIG kalde
  // en beregningsmotor: et motorkald her ville køre, selv når projektionen ender `blocked`. Brug
  // `mapReadyProjection` på det færdige resultat i stedet (§3.9/§5.4).
  const value = body(collector);
  if (issues.length > 0) {
    return Object.freeze({
      status: 'blocked',
      issues: Object.freeze([...issues]),
      sourceToken: reader.sourceToken,
    });
  }
  if (value === undefined) {
    throw new Error(`Projektionen ${consumerId} returnerede ingen værdi uden at registrere en blokering`);
  }
  return Object.freeze({
    status: 'ready',
    value,
    issues: Object.freeze([]),
    sourceToken: reader.sourceToken,
  });
};

/**
 * Kalder `calculate` KUN, når projektionen er `ready`, og bærer en `blocked` projektion uændret videre med
 * sine issues og source token.
 *
 * Kontrakten er utvetydig: kun en `ready` projektion må fodre en beregningsmotor
 * (`form-contract.md` §2.3), og en projektion kalder ikke motoren, hvis et afhængigt issue gør input
 * uanvendeligt (`error-contract.md` §5). Denne helper udtrykker netop den overgang for de projektioner, der
 * returnerer et `ProjectionResult` — og den bevarer projektionsformen, fordi consumers skal kende både
 * resultatet OG blokeringen uden selv at samle et `ProjectionResult` (hvor et forkert `status`-felt let
 * ville snige sig ind).
 *
 * Konsekvensen af `blocked` er, at motoren ikke kaldes — ikke at den kaldes med en tomværdi. En maskeret
 * tomværdi ville lade motoren regne videre på et falsk input, og det er præcis det brud, denne primitiv
 * findes for at gøre urepræsenterbart.
 *
 * ⚠️ Den er IKKE den eneste vej til et gatet motorkald i kodebasen, og påstår det ikke. Domæneslices, der
 * ikke bygger på `ProjectionResult` (Forsørgertab, EET og EO), gater i stedet pr. dependency-gruppe med
 * påkrævede gate-flag/blocking-issues — se `forsoergertabCalculation.ts`, `eetSnapshot.ts`
 * (`buildGatedProjection`) og `eoSnapshot.ts`. At tvinge dem gennem denne signatur ville kræve, at deres
 * panel-specifikke gates blev ensartet, og det er reelt forskellige concerns (AGENTS.md "Konvergens").
 */
export const mapReadyProjection = <T, R>(
  projection: ProjectionResult<T>,
  calculate: (value: T) => R
): ProjectionResult<R> => {
  if (projection.status === 'blocked') return projection;
  return Object.freeze({
    status: 'ready',
    value: calculate(projection.value),
    issues: projection.issues,
    sourceToken: projection.sourceToken,
  });
};
