import { serializeFieldAddress } from '../../inputCore/fieldAddress';
import type { EoNavigableIssueRow } from '../eoRowEvaluation/eoRowAggregator';
import type { EoInvariant } from './snapshot/eoSnapshotInvariants';
import { resolveEoValidationPathAddress } from './eoInputIssues';

/**
 * Hvilke autoritativt blokerende invarianter sikkerhedsnettet i «Fejl og advarsler» skal vise.
 *
 * Garantien er, at download aldrig blokeres uden en synlig fejl. Nettet viste før KUN noget, når boksen ellers
 * var tom for fejl – så en regel, der kun fandtes i validatoren, forsvandt, så snart en anden fejl stod i
 * boksen, og dukkede først op, når brugeren havde rettet den (BB-265). Brugeren rettede det, boksen viste, og
 * fik en ny fejl, han ikke kunne se før.
 *
 * Nu gælder to trin:
 * 1. Er boksen ellers tom, vises alle (som før): de er den eneste forklaring på blokeringen.
 * 2. Ellers vises en VALIDATORREGEL om et navngivet EO-felt, medmindre en vist række allerede dækker den – fordi
 *    rækken peger på samme felt, eller fordi dens tekst indeholder reglens besked. Kravet om en feltsti holder
 *    nettet fra at gentage rækkeformede regler (TAF-rækker, lønindkomst, sygeferiegodtgørelse), som hver har
 *    deres egen linje; dækningsprøven holder det fra at gentage en linje om samme felt (udviklerkrav 2026-10-02:
 *    ingen dobbelte fejlmeddelelser, der begge skyldes og peger på samme felt).
 *
 * Funktionen er ren. Downloadgaten forudsætter dens garanti – at boksen altid viser en fejl, når en invariant
 * blokerer – og henviser derfor til boksen (`eoDocumentDownloadGate.ts`).
 */
export const selectEoSafetyNetInvariants = (input: Readonly<{
  authoritativeBlockingInvariants: readonly EoInvariant[];
  /** De fejl og advarsler, boksen viser fra rækkeevalueringen. */
  displayedRows: readonly Pick<EoNavigableIssueRow, 'label' | 'displayValue' | 'message' | 'summaryText' | 'focusTarget'>[];
  /** Viser boksen allerede fejl-niveau-indhold (rækkefejl, systemfejl, EET-fejl)? */
  hasOtherErrorContent: boolean;
}>): readonly EoInvariant[] => {
  // EET-kilde-invarianter har deres egen visningskanal (`eetLoebendeIssueRows`) og må ikke dubleres her.
  const candidates = input.authoritativeBlockingInvariants
    .filter((invariant) => !invariant.id.startsWith('midlertidigt_eet_source:'));
  if (!input.hasOtherErrorContent) return candidates;

  const coveredAddresses = new Set(input.displayedRows.flatMap((row) =>
    row.focusTarget?.kind === 'fieldAddress' ? [serializeFieldAddress(row.focusTarget.address)] : []));
  const displayedTexts = input.displayedRows.map((row) =>
    [row.label, row.displayValue, row.message ?? '', row.summaryText ?? ''].join('\n'));

  return candidates.filter((invariant) => {
    if (!invariant.id.startsWith('validation:')) return false;
    const address = resolveEoValidationPathAddress(invariant.evidence?.[0]);
    if (address === undefined) return false;
    if (coveredAddresses.has(serializeFieldAddress(address))) return false;
    const message = invariant.message.trim();
    return !displayedTexts.some((text) => text.includes(message));
  });
};
