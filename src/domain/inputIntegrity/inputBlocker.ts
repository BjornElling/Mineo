/**
 * Generisk, domæne-neutral input-integritets-kontrakt (greenfield draft/commit-design, Fase 6.1).
 *
 * Dette er den lille tværgående kontrakt, der ligger FØR domænernes dokument-gates
 * (`document-output-contract.md §A2.1`, `form-contract.md §2.5`, `error-contract.md §3A`).
 * Hvert domæne ejer selv sine dependencies og bygger sin `DocumentDownloadGateResult` oven på
 * blockers herfra — der generaliseres bevidst IKKE en EO-specifik aggregator.
 *
 * Kerneidé: en `InputBlocker` beskriver, at et afhængigt felt gør et output ugyldigt, og bærer
 *  - en MASKINLÆSBAR årsag (`missing`/`invalid`) — aldrig gættet fra en beskedstreng,
 *  - en STABIL feltidentitet + brugervendt feltnavn, så beskeden altid kan navngive feltet,
 *  - et SCOPE (per-række/sektion/global), så en ugyldig celle i én række ikke over-blokerer
 *    de øvrige gyldige rækkers per-række-output.
 */

/**
 * Maskinlæsbar fejlårsag. `range` er en parsebar canonical værdi uden for det tilladte interval;
 * den hører hverken under `missing` eller `invalid`, men skal stadig kunne blokere det afhængige
 * output uden at ændre feltfejlens eksisterende save-semantik.
 */
export type InputBlockerReason =
  | 'missing' // påkrævet i konteksten, men feltet er tomt (gyldigt/undefined)
  | 'invalid' // feltets afsluttede tilstand er ikke-committbar (invalidDrafts)
  | 'range'; // parsebar canonical værdi uden for det tilladte interval

/**
 * Kontroltype — afgør den kontroltype-tilpassede `missing`-ordlyd (jf. error-contract.md §3A.2).
 * `invalid` er ensartet på tværs af kontroltyper.
 */
export type InputControlKind = 'text' | 'choice' | 'toggle';

/**
 * Afhængighedsscope for en blocker. En consumer angiver hvilket scope den afhænger af, så
 * blokeringen er præcis:
 *  - `global`: felt hele domænet afhænger af (fx renteberegningsdato),
 *  - `section`: felt der gør et aggregat-/sektions-output ugyldigt,
 *  - `row`: en konkret rækkes felt (bærer `rowId`), der kun blokerer den rækkes per-række-output
 *    (og aggregater der inkluderer rækken).
 */
export type InputScope =
  | Readonly<{ kind: 'global' }>
  | Readonly<{ kind: 'section' }>
  | Readonly<{ kind: 'row'; rowId: string }>;

export const globalScope = (): InputScope => ({ kind: 'global' });
export const sectionScope = (): InputScope => ({ kind: 'section' });
export const rowScope = (rowId: string): InputScope => ({ kind: 'row', rowId });

export type InputBlocker = Readonly<{
  /** Stabil feltidentitet (fieldPath). Bruges til fokus-mål og deduplikering. */
  fieldId: string;
  /** Brugervendt feltnavn, indsat i den centrale besked-skabelon. */
  fieldLabel: string;
  reason: InputBlockerReason;
  scope: InputScope;
  controlKind?: InputControlKind;
  /** Valgfri domæne-specifik uddybning (fx hvilken betingelse gør feltet påkrævet). */
  detail?: string;
}>;

/**
 * Diskrimineret domæneprojektion: enten en `ready`-data-gren eller en `blocked`-gren med blockers.
 * Den tidligere canonical værdi må ALDRIG være tilgængelig i den blokerede gren — er et relevant
 * felt ugyldigt, kan `ready.data` ikke dannes.
 */
declare const READY_INPUT_REVISION: unique symbol;

/** Revision der kun kan udstedes sammen med en ready-projektion. */
export type ReadyInputRevision = number & { readonly [READY_INPUT_REVISION]: true };

export type InputProjection<T> =
  | Readonly<{ status: 'ready'; data: T; revision: ReadyInputRevision }>
  | Readonly<{ status: 'blocked'; blockers: readonly InputBlocker[]; revision: number }>;

export const readyInputProjection = <T>(
  data: T,
  revision: number
): Extract<InputProjection<T>, { status: 'ready' }> => ({
  status: 'ready',
  data,
  revision: revision as ReadyInputRevision,
});

export const blockedInputProjection = <T>(
  blockers: readonly InputBlocker[],
  revision: number
): Extract<InputProjection<T>, { status: 'blocked' }> => ({ status: 'blocked', blockers, revision });

/**
 * Central besked-skabelon: danner den brugervendte, navngivne fejltekst ud fra `reason` +
 * kontroltype + feltnavn. Ordlyden er UI/UX-godkendt (error-contract.md §3A.2) og forenelig med
 * "ikke udfyldt/angivet/valgt"-konventionen — aldrig et bart "<felt> mangler".
 */
export const formatInputBlockerMessage = (blocker: InputBlocker): string => {
  if (blocker.reason === 'range') {
    return blocker.detail ?? `Værdien i feltet ${blocker.fieldLabel} er uden for det tilladte interval`;
  }
  if (blocker.reason === 'invalid') {
    return `Der er udfyldt en ugyldig værdi i feltet ${blocker.fieldLabel}`;
  }
  switch (blocker.controlKind) {
    case 'choice':
      return `${blocker.fieldLabel} er ikke valgt`;
    case 'toggle':
      return `${blocker.fieldLabel} er ikke angivet`;
    case 'text':
    default:
      return `Feltet ${blocker.fieldLabel} er ikke udfyldt`;
  }
};
