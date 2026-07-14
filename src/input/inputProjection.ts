import { serializeFieldAddress } from './fieldAddress';
import type { FieldRef, FieldRefBase } from './fieldDefinition';
import {
  assertAuthoritativeInputIssue,
  createFieldInputIssue,
  deduplicateInputIssues,
  inputIssueTargetIdentityKey,
  type InputIssue,
  type InputIssuePolicy,
  type InputIssueReason,
  type InputIssueTarget,
} from './inputIssue';
import type { InputReader, InputRevision } from './inputReader';
import { cloneAndDeepFreeze } from '../utils/deepFreeze';

const RESOLVE_DEPENDENCY: unique symbol = Symbol('resolveInputDependency');
const DEPENDENCY_VALUE_TYPE: unique symbol = Symbol('inputDependencyValueType');
const RUN_PROJECTION_VALIDATOR: unique symbol = Symbol('runInputProjectionValidator');
declare const INPUT_PROJECTION_VALIDATOR_BRAND: unique symbol;

type ResolvedDependency = Readonly<{
  status: 'resolved';
  value: unknown;
}> | Readonly<{
  status: 'unresolved';
  issue: InputIssue;
}>;

export type InputDependencyBase = Readonly<{
  field: FieldRefBase;
  [RESOLVE_DEPENDENCY]: (reader: InputReader) => ResolvedDependency;
}>;

export type InputDependency<T> = InputDependencyBase & Readonly<{
  // Phantom-funktionen gør T invariant og binder resultattypen til den konkrete dependency.
  [DEPENDENCY_VALUE_TYPE]: (value: T) => T;
}>;

const createDependency = <TValue, TResolved extends TValue>(
  field: FieldRef<TValue>,
  missingPolicy: InputIssuePolicy | null,
  resolveValue: (value: TValue) => Readonly<{ status: 'resolved'; value: TResolved }>
    | Readonly<{ status: 'missing' }>
): InputDependency<TResolved> => Object.freeze({
  field,
  [DEPENDENCY_VALUE_TYPE]: (value: TResolved): TResolved => value,
  [RESOLVE_DEPENDENCY]: (reader: InputReader): ResolvedDependency => {
    const settled = reader.read(field);
    if (settled.status === 'invalid') {
      return Object.freeze({
        status: 'unresolved',
        issue: createFieldInputIssue({ field, reason: 'invalid' }),
      });
    }

    const resolution = resolveValue(settled.value);
    if (resolution.status === 'missing') {
      if (missingPolicy === null) {
        throw new Error('InputProjection: optional dependency returnerede missing');
      }
      return Object.freeze({
        status: 'unresolved',
        issue: createFieldInputIssue({ field, reason: 'missing', policy: missingPolicy }),
      });
    }
    return Object.freeze({ status: 'resolved', value: resolution.value });
  },
});

/** Optional betyder kun, at canonical tomhed er tilladt; rejected input blokerer stadig. */
export const optionalInput = <T>(field: FieldRef<T>): InputDependency<T> =>
  createDependency(field, null, (value) => ({ status: 'resolved', value }));

/**
 * Required kræver et eksplicit type-guard. Domænet afgør dermed selv, hvad "udfyldt" betyder,
 * og den ready værdi er narrowed uden globale tomhedsheuristikker.
 */
export const requiredInput = <T, TPresent extends T>(
  field: FieldRef<T>,
  isPresent: (value: T) => value is TPresent,
  options: Readonly<{ missingPolicy: InputIssuePolicy }>
): InputDependency<TPresent> => createDependency<T, TPresent>(
  field,
  options.missingPolicy,
  (value) => isPresent(value) ? { status: 'resolved', value } : { status: 'missing' }
);

export type InputDependencyMap = Readonly<Record<string, InputDependencyBase>>;

export type ResolvedInputDependencies<TDependencies extends InputDependencyMap> = Readonly<{
  [K in keyof TDependencies]: TDependencies[K] extends InputDependency<infer TValue> ? TValue : never;
}>;

export type InputProjectionFinding = Readonly<{
  issue: InputIssue;
  blocksProjection: boolean;
}>;

type ProjectionValidatorEvaluation = readonly InputProjectionFinding[] | null;

export type InputProjectionValidator = Readonly<{
  dependencies: InputDependencyMap;
  [RUN_PROJECTION_VALIDATOR]: (reader: InputReader) => ProjectionValidatorEvaluation;
  readonly [INPUT_PROJECTION_VALIDATOR_BRAND]: true;
}>;

