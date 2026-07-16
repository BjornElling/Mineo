import type { CollectionRef } from './fieldAddress';
import type { FieldRef } from './fieldDescriptor';
import { toAnyFieldRef } from './fieldDescriptor';
import type { ConsumerIssue, FieldIssue, IssueDetail, Warning } from './inputIssue';
import type { EntityRef, InputReader } from './inputReader';
import type { EvaluationSourceToken } from './evaluationSource';

// Greenfield-kerne (§3.4/§11): domæneprojektioner er ALMINDELIGE rene funktioner. De læser konkrete refs
// gennem readeren, samler issues og returnerer et lille `ready | blocked`-resultat. Ingen generisk
// projektions-DSL, ingen symbols/brands, intet manuelt `global|section|row`-scope: den præcise dependency
// følger af de refs, funktionen faktisk læser.

export type ProjectionResult<T> =
  | Readonly<{
      status: 'ready';
      value: T;
      issues: readonly (FieldIssue | ConsumerIssue)[];
      warnings: readonly Warning[];
      sourceToken: EvaluationSourceToken;
    }>
  | Readonly<{
      status: 'blocked';
      issues: readonly (FieldIssue | ConsumerIssue)[];
      warnings: readonly Warning[];
      sourceToken: EvaluationSourceToken;
    }>;

export type ProjectionReadResult<T> =
  | Readonly<{ status: 'usable'; value: T }>
  | Readonly<{ status: 'unavailable'; issue: FieldIssue | ConsumerIssue }>;

/** Alle læsninger registreres; kroppen kan derfor ikke ignorere en feltfejl og stadig få `ready`. */
export type ProjectionCollector = Readonly<{
  require: <T>(field: FieldRef<T>) => ProjectionReadResult<T>;
  optional: <T>(field: FieldRef<T>) => ProjectionReadResult<T | undefined>;
  listEntities: (collection: CollectionRef) => readonly EntityRef[];
  warn: <V>(
    code: string,
    message: string,
    options?: Readonly<{ field?: FieldRef<V>; detail?: IssueDetail }>
  ) => void;
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
 * tomt `require`-felt giver en `missing`-consumerfejl (§1.7). Warnings blokerer aldrig.
 */
export const runProjection = <T>(
  reader: InputReader,
  consumerId: string,
  body: (collector: ProjectionCollector) => T
): ProjectionResult<T> => {
  const issues: (FieldIssue | ConsumerIssue)[] = [];
  const warnings: Warning[] = [];
  const issueKeys = new Set<string>();

  const addIssue = (issue: FieldIssue | ConsumerIssue): void => {
    const key = `${issue.kind}:${issue.code}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push(issue);
  };

  const collector: ProjectionCollector = Object.freeze({
    require: <V>(field: FieldRef<V>): ProjectionReadResult<V> => {
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
      return Object.freeze({ status: 'usable', value: result.value });
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
    warn: (code, message, warnOptions) => warnings.push(Object.freeze({
      kind: 'warning',
      code,
      reason: 'rule',
      severity: 'warning',
      message,
      consumerId,
      ...(warnOptions?.field === undefined ? {} : { field: toAnyFieldRef(warnOptions.field) }),
      ...(warnOptions?.detail === undefined ? {} : { detail: Object.freeze({ ...warnOptions.detail }) }),
    })),
  });

  const value = body(collector);
  if (issues.length > 0) {
    return Object.freeze({
      status: 'blocked',
      issues: Object.freeze([...issues]),
      warnings: Object.freeze([...warnings]),
      sourceToken: reader.sourceToken,
    });
  }
  return Object.freeze({
    status: 'ready',
    value,
    issues: Object.freeze([]),
    warnings: Object.freeze([...warnings]),
    sourceToken: reader.sourceToken,
  });
};
