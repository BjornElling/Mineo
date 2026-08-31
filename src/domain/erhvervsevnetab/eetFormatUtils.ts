import { formatAsAmountTrimmed } from '../../utils/formatUtils';
import { APP_ROUTES } from '../../config/pageNavigation';
import {
  aslAfgoerelseAfgoerelsesDatoField,
  aslAfgoerelseAfgoerelseTypeField,
  aslAfgoerelseEetPctField,
  aslAfgoerelseKapDatoField,
  aslAfgoerelseKapPctField,
  erhvervsevnetabBeregningsdatoField,
  erhvervsevnetabEalEetPctField,
  erhvervsevnetabKoenField,
} from '../../inputCore/catalog/erhvervsevnetabDescriptors';
import {
  faellesAarsloenAslAarsloenField,
  faellesAarsloenEalAarsloenField,
} from '../../inputCore/catalog/faellesAarsloenDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../inputCore/catalog/stamdataDescriptors';
import type { FieldAddress } from '../../inputCore/fieldAddress';
import type { FieldAddressTemplate } from '../../inputCore/fieldDescriptor';
import type { EetIssue } from './eetTypes';

export type EetTabNavigation = Readonly<{
  pageName: string;
  sectionName: string;
  route: typeof APP_ROUTES.stamdata | typeof APP_ROUTES.erhvervsevnetab;
  sectionId: string;
  /** Det konkrete felt, når et issue har én entydig brugerrettelse. */
  focusFieldAddress?: FieldAddress;
  /**
   * Feltet i ASL-tabellens FØRSTE række, når issuet handler om en afgørelse, brugeren endnu ikke har
   * OPRETTET («Der er ikke indtastet nogen afgørelser»).
   *
   * Der findes ingen feltadresse at pege på, før rækken findes, og et sektionsanker blinker hele
   * ContentBoxen uden at vise HVOR indtastningen hører. Tabellen viser til gengæld altid sin tomme
   * indtastningsrække, hvis celler bærer en fuldt bundet feltadresse – templaten navngiver den celle
   * uden at foregive at kende placeholderens runtime-id. Samme model som EO's `collectionField`-mål.
   */
  focusFirstRowField?: FieldAddressTemplate;
}>;

export const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');

export const formatFaktor = (value: number): string => formatAsAmountTrimmed(value, 3);

/** Kanonisk formatter for et månedsantal i EET (4 decimaler, trailing zeros trimmet). */
export const formatMaaneder = (value: number): string => formatAsAmountTrimmed(value, 4);

/**
 * EET-facadens navn bevares for de EET-specifikke visninger. Andre domæner skal importere den
 * domæneuafhængige formatter direkte, så EET ikke bliver en fælles afhængighedsgrænse.
 */
export { formatPercentRounded4 as formatPct } from '../../utils/formatUtils';

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
 * En rød feltfejl (§1.6) er dem, hvor et konkret inputfelt enten (a) er skjult bag en
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
  issueId === 'invalid-eet-pct' ||
  issueId === 'invalid-kap-pct' ||
  issueId === 'invalid-afgoerelse-type' ||
  issueId.endsWith('-invalid');

export const NAVIGATION_SORT_ORDER: Record<string, number> = {
  'stamdata-skadelidte': 0,
  'eet-oplysninger-grundlaeggende': 1,
  'eet-oplysninger-asl': 2,
  'eet-oplysninger-eal': 3,
  // 99 bruges implicit for issues uden navigation – her dokumenteret eksplicit
};

const NAV_STAMDATA_SKADELIDTE: EetTabNavigation = {
  pageName: 'Stamdata',
  sectionName: 'Skadelidte',
  route: APP_ROUTES.stamdata,
  sectionId: 'stamdata-skadelidte',
};

const STAMDATA_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddress>> = {
  'skadedato-missing': stamdataSkadedatoField.bind().address,
  'field-skadedato': stamdataSkadedatoField.bind().address,
  'stamdata-date-order:skadedato': stamdataSkadedatoField.bind().address,
  'skadelidte-fodselsdato-missing': stamdataSkadelidteFodselsdatoField.bind().address,
  'field-skadelidte-fodselsdato': stamdataSkadelidteFodselsdatoField.bind().address,
  'stamdata-date-order:skadelidteFodselsdato': stamdataSkadelidteFodselsdatoField.bind().address,
};

const GRUNDLAEGGENDE_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddress>> = {
  'beregningsdato-missing': erhvervsevnetabBeregningsdatoField.bind().address,
  'beregningsdato-invalid': erhvervsevnetabBeregningsdatoField.bind().address,
  'warn-beregningsdato-foer-skadedato': erhvervsevnetabBeregningsdatoField.bind().address,
  'field-beregningsdato': erhvervsevnetabBeregningsdatoField.bind().address,
  'missing-koen': erhvervsevnetabKoenField.bind().address,
};

