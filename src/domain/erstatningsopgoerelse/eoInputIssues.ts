import {
  type FieldIssue,
  type FieldIssueSet,
} from '../../inputCore/inputIssue';
import type { FieldAddress, SectionKey } from '../../inputCore/fieldAddress';
import { erstatningsopgoerelseFields } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { EO_ANGIVET_LOEN_ID } from './helpers/angivetLoenHelpers';

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
 * kender – nested rækker (`tafPerioder[0].fra`), indekser, sammensatte regler – giver `undefined`: så
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
  const fieldIssues = selectBlockingLoenindkomstFieldIssues(issues);
  const ids: Record<string, true> = {};
  for (const employmentId of Object.keys(fieldIssues)) {
    ids[employmentId] = true;
  }
  return Object.freeze(ids);
};

/**
 * Feltissues på et ansættelsesforholds EGNE felter (navn, datoer, satser, anciennitet, løntrin) – ikke
 * cellerne i de nested tabeller – grupperet pr. ansættelsesforhold i feltkatalogets rækkefølge.
 *
 * Findes, så en rød værdi på kortet får sin egen linje med feltets navn og link i «Fejl og advarsler». Før nåede
 * en bounds-fejl som «Arbejdsgivers pensionsbidrag» `150` kun boksen gennem sikkerhedsnettet: én linje uden
 * feltnavn, kortets navn eller link, og den forsvandt helt, så snart en anden fejl stod i boksen (BB-277).
 */
export const selectLoenindkomstKortFieldIssues = (
  issues: FieldIssueSet
): Readonly<Record<string, readonly FieldIssue[]>> => {
  const byEmployment: Record<string, FieldIssue[]> = {};
  for (const issue of issues.all) {
    const [employment, ...rest] = issue.field.address.path;
    if (
      employment?.kind !== 'entity'
      || employment.collection !== 'loenindkomstAnsaettelsesforhold'
      || rest.length > 0
    ) {
      continue;
    }
    (byEmployment[employment.entityId] ??= []).push(issue);
  }
  return Object.freeze(byEmployment);
};

/**
 * Finder den første konkrete celleissue pr. ansættelsesforhold i lønindkomstens nested tabeller.
 *
 * Row-builderen bruger resultatet til at pege på den røde celle. Den skal derfor ikke selv scanne
 * det brede issue-snapshot – det ville lade en præsentationsdetalje genåbne den brede capability.
 */
export const selectBlockingLoenindkomstFieldIssues = (
  issues: FieldIssueSet
): Readonly<Record<string, FieldIssue>> => {
  const fieldIssues: Record<string, FieldIssue> = {};
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
      || fieldIssues[employment.entityId] !== undefined
    ) {
      continue;
    }
    fieldIssues[employment.entityId] = issue;
  }
  return Object.freeze(fieldIssues);
};

/**
 * De røde celler i de to MANUELLE reguleringstabeller pr. ejer: ansættelsesforholdets id eller den angivne løns id.
 *
 * Reguleringslinjerne skal kun pege på deres egne tabeller. Før genbrugte de også en rød celle i indtægtstabellen,
 * så samme fejl stod to gange i «Fejl og advarsler» (M-33). Hver rød celle får sin egen linje (BB-307, BB-308),
 * også under angivet løn, hvor de før ikke nåede boksen.
 */
export const selectManualReguleringFieldIssues = (
  issues: FieldIssueSet
): Readonly<Record<string, readonly FieldIssue[]>> => {
  const byOwner: Record<string, FieldIssue[]> = {};
  const manualCollections = ['loenudviklingManuelTableData', 'loenudviklingManuelProcentsatsTableData'];
  for (const issue of issues.all) {
    const [owner, nested] = issue.field.address.path;
    if (nested?.kind !== 'entity' || !manualCollections.includes(nested.collection)) continue;
    const ownerKey = owner?.kind === 'entity' && owner.collection === 'loenindkomstAnsaettelsesforhold'
      ? owner.entityId
      : owner?.kind === 'property' && owner.name === 'eoAngivetLoenLoenudvikling'
        ? EO_ANGIVET_LOEN_ID
        : undefined;
    if (ownerKey === undefined) continue;
    (byOwner[ownerKey] ??= []).push(issue);
  }
  return Object.freeze(byOwner);
};

/** Den angivne løns egne felter (ikke tabellernes celler) med en rød værdi – så de får en linje (BB-306). */
export const selectAngivetLoenFieldIssues = (issues: FieldIssueSet): readonly FieldIssue[] =>
  issues.all.filter((issue) => {
    const path = issue.field.address.path;
    return path.length === 1 && path[0]?.kind === 'property' && path[0].name === 'eoAngivetLoenLoenudvikling';
  });

/**
 * Indtægtstabellens røde celler pr. ansættelsesforhold, så hver fejlbehæftet lønrække kan få sin egen linje
 * med cellens egen tekst og et link til cellen (BB-291).
 */
export const selectLoenindkomstTableFieldIssues = (
  issues: FieldIssueSet
): Readonly<Record<string, readonly FieldIssue[]>> => {
  const byEmployment: Record<string, FieldIssue[]> = {};
  for (const issue of issues.all) {
    const [employment, nested] = issue.field.address.path;
    if (
      employment?.kind !== 'entity'
      || employment.collection !== 'loenindkomstAnsaettelsesforhold'
      || nested?.kind !== 'entity'
      || nested.collection !== 'indtaegtsoplysningerTableData'
    ) {
      continue;
    }
    (byEmployment[employment.entityId] ??= []).push(issue);
  }
  return Object.freeze(byEmployment);
};

/** Offentlige ydelsers røde celler – til ydelseslinjernes egen tekst og link (BB-291). */
export const selectOffentligeYdelserFieldIssues = (issues: FieldIssueSet): readonly FieldIssue[] =>
  issues.all.filter((issue) => {
    const [segment] = issue.field.address.path;
    return segment?.kind === 'entity' && segment.collection === 'offentligeYdelserRows';
  });
