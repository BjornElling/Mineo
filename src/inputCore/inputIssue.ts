import { serializeFieldAddress, type SerializedFieldAddress } from './fieldAddress';
import type { AnyFieldRef } from './fieldDescriptor';

// Greenfield-kerne (§3.4/§1.6): issue-modellen skelner mellem feltfejl, consumerfejl og warning. Der lagres
// INGEN `blocksSave`/`blocksProjection`-booleans. Konsekvensen udledes STRUKTURELT af kind + placering +
// consumerens faktiske reads — ikke af et konfigurerbart flag.

/** Rød feltfejl: format/range (rejected råtekst) eller bounds/rule/schema (afledt af canonical værdi). */
export type FieldIssueReason = 'format' | 'range' | 'bounds' | 'rule' | 'schema';

export type IssueDetail = Readonly<Record<string, string | number | boolean>>;

/** En rød feltfejl. Blokerer ALTID `.eo` globalt og enhver afhængig consumer (§1.6, §1.10). */
export type FieldIssue = Readonly<{
  kind: 'field';
  field: AnyFieldRef;
  reason: FieldIssueReason;
  message: string;
  detail?: IssueDetail;
}>;

/** En consumer-fejl (fx `missing`). Ingen rød markering; blokerer KUN den konkrete consumer (§1.7). */
export type ConsumerIssue = Readonly<{
  kind: 'consumer';
  consumerId: string;
  reason: 'missing' | 'rule';
  message: string;
  field?: AnyFieldRef;
  detail?: IssueDetail;
}>;

/** En warning. Vises, men blokerer aldrig beregning, dokument eller `.eo` (§1.7). */
export type Warning = Readonly<{
  kind: 'warning';
  message: string;
  field?: AnyFieldRef;
  consumerId?: string;
  detail?: IssueDetail;
}>;

export type InputIssue = FieldIssue | ConsumerIssue | Warning;

/** Enhver aktiv rød feltfejl blokerer `.eo` globalt (§1.10). Missing/warning gør aldrig. */
export const blocksEoSave = (issue: InputIssue): boolean => issue.kind === 'field';

/** Feltfejl og consumerfejl blokerer en afhængig consumer; warnings gør ikke (§1.6/§1.7). */
export const blocksConsumer = (issue: InputIssue): boolean =>
  issue.kind === 'field' || issue.kind === 'consumer';

// Deterministisk prioritet (§1.8): den mest direkte feltfejl vinder, uafhængigt af validator-rækkefølge.
const FIELD_REASON_PRIORITY: Readonly<Record<FieldIssueReason, number>> = {
  format: 0,
  range: 1,
  bounds: 2,
  rule: 3,
  schema: 4,
};

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

export const compareFieldIssues = (left: FieldIssue, right: FieldIssue): number =>
  FIELD_REASON_PRIORITY[left.reason] - FIELD_REASON_PRIORITY[right.reason]
  || compareText(left.message, right.message);

const formatBound = (value: string | number | boolean | undefined): string => String(value);

/**
 * Bygger den konkrete danske besked for en format-/range-feltfejl uden at reparse råteksten (§1.8).
 * Range-beskeden viser de faktiske grænser; hvis `min > max`, forklares det, at ingen værdier findes.
 */
export const buildFieldIssueMessage = (
  field: AnyFieldRef,
  reason: 'format' | 'range',
  detail: IssueDetail | undefined
): string => {
  const label = field.descriptor.label;
  if (reason === 'format') {
    switch (field.descriptor.controlKind) {
      case 'choice': return `${label} har et ugyldigt valg`;
      case 'toggle': return `${label} har en ugyldig værdi`;
      case 'text': return `Der er udfyldt en ugyldig værdi i feltet ${label}`;
    }
  }
  const min = detail?.minValue;
  const max = detail?.maxValue;
  if (typeof min === 'number' && typeof max === 'number') {
    if (min > max) {
      return `${label} har ingen gyldige værdier: den nedre grænse ${formatBound(min)} er større end den øvre grænse ${formatBound(max)}`;
    }
    if (min === max) return `${label} skal være ${formatBound(min)}`;
    return `${label} skal være mellem ${formatBound(min)} og ${formatBound(max)}`;
  }
  if (min !== undefined) return `${label} skal være ${formatBound(min)} eller højere`;
  if (max !== undefined) return `${label} skal være ${formatBound(max)} eller lavere`;
  return `${label} er uden for det tilladte interval`;
};

/**
 * Immutabelt feltissue-snapshot: højst ét aktivt rødt issue pr. felt (§1.8). Bygges af feltvalidatorerne
 * fra afsluttet input; mounted komponenter rapporterer aldrig ind i det (§1.8/§3.4).
 */
export type FieldIssueSnapshot = Readonly<{
  byAddress: ReadonlyMap<SerializedFieldAddress, FieldIssue>;
  all: readonly FieldIssue[];
}>;

export const buildFieldIssueSnapshot = (issues: readonly FieldIssue[]): FieldIssueSnapshot => {
  const grouped = new Map<SerializedFieldAddress, FieldIssue[]>();
  for (const issue of issues) {
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
  return Object.freeze({ byAddress, all: Object.freeze(all) });
};

export const activeFieldIssue = (
  snapshot: FieldIssueSnapshot,
  address: SerializedFieldAddress
): FieldIssue | undefined => snapshot.byAddress.get(address);
