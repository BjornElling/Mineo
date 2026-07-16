import { serializeFieldAddress } from './fieldAddress';
import type { FieldRefBase } from './fieldDefinition';

export type InputIssueReason = 'invalid' | 'missing' | 'range' | 'bounds' | 'schema' | 'rule';
export type InputIssueSeverity = 'error' | 'warning';

const INPUT_ISSUE_REASONS: readonly InputIssueReason[] = Object.freeze([
  'invalid',
  'missing',
  'range',
  'bounds',
  'schema',
  'rule',
]);

export type InputIssuePolicy = Readonly<{
  blocksSave: boolean;
}>;

export const BLOCK_SAVE_INPUT_ISSUE_POLICY: InputIssuePolicy = Object.freeze({
  blocksSave: true,
});

export const ALLOW_SAVE_INPUT_ISSUE_POLICY: InputIssuePolicy = Object.freeze({
  blocksSave: false,
});

export type FieldInputIssueTarget = Readonly<{
  kind: 'field';
  field: FieldRefBase;
}>;

export type OutputInputIssueTarget = Readonly<{
  kind: 'output';
  outputId: string;
  label: string;
}>;

export type InputIssueTarget = FieldInputIssueTarget | OutputInputIssueTarget;

declare const INPUT_ISSUE_BRAND: unique symbol;

export type InputIssue = Readonly<{
  code: string;
  target: InputIssueTarget;
  reason: InputIssueReason;
  severity: InputIssueSeverity;
  message: string;
  policy: InputIssuePolicy;
  detail?: Readonly<Record<string, string | number | boolean>>;
  readonly [INPUT_ISSUE_BRAND]: true;
}>;

type InputIssueValue = Omit<InputIssue, typeof INPUT_ISSUE_BRAND>;

// WeakSettet gør factoryen til runtime-autoritet. Et strukturelt korrekt objekt eller et spread af
// et ægte issue kan dermed ikke snige en ændret save-policy ind i gate-logikken.
const AUTHORITATIVE_INPUT_ISSUES = new WeakSet<object>();

type CreateFieldInputIssueOptions =
  | Readonly<{
      field: FieldRefBase;
      reason: 'invalid';
      detail?: InputIssue['detail'];
    }>
  | Readonly<{
      field: FieldRefBase;
      reason: 'missing';
      policy: InputIssuePolicy;
      detail?: InputIssue['detail'];
    }>
  | Readonly<{
      field: FieldRefBase;
      reason: Exclude<InputIssueReason, 'invalid' | 'missing'>;
      severity?: InputIssueSeverity;
      code: string;
      message: string;
      policy: InputIssuePolicy;
      detail?: InputIssue['detail'];
    }>;

type CreateOutputInputIssueOptions = Readonly<{
  outputId: string;
  label: string;
  reason: 'schema' | 'rule';
  severity?: InputIssueSeverity;
  code: string;
  message: string;
  policy: InputIssuePolicy;
  detail?: InputIssue['detail'];
}>;

const requireNonEmptyText = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (trimmed === '') throw new Error(`InputIssue: ${label} må ikke være tom`);
  return trimmed;
};

const assertImmutableFieldRef = (field: FieldRefBase): void => {
  // Issueet bevarer definition-identiteten, så feltet kan ikke defensivt kopieres. De kanoniske
  // builders fryser hele ref-kæden; andre refs afvises for at bevare issueet revisionsstabilt.
  if (
    !Object.isFrozen(field)
    || !Object.isFrozen(field.address)
    || !Object.isFrozen(field.address.path)
    || !Object.isFrozen(field.definition)
  ) {
    throw new Error('InputIssue: feltreferencen skal være oprettet af de immutable feltbuilders');
  }
  requireNonEmptyText(field.definition.label, 'feltlabel');
  serializeFieldAddress(field.address);
};

const normalizePolicy = (policy: InputIssuePolicy): InputIssuePolicy => {
  if (typeof policy?.blocksSave !== 'boolean') {
    throw new Error('InputIssue: save-policy skal angive blocksSave som boolean');
  }
  return Object.freeze({ blocksSave: policy.blocksSave });
};

