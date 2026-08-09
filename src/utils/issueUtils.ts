type IdentifiedIssue = Readonly<{
  id: string;
  severity: string;
  message: string;
}>;

/**
 * Samler kun samme identificerede domænefejl.
 *
 * Beskedtekst alene er ikke identitet: to forskellige felt-/output-issues kan legitimt have samme danske tekst. Omvendt
 * er et afsluttende punktum kun præsentation, så parallelle producenter ikke kan vise samme issue to gange på
 * grund af den forskel. Den første forekomst bevares altid, så deduplikering aldrig fjerner forklaringen.
 */
const normalizeMessageForIssueIdentity = (message: string): string => {
  const trimmed = message.trim();
  return trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
};

export const dedupeIssuesByIdentity = <TIssue extends IdentifiedIssue>(
  issues: readonly TIssue[]
): TIssue[] => {
  const seen = new Set<string>();
  const unique: TIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.id}|${issue.severity}|${normalizeMessageForIssueIdentity(issue.message)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(issue);
  }
  return unique;
};