const AUTHORITATIVE_PROJECTION_VALIDATORS = new WeakSet<object>();

export const inputProjectionFinding = (
  issue: InputIssue,
  options: Readonly<{ blocksProjection: boolean }>
): InputProjectionFinding => {
  assertAuthoritativeInputIssue(issue);
  if (options.blocksProjection && issue.severity !== 'error') {
    throw new Error('InputProjection: et warning-issue må ikke blokere projektionen');
  }
  if (!options.blocksProjection && (issue.reason === 'invalid' || issue.reason === 'missing')) {
    throw new Error('InputProjection: invalid/missing skal blokere den projektion, der udsteder issueet');
  }
  return Object.freeze({ issue, blocksProjection: options.blocksProjection });
};

export type InputProjectionSpec<TDependencies extends InputDependencyMap, TData> = Readonly<{
  dependencies: TDependencies;
  validators?: readonly InputProjectionValidator[];
  build: (input: ResolvedInputDependencies<TDependencies>) => TData;
}>;

const assertUniqueDependencyAddresses = (dependencies: InputDependencyMap): void => {
  const addresses = Object.values(dependencies)
    .map((dependency) => serializeFieldAddress(dependency.field.address));
  if (new Set(addresses).size !== addresses.length) {
    throw new Error('InputProjection: samme feltadresse er deklareret mere end én gang');
  }
};

const assertProjectionSpec = <TDependencies extends InputDependencyMap, TData>(
  spec: InputProjectionSpec<TDependencies, TData>
): void => {
  assertUniqueDependencyAddresses(spec.dependencies);

  for (const validator of spec.validators ?? []) {
    if (!AUTHORITATIVE_PROJECTION_VALIDATORS.has(validator)) {
      throw new Error('InputProjection: validator skal være oprettet af den autoritative factory');
    }
    for (const dependency of Object.values(validator.dependencies)) {
      const isProjectionDependency = Object.values(spec.dependencies).some((candidate) =>
        serializeFieldAddress(candidate.field.address) === serializeFieldAddress(dependency.field.address)
        && candidate.field.definition === dependency.field.definition
      );
      if (!isProjectionDependency) {
        throw new Error('InputProjection: validator afhænger af et felt uden for projektionen');
      }
    }
  }
};

export const createInputProjectionSpec = <
  const TDependencies extends InputDependencyMap,
  TData,
>(spec: InputProjectionSpec<TDependencies, TData>): InputProjectionSpec<TDependencies, TData> => {
  assertProjectionSpec(spec);

  return Object.freeze({
    ...spec,
    dependencies: Object.freeze({ ...spec.dependencies }),
    validators: Object.freeze([...(spec.validators ?? [])]),
  });
};

export type InputBlocker = Readonly<{
  code: string;
  target: InputIssueTarget;
  reason: InputIssueReason;
  message: string;
  detail?: InputIssue['detail'];
}>;

declare const READY_INPUT_REVISION: unique symbol;
export type ReadyInputRevision = InputRevision & { readonly [READY_INPUT_REVISION]: true };

export type InputProjection<T> =
  | Readonly<{
      status: 'ready';
      data: T;
      issues: readonly InputIssue[];
      revision: ReadyInputRevision;
    }>
  | Readonly<{
      status: 'blocked';
      blockers: readonly InputBlocker[];
      issues: readonly InputIssue[];
      revision: InputRevision;
    }>;

type ProjectionEvaluation<TDependencies extends InputDependencyMap> = Readonly<{
  input: ResolvedInputDependencies<TDependencies> | null;
  findings: readonly InputProjectionFinding[];
}>;

const assertProjectionFinding = (
  finding: InputProjectionFinding,
  dependencies: InputDependencyMap
): void => {
  assertAuthoritativeInputIssue(finding.issue);
  if (typeof finding.blocksProjection !== 'boolean') {
    throw new Error('InputProjection: finding skal angive blocksProjection eksplicit');
  }
  if (finding.blocksProjection && finding.issue.severity !== 'error') {
    throw new Error('InputProjection: et warning-issue må ikke blokere projektionen');
  }
  if (!finding.blocksProjection && (finding.issue.reason === 'invalid' || finding.issue.reason === 'missing')) {
    throw new Error('InputProjection: invalid/missing skal blokere den projektion, der udsteder issueet');
  }
  if (finding.issue.code.trim() === '' || finding.issue.message.trim() === '') {
    throw new Error('InputProjection: issue skal have ikke-tom code og besked');
  }
  if (finding.issue.target.kind === 'output') return;

  const issueField = finding.issue.target.field;
  const isDeclared = Object.values(dependencies).some((dependency) =>
    serializeFieldAddress(dependency.field.address) === serializeFieldAddress(issueField.address)
    && dependency.field.definition === issueField.definition
  );
  if (!isDeclared) {
    throw new Error('InputProjection: field-issue peger på en ikke-deklareret dependency');
  }
};