const normalizeDetail = (detail: InputIssue['detail']): InputIssue['detail'] => {
  if (detail === undefined) return undefined;
  for (const [key, value] of Object.entries(detail)) {
    requireNonEmptyText(key, 'detail-nøgle');
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('InputIssue: numeriske detailværdier skal være endelige');
    }
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error('InputIssue: detailværdier skal være string, number eller boolean');
    }
  }
  return Object.freeze({ ...detail });
};

const createAuthoritativeInputIssue = (value: InputIssueValue): InputIssue => {
  if (!(INPUT_ISSUE_REASONS as readonly unknown[]).includes(value.reason)) {
    throw new Error('InputIssue: ukendt reason');
  }
  if (value.severity !== 'error' && value.severity !== 'warning') {
    throw new Error('InputIssue: ukendt severity');
  }
  const policy = normalizePolicy(value.policy);
  if (value.reason === 'invalid' && (value.severity !== 'error' || !policy.blocksSave)) {
    throw new Error('InputIssue: invalid skal være error og blokere save');
  }

  const detail = normalizeDetail(value.detail);
  const issue = Object.freeze({
    ...value,
    policy,
    ...(detail === undefined ? {} : { detail }),
  }) as InputIssue;
  AUTHORITATIVE_INPUT_ISSUES.add(issue);
  return issue;
};

export const assertAuthoritativeInputIssue: (
  issue: unknown
) => asserts issue is InputIssue = (issue) => {
  if (typeof issue !== 'object' || issue === null || !AUTHORITATIVE_INPUT_ISSUES.has(issue)) {
    throw new Error('InputIssue: issue skal være oprettet af den autoritative factory');
  }
};

const formatMissingMessage = (field: FieldRefBase): string => {
  switch (field.definition.controlKind) {
    case 'choice':
      return `${field.definition.label} er ikke valgt`;
    case 'toggle':
      return `${field.definition.label} er ikke angivet`;
    case 'text':
      return `Feltet ${field.definition.label} er ikke udfyldt`;
  }
};

/** Danner de godkendte centrale beskeder uden at parse feltidentitet eller labels fra string keys. */
export const formatInputIssueMessage = (
  field: FieldRefBase,
  reason: 'invalid' | 'missing'
): string => reason === 'invalid'
  ? `Der er udfyldt en ugyldig værdi i feltet ${field.definition.label}`
  : formatMissingMessage(field);

export const createFieldInputIssue = (options: CreateFieldInputIssueOptions): InputIssue => {
  assertImmutableFieldRef(options.field);
  const isTemplatedIssue = options.reason === 'invalid' || options.reason === 'missing';
  const message = isTemplatedIssue
    ? formatInputIssueMessage(options.field, options.reason)
    : requireNonEmptyText('message' in options ? options.message : '', 'besked');
  // Rejected input er altid en error og skal altid blokere save. Missing er derimod
  // consumer-specifikt og kræver derfor en eksplicit save-policy.
  const policy = options.reason === 'invalid'
    ? BLOCK_SAVE_INPUT_ISSUE_POLICY
    : options.policy;

  return createAuthoritativeInputIssue({
    code: isTemplatedIssue
      ? `input.${options.reason}`
      : requireNonEmptyText('code' in options ? options.code : '', 'kode'),
    target: Object.freeze({ kind: 'field', field: options.field }),
    reason: options.reason,
    severity: options.reason === 'invalid' || options.reason === 'missing'
      ? 'error'
      : options.severity ?? 'error',
    message,
    policy,
    ...(options.detail === undefined ? {} : { detail: options.detail }),
  });
};

export const createOutputInputIssue = (options: CreateOutputInputIssueOptions): InputIssue => {
  if (options.reason !== 'schema' && options.reason !== 'rule') {
    throw new Error('InputIssue: output-issue skal have reason schema eller rule');
  }
  return createAuthoritativeInputIssue({
    code: requireNonEmptyText(options.code, 'kode'),
    target: Object.freeze({
      kind: 'output',
      outputId: requireNonEmptyText(options.outputId, 'output-id'),
      label: requireNonEmptyText(options.label, 'output-label'),
    }),
    reason: options.reason,
    severity: options.severity ?? 'error',
    message: requireNonEmptyText(options.message, 'besked'),
    policy: options.policy,
    ...(options.detail === undefined ? {} : { detail: options.detail }),
  });
};

