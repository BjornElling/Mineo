import {
  type FieldIssue,
  type FieldIssueSet,
} from '../../inputCore/inputIssue';
import type { FieldAddress, SectionKey } from '../../inputCore/fieldAddress';
import { erstatningsopgoerelseFields } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';

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
 * Feltadressen for en validator-STI, hvis stien navngiver ét top-level EO-felt.
 *
 * Findes til sikkerhedsnettet i "Fejl og advarsler" (`blocking-invariant:*`): en autoritativt blokerende
 * validerings-invariant, som INGEN row-builder har dækket, blev vist som ren tekst uden link, fordi der
 * ikke fandtes en EO-række at route fra. Invarianten bærer til gengæld validatorens egen `path` som
 * `evidence`, og de top-level stier ER descriptorens feltnavn (fx `uspecificeredeFerieFridage`).
 *
 * Opslaget sker mod produktionens EGET descriptor-katalog frem for en håndskrevet id→felt-tabel, så et
 * omdøbt felt ikke kan efterlade en tabel, der stille peger på ingenting. Sti-former, kataloget ikke
 * kender — nested rækker (`tafPerioder[0].fra`), indekser, sammensatte regler — giver `undefined`: så
 * bevarer nettet sin nuværende, sande adfærd (tekst uden link) frem for at gætte et felt.
 */
export const resolveEoValidationPathAddress = (
  path: string | undefined
): FieldAddress | undefined => {
  if (path === undefined || path === '' || path.includes('.') || path.includes('[')) return undefined;
  const descriptor = erstatningsopgoerelseFields.find(
    (field) => field.template.path.length === 0 && field.template.field === path
  );
  return descriptor?.bind().address;
};

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
