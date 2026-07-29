import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import type { FieldAddress } from '../../inputCore/fieldAddress';
import type { EetIssue } from './eetTypes';

export const ERHVERVSEVNETAB_TAB_KEYS = {
  EET_OPLYSNINGER: 'eet-oplysninger',
  LOEBENDE_YDELSER: 'loebende-ydelser',
  KAPITALISERING: 'kapitalisering',
  EET_EAL: 'eet-eal',
  DIFFERENCEKRAV: 'differencekrav',
} as const;

export type ErhvervsevnetabTabKey = (typeof ERHVERVSEVNETAB_TAB_KEYS)[keyof typeof ERHVERVSEVNETAB_TAB_KEYS];

export type EetIssueNavigationTarget =
  | Readonly<{
      kind: 'erhvervsevnetab-tab';
      pageName: 'Erhvervsevnetab';
      tabKey: ErhvervsevnetabTabKey;
      tabName: string;
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

  return {
    kind: 'erhvervsevnetab-tab',
    pageName: 'Erhvervsevnetab',
    tabKey: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER,
    tabName: 'EET oplysninger',
  };
};
