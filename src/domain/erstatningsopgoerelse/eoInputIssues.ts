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
  /**
   * Readerens årsag, båret UÆNDRET videre (§1.6). Konsekvensen udledes STRUKTURELT herfra — der lagres ingen
   * `blocksSave`-boolean, som ville kunne komme i modstrid med årsagen. Se `eoIssueBlocksDependents`.
   */
  reason: EoInputIssueReason;
}>;

/** Samme årsagssæt som greenfield-kernens `FieldIssueReason`, plus det syntetiske celle-aggregat. */
export type EoInputIssueReason = 'format' | 'bounds' | 'rule' | 'schema' | 'aggregate';

/**
 * Blokerer denne issue de afhængige EO-consumers (dokumentgate/rækkeevaluering)?
 *
 * En canonical `bounds`-feltfejl er BEVIDST ikke-blokerende: værdien er gembar (§1.6), og fejlen skal være
 * synlig uden at spærre dokumentet. Alle øvrige røde årsager blokerer. Dette er det ENE sted, konsekvensen
 * udledes — tidligere var den kodet som et `blocksSave`-flag på hver enkelt issue.
 */
export const eoIssueBlocksDependents = (issue: EoInputIssue | undefined): boolean =>
  issue !== undefined && issue.severity === 'error' && issue.reason !== 'bounds';

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

/**
 * Entity-id'er, hvis syntetiske `${id}${suffix}`-issue blokerer de afhængige consumers.
 *
 * Den ENE implementering: både EO-siden, beregnings-view-modellen og dokumentgaten bruger denne. Tidligere
 * fandtes to næsten-identiske kopier (én i `utils/fieldErrorSelectors` over legacy-fejltypen, én lokal i
 * download-gaten), som kunne drifte fra hinanden.
 */
export const selectBlockingEoEntityIdsBySuffix = (
  issues: EoInputIssues,
  suffix: string
): Readonly<Record<string, true>> => {
  const ids: Record<string, true> = {};
  for (const [fieldKey, bySource] of Object.entries(issues)) {
    if (!fieldKey.endsWith(suffix) || bySource === undefined) continue;
    if (!Object.values(bySource).some(eoIssueBlocksDependents)) continue;
    const entityId = fieldKey.slice(0, -suffix.length);
    if (entityId !== '') ids[entityId] = true;
  }
  return ids;
};
