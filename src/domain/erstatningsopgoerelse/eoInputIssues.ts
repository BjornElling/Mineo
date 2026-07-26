import {
  type FieldIssue,
  type FieldIssueSet,
} from '../../inputCore/inputIssue';
import type { SectionKey } from '../../inputCore/fieldAddress';

/**
 * EO bruger den kanoniske strukturelle issue-model direkte.
 *
 * Der findes ingen EO-specifik issuealgebra, string-key-map eller syntetisk rækkeissue. Præsentationslaget
 * slår issues op på deres faktiske feltadresse, og dependency-gating modtager samme `FieldIssue[]`.
 */
/** Finder et top-level feltissue ved dets faktiske strukturelle adresse. */
export const topLevelFieldIssue = (
  issues: FieldIssueSet,
  section: SectionKey,
  field: string
): FieldIssue | undefined => issues.all.find((issue) =>
  issue.field.address.section === section
  && issue.field.address.path.length === 0
  && issue.field.address.field === field
);

/**
 * Ansættelsesforhold med en rød issue i en af de tre nested løntabeller.
 *
 * Entity-id'et udledes af den faktiske adresse; der konstrueres ikke længere `${id}:loenindkomst`-nøgler.
 */
export const selectBlockingLoenindkomstEntityIds = (
  issues: FieldIssueSet
): Readonly<Record<string, true>> => {
  const ids: Record<string, true> = {};
  for (const issue of issues.all) {
    const [employment, nested] = issue.field.address.path;
    if (
      employment?.kind !== 'entity'
      || employment.collection !== 'loenindkomstAnsaettelsesforhold'
      || nested?.kind !== 'entity'
      || ![
        'indtaegtsoplysningerTableData',
        'loenudviklingManuelTableData',
        'loenudviklingManuelProcentsatsTableData',
      ].includes(nested.collection)
    ) {
      continue;
    }
    ids[employment.entityId] = true;
  }
  return Object.freeze(ids);
};
