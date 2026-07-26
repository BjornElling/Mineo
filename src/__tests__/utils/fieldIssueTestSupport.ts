import type { AnyFieldRef } from '../../inputCore/fieldDescriptor';
import {
  buildFieldIssueSet,
  type FieldIssue,
  type FieldIssueReason,
  type FieldIssueSet,
} from '../../inputCore/inputIssue';

type TestFieldIssue = Readonly<{
  field: AnyFieldRef;
  message: string;
  reason?: FieldIssueReason;
}>;

export const buildTestFieldIssueSetFrom = (
  issues: readonly TestFieldIssue[]
): FieldIssueSet => buildFieldIssueSet(issues.map((issue): FieldIssue => ({
  kind: 'field',
  code: 'test.field-issue',
  severity: 'error',
  field: issue.field,
  reason: issue.reason ?? 'rule',
  message: issue.message,
})));

export const buildTestFieldIssueSet = (
  field: AnyFieldRef,
  message: string,
  reason: FieldIssueReason = 'rule'
): FieldIssueSet => buildTestFieldIssueSetFrom([{
  field,
  reason,
  message,
}]);
