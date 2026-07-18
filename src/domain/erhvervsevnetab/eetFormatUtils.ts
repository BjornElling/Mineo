import { formatAsAmountTrimmed, formatPercentTrimmedFromRounded4 } from '../../utils/formatUtils';
import { APP_ROUTES } from '../../config/pageNavigation';
import type { EetIssue } from './eetTypes';

export type EetTabNavigation = Readonly<{
  pageName: string;
  sectionName: string;
  route: typeof APP_ROUTES.stamdata | typeof APP_ROUTES.erhvervsevnetab;
  sectionId: string;
}>;

export const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');

export const formatFaktor = (value: number): string => formatAsAmountTrimmed(value, 3);

/**
 * Kanonisk EET-procentformatter (afrundet til 4 decimaler, trailing zeros trimmet, " %"-suffiks).
 * Ejes af domænelaget og deles af både UI-faner og dokument-generatorer — hold ikke lokale kopier.
 */
export const formatPct = (value: number): string => `${formatPercentTrimmedFromRounded4(value)} %`;

export const toFieldIssue = (
  id: string,
  message: string | undefined
): EetIssue | null => {
  if (!message || message.trim() === '') return null;
  return { id, severity: 'error', message: message.trim() };
};

/**
 * Ét sandt sted for hvilke EET-issue-ids der repræsenterer en RØD FELTFEJL (format/bounds/rule),
 * modsat en manglende-/afledt-consumer-fejl.
 *
 * En rød feltfejl (greenfield §1.6) er dem, hvor et konkret inputfelt enten (a) er skjult bag en
 * reader-feltfejl (format/bounds) og ført ind i snapshottet som et `field-*`-issue, eller (b) er en
 * felt-placeret domæneregel med samme røde markering (forlig-brøk/procent, dato-orden på stamdata,
 * eller en `*-invalid` værdi som en out-of-bounds procent readeren ikke selv kan fange). En intern
 * beregnings-runtimefejl (`runtime-exception`) er en separat intern blokering og må ikke klassificeres som en
 * brugerfejl.
 *
 * Bruges af download-gaten til at vælge ÉN reason-kode ("field-error" vs "missing-fields") pr. fane
 * (§1.10), og deles med den fremtidige UI, så klassifikationen ikke driftes til et andet sted.
 */
export const isEetFieldErrorIssueId = (issueId: string): boolean =>
  issueId.startsWith('field-') ||
  issueId.startsWith('stamdata-date-order:') ||
  issueId === 'forlig-ansvarsgrad-invalid' ||
  issueId.endsWith('-invalid');

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
  route: APP_ROUTES.stamdata,
  sectionId: 'stamdata-skadelidte',
};

const NAV_EET_GRUNDLAEGGENDE: EetTabNavigation = {
  pageName: 'EET oplysninger',
  sectionName: 'Grundlæggende oplysninger',
  route: APP_ROUTES.erhvervsevnetab,
  sectionId: 'eet-oplysninger-grundlaeggende',
};

const NAV_EET_ASL: EetTabNavigation = {
  pageName: 'EET oplysninger',
  sectionName: 'Arbejdsskadesikringsloven',
  route: APP_ROUTES.erhvervsevnetab,
  sectionId: 'eet-oplysninger-asl',
};

const NAV_EET_EAL: EetTabNavigation = {
  pageName: 'EET oplysninger',
  sectionName: 'Erstatningsansvarsloven',
  route: APP_ROUTES.erhvervsevnetab,
  sectionId: 'eet-oplysninger-eal',
};

const STAMDATA_IDS = new Set([
  'skadedato-missing',
  'field-skadedato',
  'alder-unresolved',
  'skadelidte-fodselsdato-missing',
  'field-skadelidte-fodselsdato',
]);

const GRUNDLAEGGENDE_IDS = new Set([
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
