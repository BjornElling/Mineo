/**
 * Reader-afledte EO-issues til inspektion-echo, kontroltabel og dokumentgate.
 *
 * **Én issue pr. felt — ikke et source-register (Fase 6, genåbnet).** Modellen havde tidligere en
 * `source`-union (`'input' | 'schema' | 'rule' | 'invalid-draft'`), et source-keyed map pr. felt og en
 * prioriteret liste til at vælge mellem samtidige kilder. Det var den gamle reporter-/store-models algebra:
 * dengang kunne flere uafhængige rapportører skrive på det samme felt, og prioriteten afgjorde hvem der vandt.
 *
 * Den mekanisme findes ikke. `InputReader.read` giver PRÆCIS ét issue pr. felt, og `error-contract.md` §11
 * forbyder eksplicit source-registre og syntetiske `invalid-draft`-entries. Et map med plads til fire kilder,
 * hvor kun én nogensinde kunne være udfyldt, var derfor en tom dimension, som downstream-rækkemodellen alligevel
 * skulle folde ud igen. Formen her er nu den readeren faktisk leverer.
 */
export type EoInputIssueSeverity = 'error' | 'warning';

/** Samme årsagssæt som greenfield-kernens `FieldIssueReason`, plus det syntetiske celle-aggregat. */
export type EoInputIssueReason = 'format' | 'bounds' | 'rule' | 'schema' | 'aggregate';

export type EoInputIssue = Readonly<{
  message: string;
  severity: EoInputIssueSeverity;
  /**
   * Readerens årsag, båret UÆNDRET videre (§1.6). Konsekvensen udledes STRUKTURELT herfra — der lagres ingen
   * boolean for blokering, som ville kunne komme i modstrid med årsagen. Se `eoIssueBlocksDependents`.
   */
  reason: EoInputIssueReason;
}>;

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
 * Dette er det ENE sted, blokerings-konsekvensen udledes.
 */
export const eoIssueBlocksDependents = (issue: EoInputIssue | undefined): issue is EoInputIssue =>
  issue !== undefined && issue.severity === 'error';

/**
 * Feltnøgle → issue. Nøglen er et top-level feltnavn eller det syntetiske `${entityId}:loenindkomst`-aggregat.
 *
 * Bevidst ét issue pr. nøgle: readeren har ikke mere at give. En `Partial<Record<…>>` med `undefined` for
 * felter uden issue er den samme repræsentation, resten af projektionslaget bruger.
 */
export type EoInputIssues = Partial<Record<string, EoInputIssue>>;

/** Stamdata og EO bruger samme issue-form, men beholdes som særskilte aliases ved domænegrænsen. */
export type EoStamdataInputIssues = EoInputIssues;

/**
 * Entity-id'er, hvis syntetiske `${id}${suffix}`-issue blokerer de afhængige consumers.
 *
 * Den ENE implementering: både EO-siden, beregnings-view-modellen og dokumentgaten bruger denne. Tidligere
 * fandtes to næsten-identiske kopier (én over legacy-fejltypen, én lokal i download-gaten), som kunne drifte.
 */
export const selectBlockingEoEntityIdsBySuffix = (
  issues: EoInputIssues,
  suffix: string
): Readonly<Record<string, true>> => {
  const ids: Record<string, true> = {};
  for (const [fieldKey, issue] of Object.entries(issues)) {
    if (!fieldKey.endsWith(suffix)) continue;
    if (!eoIssueBlocksDependents(issue)) continue;
    const entityId = fieldKey.slice(0, -suffix.length);
    if (entityId !== '') ids[entityId] = true;
  }
  return ids;
};