export const isSaveBlockingIssue = (issue: InputIssue): boolean => {
  assertAuthoritativeInputIssue(issue);
  // Invalid fail-closer også defensivt her, selv om factoryen allerede håndhæver invarianten.
  return issue.reason === 'invalid' || (issue.severity === 'error' && issue.policy.blocksSave);
};

export const isDocumentBlockingIssue = (issue: InputIssue): boolean => {
  assertAuthoritativeInputIssue(issue);
  return issue.severity === 'error';
};

export const inputIssueTargetIdentityKey = (target: InputIssueTarget): string => target.kind === 'field'
  ? JSON.stringify(['field', serializeFieldAddress(target.field.address)])
  : JSON.stringify(['output', target.outputId]);

/** JSON-tuplen undgår kollisioner, selv når output-id eller issue-code indeholder separatorlignende tekst. */
export const inputIssueIdentityKey = (issue: InputIssue): string => {
  assertAuthoritativeInputIssue(issue);
  return JSON.stringify([inputIssueTargetIdentityKey(issue.target), issue.reason, issue.code]);
};

const detailKey = (detail: InputIssue['detail']): string => detail === undefined
  ? ''
  : JSON.stringify(Object.entries(detail).sort(([left], [right]) => compareText(left, right)));

export const inputIssuesAreSemanticallyEqual = (left: InputIssue, right: InputIssue): boolean => {
  assertAuthoritativeInputIssue(left);
  assertAuthoritativeInputIssue(right);
  return left.code === right.code
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
};

export const deduplicateInputIssues = (issues: readonly InputIssue[]): readonly InputIssue[] => {
  const seen = new Map<string, InputIssue>();
  const unique: InputIssue[] = [];
  for (const issue of issues) {
    assertAuthoritativeInputIssue(issue);
    const key = inputIssueIdentityKey(issue);
    const existing = seen.get(key);
    if (existing !== undefined) {
      if (!inputIssuesAreSemanticallyEqual(existing, issue)) {
        throw new Error(`InputIssue: konflikt mellem issues med identiteten '${key}'`);
      }
      continue;
    }
    seen.set(key, issue);
    unique.push(issue);
  }
  return Object.freeze(unique);
};

const SEVERITY_PRIORITY: Readonly<Record<InputIssueSeverity, number>> = {
  error: 0,
  warning: 1,
};

// Matcher overgangsmodellens normative source-rækkefølge: aktuelt rejected input først,
// derefter øvrige inputårsager, domæneregler og til sidst schemafejl.
const REASON_PRIORITY: Readonly<Record<InputIssueReason, number>> = {
  invalid: 0,
  missing: 1,
  bounds: 2,
  range: 3,
  rule: 4,
  schema: 5,
};

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const compareIssues = (left: InputIssue, right: InputIssue): number =>
  SEVERITY_PRIORITY[left.severity] - SEVERITY_PRIORITY[right.severity]
  || REASON_PRIORITY[left.reason] - REASON_PRIORITY[right.reason]
  || compareText(left.code, right.code)
  || compareText(left.message, right.message);

/**
 * Vælger højst ét aktivt issue for feltet. Sorteringen afhænger ikke af validator-/componentrækkefølge,
 * så samme afsluttede input altid giver samme synlige issue.
 */
export const resolveActiveFieldInputIssue = (
  field: FieldRefBase,
  issues: readonly InputIssue[]
): InputIssue | undefined => {
  const serializedAddress = serializeFieldAddress(field.address);
  return deduplicateInputIssues(issues)
    .filter((issue) => issue.target.kind === 'field'
      && serializeFieldAddress(issue.target.field.address) === serializedAddress
      && issue.target.field.definition === field.definition)
    .sort(compareIssues)[0];
};
