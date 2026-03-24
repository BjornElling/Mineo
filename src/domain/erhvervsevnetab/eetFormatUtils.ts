import { formatAsAmountTrimmed, formatKr } from '../../utils/formatUtils';
import type { EetIssue } from './eetTypes';

export { formatKr };

export type EetTabNavigation = Readonly<{
  pageName: string;
  sectionName: string;
  route: '/stamdata' | '/erhvervsevnetab';
  sectionId: string;
}>;

export const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');

export const formatFaktor = (value: number): string => formatAsAmountTrimmed(value, 3);

export const toFieldIssue = (
  id: string,
  message: string | undefined
): EetIssue | null => {
  if (!message || message.trim() === '') return null;
  return { id, severity: 'error', message: message.trim() };
};

export const NAVIGATION_SORT_ORDER: Record<string, number> = {
  'stamdata-skadelidte': 0,
  'eet-oplysninger-grundlaeggende': 1,
  'eet-oplysninger-asl': 2,
  'eet-oplysninger-eal': 3,
  // 99 bruges implicit for issues uden navigation — her dokumenteret eksplicit
};

const NAV_STAMDATA_SKADELIDTE: EetTabNavigation = {
  pageName: 'Stamdata',
  sectionName: 'Skadelidte',
  route: '/stamdata',
  sectionId: 'stamdata-skadelidte',
};

const NAV_EET_GRUNDLAEGGENDE: EetTabNavigation = {
  pageName: 'EET oplysninger',
  sectionName: 'Grundlæggende oplysninger',
  route: '/erhvervsevnetab',
  sectionId: 'eet-oplysninger-grundlaeggende',
};

const NAV_EET_ASL: EetTabNavigation = {
  pageName: 'EET oplysninger',
  sectionName: 'Arbejdsskadesikringsloven',
  route: '/erhvervsevnetab',
  sectionId: 'eet-oplysninger-asl',
};

const NAV_EET_EAL: EetTabNavigation = {
  pageName: 'EET oplysninger',
  sectionName: 'Erstatningsansvarsloven',
  route: '/erhvervsevnetab',
  sectionId: 'eet-oplysninger-eal',
};

const STAMDATA_IDS = new Set([
  'skadesdato-missing',
  'field-skadesdato',
  'alder-unresolved',
]);

const GRUNDLAEGGENDE_IDS = new Set([
  'skadelidte-fodselsdato-missing',
  'field-skadelidte-fodselsdato',
  'beregningsdato-missing',
  'beregningsdato-invalid',
  'field-beregningsdato',
  'eet-max-missing',
  'proforma-kapitaliseringsbekendtgoerelse-missing',
  'proforma-kapitaliseringstabel-missing',
  'proforma-kapitaliseringsalder-under-minimum',
  'proforma-kapitaliseringsfaktor-unresolved',
  'proforma-reguleringssats-missing',
]);

const EAL_IDS = new Set([
  'eal-aarsloen-missing',
  'eal-aarsloen-zero',
  'eal-eet-pct-invalid',
  'eet-pct-missing',
  'field-aarsloen-eal',
  'field-eal-eet-pct',
  'warn-eal-eet-under-15',
  'warn-eal-aarsloen-is-max',
  'warn-eal-aarsloen-empty-for-2024-07-01',
]);

const ASL_IDS = new Set([
  'aarsloen-missing',
  'aarsloen-zero',
  'asl-aarsloen-missing',
  'field-aarsloen-asl',
  'field-asl-afgoerelser',
  'asl-identiske-afgoerelser',
  'asl-afgoerelser-empty',
  'no-asl-afgoerelser-known-at-beregningsdato',
  'asl-selected-eet-pct-invalid',
  'missing-afgoerelsesdato',
  'missing-eet-pct',
  'missing-afgoerelseType',
  'no-endelig-afgoerelser',
  'endelig-under-50-missing-kapitalisering',
  'delvist-endelig-missing-kapitalisering',
  'kap-dato-without-kap-pct',
  'kap-pct-without-kap-dato',
  'missing-kap-dato',
  'missing-kap-pct',
  'missing-koen',
  'virkningsdato-after-tidlkap-dato',
  'kap-dato-not-after-tidlkap-dato',
  'kapitaliseringsbekendtgoerelse-missing-control-date',
  'kapitaliseringsbekendtgoerelse-missing-effective-date',
  'kapitaliseringstabel-missing',
  'kapitaliseringsalder-under-minimum',
  'kapitaliseringsfaktor-unresolved',
  'reguleringssats-missing',
  'reguleringssats-missing-2024',
  'aarsloen-max-missing',
  'warn-asl-eet-under-15',
  'warn-asl-aarsloen-is-max',
  'warn-invalid-eet-pct-after-2024-07-01',
  'warn-non-endelig-after-endelig',
  'warn-afgoerelsesdato-after-beregningsdato',
  'warn-virkningsdato-after-beregningsdato',
  'warn-kap-dato-after-beregningsdato',
  'warn-kap-pct-under-15',
  'warn-ingen-kap-input',
]);

export const resolveEetIssueNavigation = (issueId: string): EetTabNavigation | null => {
  if (STAMDATA_IDS.has(issueId)) return NAV_STAMDATA_SKADELIDTE;
  if (GRUNDLAEGGENDE_IDS.has(issueId)) return NAV_EET_GRUNDLAEGGENDE;
  if (EAL_IDS.has(issueId)) return NAV_EET_EAL;
  if (ASL_IDS.has(issueId)) return NAV_EET_ASL;
  return null;
};

export const navigationSortKey = (issueId: string): number => {
  const nav = resolveEetIssueNavigation(issueId);
  return nav !== null ? (NAVIGATION_SORT_ORDER[nav.sectionId] ?? 99) : 99;
};
