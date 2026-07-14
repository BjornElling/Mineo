import { serializeFieldAddress } from './fieldAddress';
import type { FieldRef, FieldRefBase } from './fieldDefinition';
import {
  createFieldInputIssue,
  type InputIssue,
  type InputIssuePolicy,
  type InputIssueReason,
  type InputIssueTarget,
} from './inputIssue';
import type { InputReader, InputRevision } from './inputReader';

const RESOLVE_DEPENDENCY: unique symbol = Symbol('resolveInputDependency');
const DEPENDENCY_VALUE_TYPE: unique symbol = Symbol('inputDependencyValueType');

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

export const inputProjectionFinding = (
  issue: InputIssue,
  options: Readonly<{ blocksProjection: boolean }>
): InputProjectionFinding => {
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
  validate?: (
    input: ResolvedInputDependencies<TDependencies>
  ) => readonly InputProjectionFinding[];
  build: (input: ResolvedInputDependencies<TDependencies>) => TData;
}>;

const assertProjectionSpec = <TDependencies extends InputDependencyMap, TData>(
  spec: InputProjectionSpec<TDependencies, TData>
): void => {
  const entries = Object.entries(spec.dependencies);
  const addresses = entries.map(([, dependency]) => serializeFieldAddress(dependency.field.address));
  if (new Set(addresses).size !== addresses.length) {
    throw new Error('InputProjection: samme feltadresse er deklareret mere end én gang');
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

const issueTargetKey = (target: InputIssueTarget): string => target.kind === 'field'
  ? `field:${serializeFieldAddress(target.field.address)}`
  : `output:${target.outputId}`;

const issueKey = (issue: InputIssue): string =>
  `${issueTargetKey(issue.target)}|${issue.reason}|${issue.code}`;

const detailKey = (detail: InputIssue['detail']): string => detail === undefined
  ? ''
  : JSON.stringify(Object.entries(detail).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));

const issuesAreSemanticallyEqual = (left: InputIssue, right: InputIssue): boolean =>
  left.code === right.code
  && left.reason === right.reason
  && left.severity === right.severity
  && left.message === right.message
  && left.policy.blocksSave === right.policy.blocksSave
  && detailKey(left.detail) === detailKey(right.detail)
  && left.target.kind === right.target.kind
  && (left.target.kind === 'field' && right.target.kind === 'field'
    ? left.target.field.definition === right.target.field.definition
    : left.target.kind === 'output' && right.target.kind === 'output'
      && left.target.label === right.target.label);

const deduplicateIssues = (issues: readonly InputIssue[]): readonly InputIssue[] => {
  const seen = new Map<string, InputIssue>();
  const unique: InputIssue[] = [];
  for (const issue of issues) {
    const key = issueKey(issue);
    const existing = seen.get(key);
    if (existing !== undefined) {
      if (!issuesAreSemanticallyEqual(existing, issue)) {
        throw new Error(`InputProjection: konflikt mellem issues med identiteten '${key}'`);
      }
      continue;
    }
    seen.set(key, issue);
    unique.push(issue);
  }
  return Object.freeze(unique);
};

const assertProjectionFinding = (
  finding: InputProjectionFinding,
  dependencies: InputDependencyMap
): void => {
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

  if (hasUnresolvedDependency) {
    return Object.freeze({ input: null, findings: Object.freeze(findings) });
  }

  // Hver property er resolveret fra den dependency, som samme key deklarerer.
  const input = Object.freeze(values) as ResolvedInputDependencies<TDependencies>;
  const validationFindings = spec.validate?.(input) ?? [];
  validationFindings.forEach((finding) => assertProjectionFinding(finding, spec.dependencies));
  findings.push(...validationFindings);
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
    const key = `${issueTargetKey(blocker.target)}|${blocker.reason}|${blocker.code}`;
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
  issues: deduplicateIssues(issues),
  revision,
});

/** Afleder alle issues uden at bygge eller eksponere projektionens data. */
export const deriveInputProjectionIssues = <TDependencies extends InputDependencyMap, TData>(
  reader: InputReader,
  spec: InputProjectionSpec<TDependencies, TData>
): readonly InputIssue[] => deduplicateIssues(
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
  const issues = deduplicateIssues(evaluation.findings.map((finding) => finding.issue));
  const blockers = evaluation.findings
    .filter((finding) => finding.blocksProjection)
    .map((finding) => toInputBlocker(finding.issue));
  if (evaluation.input === null || blockers.length > 0) {
    return createBlockedProjection(reader.revision, issues, blockers);
  }

  return Object.freeze({
    status: 'ready',
    data: spec.build(evaluation.input),
    issues,
    // Brandet udstedes kun sammen med en ready-projektion fra den samme reader-revision.
    revision: reader.revision as ReadyInputRevision,
  });
};

export const mapInputProjection = <TSource, TResult>(
  projection: InputProjection<TSource>,
  map: (data: TSource) => TResult
): InputProjection<TResult> => projection.status === 'blocked'
  ? projection
  : Object.freeze({ ...projection, data: map(projection.data) });

export const flatMapInputProjection = <TSource, TResult>(
  projection: InputProjection<TSource>,
  map: (data: TSource) => InputProjection<TResult>
): InputProjection<TResult> => {
  if (projection.status === 'blocked') return projection;
  const next = map(projection.data);
  if (next.revision !== projection.revision) {
    throw new Error('InputProjection: projektioner fra forskellige revisioner kan ikke sammensættes');
  }
  const issues = deduplicateIssues([...projection.issues, ...next.issues]);
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
  revision: InputRevision,
  projections: TProjections
): InputProjection<CollectedProjectionData<TProjections>> => {
  if (projections.some((projection) => projection.revision !== revision)) {
    throw new Error('InputProjection: projektioner fra forskellige revisioner kan ikke sammensættes');
  }

  const issues = deduplicateIssues(projections.flatMap((projection) => projection.issues));
  const blockers = projections.flatMap((projection) =>
    projection.status === 'blocked' ? projection.blockers : []
  );
  if (blockers.length > 0) return createBlockedProjection(revision, issues, blockers);

  // Den blokerede gren er udelukket ovenfor; rækkefølgen bevares én-til-én fra inputtuplen.
  const data = projections.map((projection) => {
    if (projection.status === 'blocked') {
      throw new Error('InputProjection: intern collect-invariant brudt');
    }
    return projection.data;
  }) as CollectedProjectionData<TProjections>;

  return Object.freeze({
    status: 'ready',
    data,
    issues,
    revision: revision as ReadyInputRevision,
  });
};
