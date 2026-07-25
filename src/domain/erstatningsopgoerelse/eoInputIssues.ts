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
 * Blokerer denne issue de afhængige EO-consumers (beregning/dokumentgate/rækkeevaluering)?
 *
 * Enhver rød årsag blokerer de AFHÆNGIGE consumers — inklusive `bounds`. Det følger direkte af
 * `error-contract.md` §1.1's normative konsekvensmatrix: en `range`/`bounds`-fejl på en canonical værdi
 * blokerer IKKE `.eo` globalt, men blokerer JA den beregning og det dokument, der læser feltet.
 *
 * ⚠️ SAMMENBLAND IKKE "gembar" med "beregnbar". Denne funktion havde tidligere `reason !== 'bounds'` med
 * begrundelsen "værdien er gembar (§1.6)". Det var en konflatering: gembarheden afgøres af save-gaten
 * (som kun standser aktivt rejected råinput, §3.9), ikke her. Konsekvensen var, at fx en forligsprocent på
 * 150 blev maskeret til tomværdi og derefter regnet som 100 % — et falsk tal bag en rød feltmarkering.
 * En bounds-værdi må gemmes; den må ikke fodre en motor.
 *
 * Dette er det ENE sted, blokerings-konsekvensen udledes — tidligere var den kodet som et `blocksSave`-flag
 * på hver enkelt issue, hvor den kunne drifte fra årsagen.
 */
export const eoIssueBlocksDependents = (issue: EoInputIssue | undefined): boolean =>
  issue !== undefined && issue.severity === 'error';

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
