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
    }>;

const STAMDATA_ISSUE_IDS = new Set([
  'midlertidigt-eet-stamdata-schema-invalid',
  'skadedato-missing',
  'skadedato-invalid',
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
    };
  }

  return {
    kind: 'erhvervsevnetab-tab',
    pageName: 'Erhvervsevnetab',
    tabKey: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER,
    tabName: 'EET oplysninger',
  };
};
