import { deepEqual } from '../utils/deepEqual';
import type { CollectionRef } from './fieldAddress';
import type { FieldRef } from './fieldDescriptor';
import { toAnyFieldRef } from './fieldDescriptor';
import type { ConsumerIssue, FieldIssue, IssueDetail, Warning } from './inputIssue';
import type { EntityRef, InputReader, ReadFieldResult } from './inputReader';
import type { EvaluationSourceToken } from './evaluationSource';

// Greenfield-kerne (§3.4/§11): domæneprojektioner er ALMINDELIGE rene funktioner. De læser konkrete refs
// gennem readeren, samler issues og returnerer et lille `ready | blocked`-resultat. Ingen generisk
// projektions-DSL, ingen symbols/brands, intet manuelt `global|section|row`-scope: den præcise dependency
// følger af de refs, funktionen faktisk læser.

export type ProjectionResult<T> =
  | Readonly<{ status: 'ready'; value: T; warnings: readonly Warning[]; sourceToken: EvaluationSourceToken }>
  | Readonly<{
      status: 'blocked';
      issues: readonly (FieldIssue | ConsumerIssue)[];
      warnings: readonly Warning[];
      sourceToken: EvaluationSourceToken;
    }>;

/** Læsehjælper til en projektion. `require` blokerer på fejl OG på tomhed (missing); `optional` kun på fejl. */
export type ProjectionCollector = Readonly<{
  read: <T>(field: FieldRef<T>) => ReadFieldResult<T>;
  require: <T>(field: FieldRef<T>) => T;
  optional: <T>(field: FieldRef<T>) => T | undefined;
  listEntities: (collection: CollectionRef) => readonly EntityRef[];
  warn: <V>(message: string, options?: Readonly<{ field?: FieldRef<V>; detail?: IssueDetail }>) => void;
}>;

class ProjectionAbort extends Error {}

const missingIssue = <V>(consumerId: string, field: FieldRef<V>): ConsumerIssue => Object.freeze({
  kind: 'consumer',
  consumerId,
  reason: 'missing',
  message: `${field.descriptor.label} er ikke udfyldt`,
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

  const collector: ProjectionCollector = Object.freeze({
    read: (field) => reader.read(field),
    require: <V>(field: FieldRef<V>): V => {
      const result = reader.read(field);
      if (result.status === 'error') {
        issues.push(result.issue);
        throw new ProjectionAbort();
      }
      if (deepEqual(result.value, field.descriptor.emptyValue)) {
        issues.push(missingIssue(consumerId, field));
        throw new ProjectionAbort();
      }
      return result.value;
    },
    optional: <V>(field: FieldRef<V>): V | undefined => {
      const result = reader.read(field);
      if (result.status === 'error') {
        issues.push(result.issue);
        throw new ProjectionAbort();
      }
      return deepEqual(result.value, field.descriptor.emptyValue) ? undefined : result.value;
    },
    listEntities: (collection) => reader.listEntities(collection),
    warn: (message, warnOptions) => warnings.push(Object.freeze({
      kind: 'warning',
      message,
      consumerId,
      ...(warnOptions?.field === undefined ? {} : { field: toAnyFieldRef(warnOptions.field) }),
      ...(warnOptions?.detail === undefined ? {} : { detail: warnOptions.detail }),
    })),
  });

  try {
    const value = body(collector);
    return Object.freeze({
      status: 'ready',
      value,
      warnings: Object.freeze([...warnings]),
      sourceToken: reader.sourceToken,
    });
  } catch (error) {
    if (error instanceof ProjectionAbort) {
      return Object.freeze({
        status: 'blocked',
        issues: Object.freeze([...issues]),
        warnings: Object.freeze([...warnings]),
        sourceToken: reader.sourceToken,
      });
    }
    throw error;
  }
};