const EAL_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddress>> = {
  'eal-aarsloen-missing': faellesAarsloenEalAarsloenField.bind().address,
  'eal-aarsloen-zero': faellesAarsloenEalAarsloenField.bind().address,
  'field-aarsloen-eal': faellesAarsloenEalAarsloenField.bind().address,
  'warn-eal-aarsloen-is-max': faellesAarsloenEalAarsloenField.bind().address,
  'warn-eal-aarsloen-empty-for-2024-07-01': faellesAarsloenEalAarsloenField.bind().address,
  'eal-eet-pct-invalid': erhvervsevnetabEalEetPctField.bind().address,
  'eet-pct-missing': erhvervsevnetabEalEetPctField.bind().address,
  'field-eal-eet-pct': erhvervsevnetabEalEetPctField.bind().address,
  'warn-eal-eet-under-15': erhvervsevnetabEalEetPctField.bind().address,
};

const ASL_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddress>> = {
  'aarsloen-missing': faellesAarsloenAslAarsloenField.bind().address,
  'aarsloen-zero': faellesAarsloenAslAarsloenField.bind().address,
  'field-aarsloen-asl': faellesAarsloenAslAarsloenField.bind().address,
  'aarsloen-over-max': faellesAarsloenAslAarsloenField.bind().address,
};

/**
 * ASL-issues, hvor den efterspurgte indtastning IKKE FINDES ENDNU – enten fordi der slet ikke er nogen
 * afgørelsesrække, eller fordi en påkrævet celle i en række står tom. Målet er cellen i tabellens første
 * række; den findes altid, fordi tabellen viser en tom indtastningsrække.
 *
 * Uden disse mål faldt issuet igennem til `scrollToSection`, som blinker hele ContentBoxen. For et issue,
 * der beder brugeren om at OPRETTE en afgørelse, gav det ingen anvisning på hvor indtastningen hører – det
 * er samme fejlform som EO's «Der er ikke angivet nogen TAF-periode».
 */
const ASL_FIRST_ROW_FIELD_BY_ISSUE_ID: Readonly<Record<string, FieldAddressTemplate>> = {
  // Ingen rækker overhovedet: afgørelsesdatoen er tabellens første kolonne og den naturlige indgang.
  'asl-afgoerelser-empty': aslAfgoerelseAfgoerelsesDatoField.template,
  'no-asl-afgoerelser-known-at-beregningsdato': aslAfgoerelseAfgoerelsesDatoField.template,
  'no-endelig-afgoerelser': aslAfgoerelseAfgoerelseTypeField.template,
  'missing-afgoerelsesdato': aslAfgoerelseAfgoerelsesDatoField.template,
  'missing-eet-pct': aslAfgoerelseEetPctField.template,
  'missing-afgoerelseType': aslAfgoerelseAfgoerelseTypeField.template,
  'missing-kap-dato': aslAfgoerelseKapDatoField.template,
  'missing-kap-pct': aslAfgoerelseKapPctField.template,
  'endelig-under-50-missing-kapitalisering': aslAfgoerelseKapDatoField.template,
  'delvist-endelig-missing-kapitalisering': aslAfgoerelseKapDatoField.template,
};

const withFocusField = (
  navigation: EetTabNavigation,
  focusFieldAddress: FieldAddress | undefined
): EetTabNavigation => focusFieldAddress === undefined ? navigation : { ...navigation, focusFieldAddress };

/** Som `withFocusField`, men for den endnu ikke oprettede rækkes celle. */
const withFirstRowField = (
  navigation: EetTabNavigation,
  focusFirstRowField: FieldAddressTemplate | undefined
): EetTabNavigation =>
  focusFirstRowField === undefined ? navigation : { ...navigation, focusFirstRowField };

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
  'stamdata-date-order:skadedato',
  'alder-unresolved',
  'skadelidte-fodselsdato-missing',
  'field-skadelidte-fodselsdato',
  'stamdata-date-order:skadelidteFodselsdato',
]);

const GRUNDLAEGGENDE_IDS = new Set([
  'beregningsdato-missing',
  'beregningsdato-invalid',
  'warn-beregningsdato-foer-skadedato',
  'field-beregningsdato',
  'missing-koen',
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
  'invalid-eet-pct',
  'invalid-kap-pct',
  'invalid-afgoerelse-type',
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
  'aarsloen-over-max',
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
  if (STAMDATA_IDS.has(issueId)) return withFocusField(NAV_STAMDATA_SKADELIDTE, STAMDATA_FIELD_BY_ISSUE_ID[issueId]);
  if (GRUNDLAEGGENDE_IDS.has(issueId)) return withFocusField(NAV_EET_GRUNDLAEGGENDE, GRUNDLAEGGENDE_FIELD_BY_ISSUE_ID[issueId]);
  if (EAL_IDS.has(issueId)) return withFocusField(NAV_EET_EAL, EAL_FIELD_BY_ISSUE_ID[issueId]);
  if (ASL_IDS.has(issueId)) {
    // Et konkret felt vinder; ellers den tomme indtastningsrækkes celle, hvis issuet efterspørger en
    // indtastning, der ikke findes endnu; ellers sektionen.
    return withFirstRowField(
      withFocusField(NAV_EET_ASL, ASL_FIELD_BY_ISSUE_ID[issueId]),
      ASL_FIRST_ROW_FIELD_BY_ISSUE_ID[issueId]
    );
  }
  return null;
};

export const navigationSortKey = (issueId: string): number => {
  const nav = resolveEetIssueNavigation(issueId);
  return nav !== null ? (NAVIGATION_SORT_ORDER[nav.sectionId] ?? 99) : 99;
};
