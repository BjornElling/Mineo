import { cloneAndDeepFreeze } from '../utils/deepFreeze';
import {
  serializeFieldAddress,
  type CollectionRef,
} from './fieldAddress';
import type { CanonicalView, FieldRef } from './fieldDescriptor';
import type { InputCatalog } from './fieldCatalog';
import type { RejectedInput, SettledInput } from './settledInput';
import {
  buildFieldIssueMessage,
  buildFieldIssueSet,
  bindFieldIssueSnapshot,
  activeFieldIssue,
  type FieldIssue,
  type FieldIssueSet,
  type FieldIssueSnapshot,
} from './inputIssue';
import { toAnyFieldRef } from './fieldDescriptor';
import type { EvaluationSourceToken } from './evaluationSource';

export type EntityRef = Readonly<{ collection: CollectionRef; entityId: string }>;

// ── §3.4 pkt. 1: ValidationReader ──────────────────────────────────────────────────────────────────
// Læser afsluttet canonical/rejected input og dependencies UDEN at anvende feltissues. Kun
// input-/valideringsinfrastrukturen må bruge den. Den er grundlaget for både relevans, feltvalidatorer
// og den offentlige reader — så feltvurderingen aldrig bliver cirkulær.

export type ValidationReader = Readonly<{
  input: SettledInput;
  readCanonical: <T>(field: FieldRef<T>) => T;
  readRejected: <T>(field: FieldRef<T>) => RejectedInput | undefined;
  isRelevant: <T>(field: FieldRef<T>) => boolean;
  listEntities: (collection: CollectionRef) => readonly EntityRef[];
}>;

export const createValidationReader = (input: SettledInput, catalog: InputCatalog): ValidationReader => {
  const snapshot = cloneAndDeepFreeze(input) as SettledInput;

  const readCanonical = <T>(field: FieldRef<T>): T => {
    if (!catalog.isKnownField(field) || !catalog.containsAddressEntities(snapshot.sections, field.address)) {
      throw new Error('ValidationReader: ukendt, slettet eller forkert bundet feltreference');
    }
    return cloneAndDeepFreeze(field.descriptor.readCanonical(snapshot.sections, field.address)) as T;
  };

  const view: CanonicalView = Object.freeze({ readCanonical });

  const isRelevant = <T>(field: FieldRef<T>): boolean => {
    const relevance = field.descriptor.relevance;
    return relevance === undefined ? true : relevance(field, view);
  };

  return Object.freeze({
    input: snapshot,
    readCanonical,
    readRejected: <T>(field: FieldRef<T>): RejectedInput | undefined => {
      // Samme grænse som canonical read: ukendte/slettede refs må aldrig bruges som valideringsbypass.
      readCanonical(field);
      return snapshot.rejectedInputs[serializeFieldAddress(field.address)];
    },
    isRelevant,
    listEntities: (collection) => Object.freeze(
      catalog.listEntityIds(snapshot.sections, collection).map((entityId) =>
        Object.freeze({ collection, entityId }))
    ),
  });
};

// ── §3.4 pkt. 2: feltvalidatorerne udleder det immutable issue-snapshot ──────────────────────────────

/**
 * Bygger det immutable feltissue-snapshot fra afsluttet input. Rejected råtekst giver et format-/range-
 * issue; canonical validatorer giver bounds/rule-issues. Irrelevante felter giver aldrig et aktivt issue
 * (§1.9). Mounted komponenter indgår aldrig.
 */