/**
 * En validator deklarerer kun de felter, dens issue-afledning faktisk kræver. Den kan derfor
 * fortsat køre, når en anden og uafhængig build-dependency er rejected eller missing.
 */
export const createInputProjectionValidator = <const TDependencies extends InputDependencyMap>(
  options: Readonly<{
    dependencies: TDependencies;
    validate: (
      input: ResolvedInputDependencies<TDependencies>
    ) => readonly InputProjectionFinding[];
  }>
): InputProjectionValidator => {
  assertUniqueDependencyAddresses(options.dependencies);
  if (typeof options.validate !== 'function') {
    throw new Error('InputProjection: validator skal have en validate-funktion');
  }
  const dependencies = Object.freeze({ ...options.dependencies });
  const validate = options.validate;
  const validator = Object.freeze({
    dependencies,
    [RUN_PROJECTION_VALIDATOR]: (reader: InputReader): ProjectionValidatorEvaluation => {
      const values: Record<string, unknown> = {};
      for (const [name, dependency] of Object.entries(dependencies)) {
        const resolution = dependency[RESOLVE_DEPENDENCY](reader);
        if (resolution.status === 'unresolved') return null;
        values[name] = resolution.value;
      }

      const input = Object.freeze(values) as ResolvedInputDependencies<TDependencies>;
      const findings = validate(input);
      if (!Array.isArray(findings)) {
        throw new Error('InputProjection: validator skal returnere en liste af findings');
      }
      findings.forEach((finding) => assertProjectionFinding(finding, dependencies));
      return Object.freeze([...findings]);
    },
  }) as unknown as InputProjectionValidator;
  AUTHORITATIVE_PROJECTION_VALIDATORS.add(validator);
  return validator;
};

const evaluateProjectionDependencies = <TDependencies extends InputDependencyMap, TData>(
  reader: InputReader,
  spec: InputProjectionSpec<TDependencies, TData>
): ProjectionEvaluation<TDependencies> => {
  // Evaluatoren håndhæver også factory-invarianterne, så en rå strukturelt konstrueret spec ikke kan omgå dem.
  assertProjectionSpec(spec);
  const values: Record<string, unknown> = {};
  const findings: InputProjectionFinding[] = [];
  let hasUnresolvedDependency = false;

  for (const [name, dependency] of Object.entries(spec.dependencies)) {
    const resolution = dependency[RESOLVE_DEPENDENCY](reader);
    if (resolution.status === 'unresolved') {
      hasUnresolvedDependency = true;
      findings.push(inputProjectionFinding(resolution.issue, { blocksProjection: true }));
    } else {
      values[name] = resolution.value;
    }
  }

  for (const validator of spec.validators ?? []) {
    const validationFindings = validator[RUN_PROJECTION_VALIDATOR](reader);
    if (validationFindings !== null) findings.push(...validationFindings);
  }

  if (hasUnresolvedDependency) {
    return Object.freeze({ input: null, findings: Object.freeze(findings) });
  }

  // Hver property er resolveret fra den dependency, som samme key deklarerer.
  const input = Object.freeze(values) as ResolvedInputDependencies<TDependencies>;
  return Object.freeze({ input, findings: Object.freeze(findings) });
};

const toInputBlocker = (issue: InputIssue): InputBlocker => Object.freeze({
  code: issue.code,
  target: issue.target,
  reason: issue.reason,
  message: issue.message,
  ...(issue.detail === undefined ? {} : { detail: issue.detail }),
});

