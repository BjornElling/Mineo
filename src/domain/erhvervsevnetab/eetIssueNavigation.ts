import type { AttentionTarget } from '../../utils/attentionTarget';
import type { EetIssue } from './eetTypes';
import {
  ERHVERVSEVNETAB_TAB_KEYS,
  type ErhvervsevnetabTabKey,
} from '../../config/eetTabKeys';

export { ERHVERVSEVNETAB_TAB_KEYS, type ErhvervsevnetabTabKey } from '../../config/eetTabKeys';

export type EetIssueNavigationTarget =
  | Readonly<{
      kind: 'erstatningsopgoerelse-tab';
      pageName: 'Erstatningsopgørelse';
      tabId: 'eo_oplysninger';
      tabName: 'EO oplysninger';
      sectionId: 'taf' | 'aes';
      sectionTitle: 'Tabt arbejdsfortjeneste' | 'AES-afgørelser';
      focusTarget?: AttentionTarget;
    }>
  | Readonly<{
      kind: 'erhvervsevnetab-tab';
      pageName: 'Erhvervsevnetab';
      tabKey: ErhvervsevnetabTabKey;
      tabName: string;
      /**
       * Sektionen på fanen (`data-section-id`), når issuet kan henføres til én. Id'et er ren
       * navigationsmetadata; et eventuelt fokusmål følger separat med fra EET-importporten.
       */
      sectionId?: string;
      focusTarget?: AttentionTarget;
    }>
  | Readonly<{
      kind: 'stamdata-page';
      pageName: 'Stamdata';
      sectionTitle: 'Stamdata';
      focusTarget?: AttentionTarget;
    }>;

// Issue-id'er der hører til Stamdata-siden (ikke Erhvervsevnetab-fanerne). Sættet matches mod det
// `midlertidigt_eet_source:`-strippede id fra invarianten. De faktiske producenter er
// `useMidlertidigtEetInsertSource` (`midlertidigt-eet-stamdata-schema-invalid` og
// `midlertidigt-eet-stamdata-date-order`) og
// `computeEetLoebendeYdelser` (`skadedato-missing`, `skadelidte-fodselsdato-missing`).
// `field-skadedato`/`field-skadelidte-fodselsdato` produceres p.t. kun af EET-siden selv (ikke via
// source-sporet), men beholdes defensivt, så de routes korrekt, hvis de senere flyder igennem her.
// (`skadedato-invalid` fjernet 2026-06-30: ingen producent i kodebasen.)
const STAMDATA_ISSUE_IDS = new Set([
  'midlertidigt-eet-stamdata-schema-invalid',
  'midlertidigt-eet-stamdata-date-order',
  'skadedato-missing',
  'skadelidte-fodselsdato-missing',
  'field-skadedato',
  'field-skadelidte-fodselsdato',
  'stamdata-date-order:skadedato',
  'stamdata-date-order:skadelidteFodselsdato',
]);

const EO_TAB_OPLYSNINGER_ISSUE_IDS = new Set(['midlertidigt-eet-slutdato-missing']);

/** Linjerne om en manglende midlertidig EET-afgørelse på EO oplysninger (BB-372) – fører til «AES-afgørelser». */
const EO_AES_ISSUE_IDS = new Set(['midlertidigt-eet-uden-afgoerelse-intet-hentet', 'midlertidigt-eet-uden-afgoerelse-hentet']);

/**
 * Sektionen på EET-oplysningerfanen pr. issue-id – rene `data-section-id`-strenge.
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
  'missing-koen': 'eet-oplysninger-grundlaeggende',
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
  // EO's egen advarsel om, at importen intet gav i TAF-perioden (BB-358): det, der mangler, er en afgørelse.
  'midlertidigt-eet-ingen-ydelser-i-taf': 'eet-oplysninger-asl',
};

export const resolveMidlertidigtEetIssueNavigation = (
  issue: Pick<EetIssue, 'id' | 'focusTarget'>
): EetIssueNavigationTarget => {
  if (EO_AES_ISSUE_IDS.has(issue.id)) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      pageName: 'Erstatningsopgørelse',
      tabId: 'eo_oplysninger',
      tabName: 'EO oplysninger',
      sectionId: 'aes',
      sectionTitle: 'AES-afgørelser',
      ...(issue.focusTarget === undefined ? {} : { focusTarget: issue.focusTarget }),
    };
  }
  if (EO_TAB_OPLYSNINGER_ISSUE_IDS.has(issue.id)) {
    return {
      kind: 'erstatningsopgoerelse-tab',
      pageName: 'Erstatningsopgørelse',
      tabId: 'eo_oplysninger',
      tabName: 'EO oplysninger',
      sectionId: 'taf',
      sectionTitle: 'Tabt arbejdsfortjeneste',
      ...(issue.focusTarget === undefined ? {} : { focusTarget: issue.focusTarget }),
    };
  }
  if (STAMDATA_ISSUE_IDS.has(issue.id)) {
    return {
      kind: 'stamdata-page',
      pageName: 'Stamdata',
      sectionTitle: 'Stamdata',
      ...(issue.focusTarget === undefined ? {} : { focusTarget: issue.focusTarget }),
    };
  }

  // EET-fanen vælges ud fra id'et; det konkrete felt eller den berørte række følger med issuet fra
  // EET-importporten. EO-siden behøver derfor ikke kende EET's feltdescriptorer.
  return {
    kind: 'erhvervsevnetab-tab',
    pageName: 'Erhvervsevnetab',
    tabKey: ERHVERVSEVNETAB_TAB_KEYS.EET_OPLYSNINGER,
    tabName: 'EET oplysninger',
    ...(EET_SECTION_ID_BY_ISSUE_ID[issue.id] === undefined
      ? {}
      : { sectionId: EET_SECTION_ID_BY_ISSUE_ID[issue.id] }),
    ...(issue.focusTarget === undefined ? {} : { focusTarget: issue.focusTarget }),
  };
};
