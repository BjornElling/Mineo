import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import type { FieldAddress } from '../../inputCore/fieldAddress';
import type { EetIssue } from './eetTypes';
import {
  ERHVERVSEVNETAB_TAB_KEYS,
  type ErhvervsevnetabTabKey,
} from '../../config/eetTabKeys';

export { ERHVERVSEVNETAB_TAB_KEYS, type ErhvervsevnetabTabKey } from '../../config/eetTabKeys';

export type EetIssueNavigationTarget =
  | Readonly<{
      kind: 'erhvervsevnetab-tab';
      pageName: 'Erhvervsevnetab';
      tabKey: ErhvervsevnetabTabKey;
      tabName: string;
      /**
       * Sektionen på fanen (`data-section-id`), når issuet kan henføres til én. Bevidst en streng og
       * ikke en feltadresse: EO-siden forbruger denne rute og må ikke koble til EET's feltdescriptorer.
       */
      sectionId?: string;
    }>
  | Readonly<{
      kind: 'stamdata-page';
      pageName: 'Stamdata';
      sectionTitle: 'Stamdata';
      /**
       * Konkret felt at føre brugeren til på Stamdata-siden, hvis issuet peger på ét bestemt felt.
       * KANONISK feltadresse (§3.2) — samme identitet som EO-rækkernes fokusmål, undo/redo og
       * save-blokeringens fokus bruger, så der ikke findes en parallel navnestreng-model.
       */
      focusFieldAddress?: FieldAddress;
    }>;

// Issue-id → det konkrete Stamdata-felt, så linket lander på feltet og ikke kun siden. Adressen bindes af
// produktionens egen descriptor, så et omdøbt felt bliver en compilerfejl frem for et link, der lydløst
// falder tilbage til siden. Den generiske schema-invalid har intet enkelt felt og udelades bevidst.
const STAMDATA_FIELD_ADDRESS_BY_ISSUE_ID: Readonly<Record<string, FieldAddress>> = {
  'skadedato-missing': stamdataSkadedatoField.bind().address,
  'field-skadedato': stamdataSkadedatoField.bind().address,
  'skadelidte-fodselsdato-missing': stamdataSkadelidteFodselsdatoField.bind().address,
  'field-skadelidte-fodselsdato': stamdataSkadelidteFodselsdatoField.bind().address,
};

// Issue-id'er der hører til Stamdata-siden (ikke Erhvervsevnetab-fanerne). Sættet matches mod det
// `midlertidigt_eet_source:`-strippede id fra invarianten. De faktiske producenter er
// `useMidlertidigtEetInsertSource` (`midlertidigt-eet-stamdata-schema-invalid`) og
// `computeEetLoebendeYdelser` (`skadedato-missing`, `skadelidte-fodselsdato-missing`).
// `field-skadedato`/`field-skadelidte-fodselsdato` produceres p.t. kun af EET-siden selv (ikke via
// source-sporet), men beholdes defensivt, så de routes korrekt, hvis de senere flyder igennem her.
// (`skadedato-invalid` fjernet 2026-06-30: ingen producent i kodebasen.)
const STAMDATA_ISSUE_IDS = new Set([
  'midlertidigt-eet-stamdata-schema-invalid',
  'skadedato-missing',
  'skadelidte-fodselsdato-missing',
  'field-skadedato',
  'field-skadelidte-fodselsdato',
]);

/**
 * Sektionen på EET-oplysningerfanen pr. issue-id — rene `data-section-id`-strenge.
 *
 * Bevidst en selvstændig tabel og ikke et opslag i `eetFormatUtils`: dette modul forbruges af EO's
 * Beregning-fane, og en import derfra ville koble EO til EET's og faellesAarsloens feltdescriptorer og
 * bryde side/sektions-grænsen (se `resolveMidlertidigtEetIssueNavigation`). Kun de issue-id'er, der
 * faktisk kan flyde gennem `midlertidigt_eet_source:`-invarianten, står her; ukendte id'er får fanen
 * alene, præcis som før.
 */
const EET_SECTION_ID_BY_ISSUE_ID: Readonly<Record<string, string>> = {
  'aarsloen-missing': 'eet-oplysninger-asl',
  'asl-aarsloen-missing': 'eet-oplysninger-asl',
  'aarsloen-zero': 'eet-oplysninger-asl',
  'aarsloen-over-max': 'eet-oplysninger-asl',
  'aarsloen-max-missing': 'eet-oplysninger-asl',
  'asl-afgoerelser-empty': 'eet-oplysninger-asl',
  'no-asl-afgoerelser-known-at-beregningsdato': 'eet-oplysninger-asl',
  'no-endelig-afgoerelser': 'eet-oplysninger-asl',
  'missing-afgoerelsesdato': 'eet-oplysninger-asl',
  'missing-eet-pct': 'eet-oplysninger-asl',
  'missing-afgoerelseType': 'eet-oplysninger-asl',
  'missing-kap-dato': 'eet-oplysninger-asl',
  'missing-kap-pct': 'eet-oplysninger-asl',
  'missing-koen': 'eet-oplysninger-asl',
  'endelig-under-50-missing-kapitalisering': 'eet-oplysninger-asl',
  'delvist-endelig-missing-kapitalisering': 'eet-oplysninger-asl',
  'kapitaliseringstabel-missing': 'eet-oplysninger-asl',
  'kapitaliseringsfaktor-unresolved': 'eet-oplysninger-asl',
  'reguleringssats-missing': 'eet-oplysninger-asl',
  'beregningsdato-missing': 'eet-oplysninger-grundlaeggende',
  'beregningsdato-invalid': 'eet-oplysninger-grundlaeggende',
  'eet-max-missing': 'eet-oplysninger-grundlaeggende',
  'eet-pct-missing': 'eet-oplysninger-eal',
  'eal-aarsloen-missing': 'eet-oplysninger-eal',
  'eal-aarsloen-zero': 'eet-oplysninger-eal',
};

export const resolveMidlertidigtEetIssueNavigation = (
  issue: Pick<EetIssue, 'id'>
): EetIssueNavigationTarget => {
  if (STAMDATA_ISSUE_IDS.has(issue.id)) {
    return {
      kind: 'stamdata-page',
      pageName: 'Stamdata',
      sectionTitle: 'Stamdata',
      focusFieldAddress: STAMDATA_FIELD_ADDRESS_BY_ISSUE_ID[issue.id],
    };
  }

  // EET-fanen. Målet er BEVIDST kun fanen + sektionen, ikke et konkret felt.
  //
  // Det oplagte ville være at genbruge EET-sidens egen `resolveEetIssueNavigation`, som kender feltet.
  // Men denne modul-sti forbruges af EO's Beregning-fane, og EO-siden må ikke koble til EET's og
  // faellesAarsloens feltdescriptorer (domain-boundary-contract §9/§10, håndhævet af
  // `domain/page-section-access-boundary`). En import her ville trække hele descriptor-kataloget ind i
  // EO's afhængighedsgraf gennem bagdøren.
  //
  // Sektions-id'et er derimod en ren streng uden descriptor-kobling, og det er nok til at føre brugeren
  // til det rigtige sted PÅ fanen med den delte sektionsmarkering — frem for at lande øverst på siden
  // uden nogen anvisning, som før.
  return {
    kind: 'erhvervsevnetab-tab',
    pageName: 'Erhvervsevnetab',
    tabKey: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER,
    tabName: 'EET oplysninger',
    ...(EET_SECTION_ID_BY_ISSUE_ID[issue.id] === undefined
      ? {}
      : { sectionId: EET_SECTION_ID_BY_ISSUE_ID[issue.id] }),
  };
};
