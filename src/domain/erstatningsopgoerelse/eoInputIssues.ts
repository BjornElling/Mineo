/**
 * Reader-afledte EO-issues til snapshot, kontrol og dokumentgate. De er rene, tokenbundne data — ikke den
 * tidligere mounted reporter-/store-model. Formen bevarer kun den information, EO's eksisterende præsentationer
 * faktisk bruger, så en reader-issue kan vises og gate korrekt uden en afhængighed til legacy-fejltyper.
 */
export type EoInputIssueSource = 'input' | 'schema' | 'rule' | 'invalid-draft';
export type EoInputIssueSeverity = 'error' | 'warning';

export type EoInputIssue = Readonly<{
  message: string;
  severity: EoInputIssueSeverity;
  source: EoInputIssueSource;
  blocksSave?: boolean;
}>;

export type EoFieldIssuesBySource = Partial<Record<EoInputIssueSource, EoInputIssue>>;
export type EoInputIssues = Partial<Record<string, EoFieldIssuesBySource>>;

/** Stamdata og EO bruger samme issue-form, men beholdes som særskilte aliases ved domænegrænsen. */
export type EoStamdataInputIssues = EoInputIssues;

export const EO_INPUT_ISSUE_SOURCE_PRIORITY: readonly EoInputIssueSource[] = [
  'invalid-draft',
  'input',
  'rule',
  'schema',
];
