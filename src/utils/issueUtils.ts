type IssueWithSeverityAndMessage = Readonly<{
  severity: string;
  message: string;
}>;

export const dedupeIssuesBySeverityAndMessage = <TIssue extends IssueWithSeverityAndMessage>(
  issues: readonly TIssue[]
): TIssue[] => {
  const seen = new Set<string>();
  const unique: TIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.severity}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(issue);
  }
  return unique;
};