const deduplicateBlockers = (blockers: readonly InputBlocker[]): readonly InputBlocker[] => {
  const seen = new Set<string>();
  return Object.freeze(blockers.filter((blocker) => {
    const key = JSON.stringify([
      inputIssueTargetIdentityKey(blocker.target),
      blocker.reason,
      blocker.code,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
};

const createBlockedProjection = (
  revision: InputRevision,
  issues: readonly InputIssue[],
  blockers: readonly InputBlocker[]
): Extract<InputProjection<never>, { status: 'blocked' }> => Object.freeze({
  status: 'blocked',
  blockers: deduplicateBlockers(blockers),
  issues: deduplicateInputIssues(issues),
  revision,
});

/** Afleder alle issues uden at bygge eller eksponere projektionens data. */
export const deriveInputProjectionIssues = <TDependencies extends InputDependencyMap, TData>(
  reader: InputReader,
  spec: InputProjectionSpec<TDependencies, TData>
): readonly InputIssue[] => deduplicateInputIssues(
  evaluateProjectionDependencies(reader, spec).findings.map((finding) => finding.issue)
);

/**
 * Bygger kun typed data, når alle deklarerede dependencies er anvendelige, og ingen validator har
 * markeret et issue som blocker. Ikke-dependencies kan derfor aldrig overblokere consumeren.
 */
export const evaluateInputProjection = <TDependencies extends InputDependencyMap, TData>(
  reader: InputReader,
  spec: InputProjectionSpec<TDependencies, TData>
): InputProjection<TData> => {
  const evaluation = evaluateProjectionDependencies(reader, spec);
  const issues = deduplicateInputIssues(evaluation.findings.map((finding) => finding.issue));
  const blockers = evaluation.findings
    .filter((finding) => finding.blocksProjection)
    .map((finding) => toInputBlocker(finding.issue));
  if (evaluation.input === null || blockers.length > 0) {
    return createBlockedProjection(reader.revision, issues, blockers);
  }

  return Object.freeze({
    status: 'ready',
    // Projektionens data er revisionsbundet og må ikke kunne muteres efter udstedelse.
    data: cloneAndDeepFreeze(spec.build(evaluation.input)) as TData,
    issues,
    // Brandet udstedes kun sammen med en ready-projektion fra den samme reader-revision.
    revision: reader.revision as ReadyInputRevision,
  });
};

export const mapInputProjection = <TSource, TResult>(
  projection: InputProjection<TSource>,
  map: (data: TSource) => TResult
): InputProjection<TResult> => {
  const issues = deduplicateInputIssues(projection.issues);
  return projection.status === 'blocked'
    ? createBlockedProjection(projection.revision, issues, projection.blockers)
    : Object.freeze({ ...projection, data: cloneAndDeepFreeze(map(projection.data)) as TResult, issues });
};

export const flatMapInputProjection = <TSource, TResult>(
  projection: InputProjection<TSource>,
  map: (data: TSource) => InputProjection<TResult>
): InputProjection<TResult> => {
  const sourceIssues = deduplicateInputIssues(projection.issues);
  if (projection.status === 'blocked') {
    return createBlockedProjection(projection.revision, sourceIssues, projection.blockers);
  }
  const next = map(projection.data);
  if (next.revision !== projection.revision) {
    throw new Error('InputProjection: projektioner fra forskellige revisioner kan ikke sammensættes');
  }
  const issues = deduplicateInputIssues([...sourceIssues, ...next.issues]);
  return next.status === 'blocked'
    ? createBlockedProjection(next.revision, issues, next.blockers)
    : Object.freeze({ ...next, issues });
};

type ProjectionData<TProjection> = TProjection extends InputProjection<infer TData> ? TData : never;
type CollectedProjectionData<TProjections extends readonly InputProjection<unknown>[]> = Readonly<{
  [K in keyof TProjections]: ProjectionData<TProjections[K]>;
}>;

/** Samler fx rækkeprojektioner uden at indføre row-scope; kun de konkrete child-projektioner indgår. */
export const collectInputProjections = <
  const TProjections extends readonly InputProjection<unknown>[],
>(
  reader: InputReader,
  projections: TProjections
): InputProjection<CollectedProjectionData<TProjections>> => {
  const revision = reader.revision;
  if (projections.some((projection) => projection.revision !== revision)) {
    throw new Error('InputProjection: projektioner fra forskellige revisioner kan ikke sammensættes');
  }

  const issues = deduplicateInputIssues(projections.flatMap((projection) => projection.issues));
  const blockers = projections.flatMap((projection) =>
    projection.status === 'blocked' ? projection.blockers : []
  );
  if (blockers.length > 0) return createBlockedProjection(revision, issues, blockers);

  // Den blokerede gren er udelukket ovenfor; rækkefølgen bevares én-til-én fra inputtuplen.
  const data = cloneAndDeepFreeze(projections.map((projection) => {
    if (projection.status === 'blocked') {
      throw new Error('InputProjection: intern collect-invariant brudt');
    }
    return projection.data;
  })) as CollectedProjectionData<TProjections>;

  return Object.freeze({
    status: 'ready',
    data,
    issues,
    revision: revision as ReadyInputRevision,
  });
};