export const deriveFieldIssueSet = (reader: ValidationReader, catalog: InputCatalog): FieldIssueSet => {
  const issues: FieldIssue[] = [];
  const view: CanonicalView = Object.freeze({ readCanonical: reader.readCanonical });

  for (const field of catalog.listFieldInstances(reader.input.sections)) {
    if (!reader.isRelevant(field)) continue;
    const anyRef = toAnyFieldRef(field);

    const rejected = reader.readRejected(field);
    if (rejected !== undefined) {
      issues.push(Object.freeze({
        kind: 'field',
        code: `${field.descriptor.id}.${rejected.reason}`,
        severity: 'error',
        field: anyRef,
        reason: rejected.reason,
        message: buildFieldIssueMessage(anyRef, rejected.reason, rejected.detail),
        ...(rejected.detail === undefined ? {} : { detail: rejected.detail }),
      }));
      continue;
    }

    const validators = field.descriptor.validators;
    if (validators === undefined || validators.length === 0) continue;
    const value = reader.readCanonical(field);
    // Tomhed er consumerens `missing`, aldrig en rød feltfejl.
    if (field.descriptor.isEmpty(value)) continue;
    for (const validate of validators) {
      const spec = validate(value, field, view);
      if (spec === undefined) continue;
      issues.push(Object.freeze({
        kind: 'field',
        code: spec.code,
        severity: 'error',
        field: anyRef,
        reason: spec.reason,
        message: spec.message,
        ...(spec.detail === undefined ? {} : { detail: spec.detail }),
      }));
    }
  }

  return buildFieldIssueSet(issues);
};

// ── §3.4 pkt. 3: den offentlige InputReader ─────────────────────────────────────────────────────────
// Kombinerer samme input med issue-snapshottet og SKJULER enhver værdi med en aktiv feltfejl. Ingen
// consumer må se den canonical værdi bag en rød feltfejl (§1.5/§2.1).

export type ReadFieldResult<T> =
  | Readonly<{ status: 'usable'; value: T }>
  | Readonly<{ status: 'error'; issue: FieldIssue }>;

export type InputReader = Readonly<{
  sourceToken: EvaluationSourceToken;
  fieldIssues: FieldIssueSnapshot;
  read: <T>(field: FieldRef<T>) => ReadFieldResult<T>;
  listEntities: (collection: CollectionRef) => readonly EntityRef[];
}>;

const createInputReader = (options: Readonly<{
  input: SettledInput;
  catalog: InputCatalog;
  issues: FieldIssueSnapshot;
}>): InputReader => {
  const validation = createValidationReader(options.input, options.catalog);

  return Object.freeze({
    sourceToken: options.issues.sourceToken,
    fieldIssues: options.issues,
    read: <T>(field: FieldRef<T>): ReadFieldResult<T> => {
      const value = validation.readCanonical(field); // verificerer også kendt + eksisterende entity
      const issue = activeFieldIssue(options.issues, serializeFieldAddress(field.address));
      if (issue !== undefined) return Object.freeze({ status: 'error', issue });
      return Object.freeze({ status: 'usable', value });
    },
    listEntities: validation.listEntities,
  });
};

export type InputEvaluation = Readonly<{
  issues: FieldIssueSnapshot;
  reader: InputReader;
}>;

/**
 * Kobler input, issue-snapshot og token i én factory. Consumers kan derfor ikke ved en fejl sætte et gammelt
 * issue-snapshot sammen med et nyt input/token og eksponere en bounds-fejlende canonical værdi.
 */
export const createInputEvaluation = <TSettings>(options: Readonly<{
  input: SettledInput;
  catalog: InputCatalog;
  sourceToken: EvaluationSourceToken;
  settings: TSettings;
  deriveSettingsFieldIssues?: (
    reader: ValidationReader,
    settings: TSettings
  ) => readonly FieldIssue[];
}>): InputEvaluation => {
  const validation = createValidationReader(options.input, options.catalog);
  const settings = cloneAndDeepFreeze(options.settings) as TSettings;
  const settingsIssues = options.deriveSettingsFieldIssues?.(validation, settings) ?? [];
  const issues = bindFieldIssueSnapshot(
    buildFieldIssueSet([
      ...deriveFieldIssueSet(validation, options.catalog).all,
      ...settingsIssues,
    ]),
    options.sourceToken
  );
  return Object.freeze({
    issues,
    reader: createInputReader({ input: validation.input, catalog: options.catalog, issues }),
  });
};
