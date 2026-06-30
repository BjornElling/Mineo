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
      /** Konkret felt at scrolle til på Stamdata-siden, hvis issuet peger på ét bestemt felt. */
      focusFieldPath?: string;
    }>;

// Issue-id → konkret Stamdata-feltnavn (data-mineo-field-path), så linket lander på det rette felt
// og ikke kun siden. Den generiske schema-invalid har intet enkelt felt og udelades bevidst.
const STAMDATA_FIELD_PATH_BY_ISSUE_ID: Readonly<Record<string, string>> = {
  'skadedato-missing': 'skadedato',
  'field-skadedato': 'skadedato',
  'skadelidte-fodselsdato-missing': 'skadelidteFodselsdato',
  'field-skadelidte-fodselsdato': 'skadelidteFodselsdato',
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
      focusFieldPath: STAMDATA_FIELD_PATH_BY_ISSUE_ID[issue.id],
    };
  }

  return {
    kind: 'erhvervsevnetab-tab',
    pageName: 'Erhvervsevnetab',
    tabKey: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER,
    tabName: 'EET oplysninger',
  };
};
