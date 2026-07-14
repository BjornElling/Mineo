import { serializeFieldAddress } from './fieldAddress';
import type { FieldRefBase } from './fieldDefinition';

export type InputIssueReason = 'invalid' | 'missing' | 'range' | 'bounds' | 'schema' | 'rule';
export type InputIssueSeverity = 'error' | 'warning';

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

export type InputIssue = Readonly<{
  code: string;
  target: InputIssueTarget;
  reason: InputIssueReason;
  severity: InputIssueSeverity;
  message: string;
  policy: InputIssuePolicy;
  detail?: Readonly<Record<string, string | number | boolean>>;
}>;

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
  const isTemplatedIssue = options.reason === 'invalid' || options.reason === 'missing';
  const message = isTemplatedIssue
    ? formatInputIssueMessage(options.field, options.reason)
    : requireNonEmptyText('message' in options ? options.message : '', 'besked');
  // Rejected input er altid en error og skal altid blokere save. Missing er derimod
  // consumer-specifikt og kræver derfor en eksplicit save-policy.
  const policy = options.reason === 'invalid'
    ? BLOCK_SAVE_INPUT_ISSUE_POLICY
    : options.policy;

  return Object.freeze({
    code: isTemplatedIssue
      ? `input.${options.reason}`
      : requireNonEmptyText('code' in options ? options.code : '', 'kode'),
    target: Object.freeze({ kind: 'field', field: options.field }),
    reason: options.reason,
    severity: options.reason === 'invalid' || options.reason === 'missing'
      ? 'error'
      : options.severity ?? 'error',
    message,
    policy: Object.freeze({ ...policy }),
    ...(options.detail === undefined ? {} : { detail: Object.freeze({ ...options.detail }) }),
  });
};

export const createOutputInputIssue = (options: CreateOutputInputIssueOptions): InputIssue => Object.freeze({
  code: requireNonEmptyText(options.code, 'kode'),
  target: Object.freeze({
    kind: 'output',
    outputId: requireNonEmptyText(options.outputId, 'output-id'),
    label: requireNonEmptyText(options.label, 'output-label'),
  }),
  reason: options.reason,
  severity: options.severity ?? 'error',
  message: requireNonEmptyText(options.message, 'besked'),
  policy: Object.freeze({ ...options.policy }),
  ...(options.detail === undefined ? {} : { detail: Object.freeze({ ...options.detail }) }),
});

export const isSaveBlockingIssue = (issue: InputIssue): boolean =>
  issue.severity === 'error' && issue.policy.blocksSave;

export const isDocumentBlockingIssue = (issue: InputIssue): boolean =>
  issue.severity === 'error';

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
  return issues
    .filter((issue) => issue.target.kind === 'field'
      && serializeFieldAddress(issue.target.field.address) === serializedAddress
      && issue.target.field.definition === field.definition)
    .sort(compareIssues)[0];
};
