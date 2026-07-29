import { serializeFieldAddress, type SerializedFieldAddress } from './fieldAddress';
import type { AnyFieldRef } from './fieldDescriptor';
import type { EvaluationSourceToken } from './evaluationSource';

// Greenfield-kerne (§3.4/§1.6): issue-modellen skelner mellem feltfejl, consumerfejl og warning. Der lagres
// INGEN `blocksSave`/`blocksProjection`-booleans. Konsekvensen udledes STRUKTURELT af kind + placering +
// consumerens faktiske reads — ikke af et konfigurerbart flag. Save-blokering følger `rejectedInputs`, ikke
// issuefarve (§1.6): kun rejected råtekst blokerer `.eo`; en canonical bounds/rule-feltfejl kan gemmes.
// Selve save-projektionen ligger ved persistence-grænsen, ikke i issue-modellen.

/**
 * Rød feltfejl-årsag. `format` er den eneste rejected-råtekst-årsag (§1.6); bounds/rule/schema udledes af en
 * canonical værdi via en feltvalidator og forbliver derfor gembar i `.eo`.
 */
export type FieldIssueReason = 'format' | 'bounds' | 'rule' | 'schema';

export type IssueDetail = Readonly<Record<string, string | number | boolean>>;

/**
 * En rød feltfejl. Blokerer enhver afhængig consumer (§1.6, §1.10). Den blokerer KUN `.eo`, hvis feltets
 * aktuelle tilstand er rejected råtekst (`format`); en canonical bounds/rule-feltfejl kan gemmes. Save-gaten
 * læses strukturelt af `projectEoSave` over `rejectedInputs`, ikke af issuefarve eller reason.
 */
export type FieldIssue = Readonly<{
  kind: 'field';
  code: string;
  severity: 'error';
  field: AnyFieldRef;
  reason: FieldIssueReason;
  message: string;
  detail?: IssueDetail;
}>;

/** En consumer-fejl (fx `missing`). Ingen rød markering; blokerer KUN den konkrete consumer (§1.7). */
export type ConsumerIssue = Readonly<{
  kind: 'consumer';
  code: string;
  severity: 'error';
  consumerId: string;
  reason: 'missing' | 'rule';
  message: string;
  field?: AnyFieldRef;
  detail?: IssueDetail;
}>;

/**
 * Kernen har INGEN warning-variant.
 *
 * §1.7's regel — *en warning blokerer aldrig beregning, dokument eller `.eo`* — er fortsat normativ, men
 * den håndhæves DÉR, hvor advarsler faktisk dannes: i domænernes egne typer (`EetIssue.severity`,
 * `EoRowStatus`, `IntegrityIssue.severity`). Kernen bar tidligere en generisk `Warning` plus en
 * `ProjectionCollector.warn` og et `ProjectionResult.warnings`-felt. Kortlægningen i etape 10 (INC-F17)
 * viste, at ingen af de tre havde en eneste producent eller læser i produktionen: warnings nåede aldrig
 * kernen, og `warnings`-feltet blev kun ført videre af `mapReadyProjection` til ingen.
 *
 * En kanal, intet skriver til og intet læser fra, er ikke en capability men en gren, ingen tilstand kan
 * nå — og den ville have inviteret næste læser til at tro, at kernen ejede advarselsmodellen. Den er
 * derfor slettet frem for bevaret; genindføres et behov for advarsler i kernen, skal både producent og
 * læser komme til i samme ændring.
 */
export type InputIssue = FieldIssue | ConsumerIssue;

// Deterministisk prioritet (§1.8): den mest direkte feltfejl vinder, uafhængigt af validator-rækkefølge.
const FIELD_REASON_PRIORITY: Readonly<Record<FieldIssueReason, number>> = {
  format: 0,
  bounds: 1,
  rule: 2,
  schema: 3,
};

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const compareFieldIssues = (left: FieldIssue, right: FieldIssue): number =>
  FIELD_REASON_PRIORITY[left.reason] - FIELD_REASON_PRIORITY[right.reason]
  || compareText(left.code, right.code)
  || compareText(left.message, right.message);

/**
 * Bygger den konkrete danske besked for et rejected (format) feltinput uden at reparse råteksten (§1.8).
 * Bounds-/range-beskeder hører til canonical feltvalidatorer (`FieldIssueSpec.message`), ikke hertil, fordi en
 * out-of-bounds-værdi efter kravændringen 2026-07-18 er canonical og ikke rejected råtekst (§1.6).
 */
export const buildFieldIssueMessage = (field: AnyFieldRef): string =>
  `Der er udfyldt en ugyldig værdi i feltet ${field.descriptor.label}`;

/**
 * Immutabelt feltissue-snapshot: højst ét aktivt rødt issue pr. felt (§1.8). Bygges af feltvalidatorerne
 * fra afsluttet input; mounted komponenter rapporterer aldrig ind i det (§1.8/§3.4).
 */
export type FieldIssueSet = Readonly<{
  get: (address: SerializedFieldAddress) => FieldIssue | undefined;
  all: readonly FieldIssue[];
}>;

export type FieldIssueSnapshot = FieldIssueSet & Readonly<{
  sourceToken: EvaluationSourceToken;
}>;

export const buildFieldIssueSet = (issues: readonly FieldIssue[]): FieldIssueSet => {
  const grouped = new Map<SerializedFieldAddress, FieldIssue[]>();
  for (const candidate of issues) {
    const issue: FieldIssue = Object.freeze({
      ...candidate,
      ...(candidate.detail === undefined ? {} : { detail: Object.freeze({ ...candidate.detail }) }),
    });
    const key = serializeFieldAddress(issue.field.address);
    const bucket = grouped.get(key);
    if (bucket === undefined) grouped.set(key, [issue]);
    else bucket.push(issue);
  }
  const byAddress = new Map<SerializedFieldAddress, FieldIssue>();
  const all: FieldIssue[] = [];
  for (const [key, bucket] of grouped) {
    const active = [...bucket].sort(compareFieldIssues)[0];
    byAddress.set(key, active);
    all.push(active);
  }
  return Object.freeze({
    get: (address: SerializedFieldAddress) => byAddress.get(address),
    all: Object.freeze(all),
  });
};

export const EMPTY_FIELD_ISSUE_SET: FieldIssueSet = buildFieldIssueSet([]);

export const bindFieldIssueSnapshot = (
  issues: FieldIssueSet,
  sourceToken: EvaluationSourceToken
): FieldIssueSnapshot => Object.freeze({
  sourceToken,
  get: issues.get,
  all: issues.all,
});

export const activeFieldIssue = (
  snapshot: FieldIssueSet,
  address: SerializedFieldAddress
): FieldIssue | undefined => snapshot.get(address);
