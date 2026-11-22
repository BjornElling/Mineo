import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, dateToISO, parseISODate } from '../../types/branded';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';
import { formatDocumentMaanederTrimmed } from '../../utils/documentMaanederFormatting';
import { getInclusivePeriodEndByMonths } from '../../utils/dateUtils';
import type { EoRowStatus } from './eoRowTypes';
import { activeFieldIssue, type FieldIssueSet } from '../../inputCore/inputIssue';
import { serializeFieldAddress, type FieldAddress } from '../../inputCore/fieldAddress';
import type { AttentionTarget } from '../../utils/attentionTarget';

// Kanoniske id-prefikser for SFGG-rækker bygget efter sygeferiegodtgørelses-tabellen.
// Predikaterne ligger her sammen med byggeren der emitterer id'erne, så ingen
// render-komponent gen-koder `sfgg.eftertabel.`-grammatikken parallelt.
const SFGG_EFTERTABEL_ID_PREFIX = 'sfgg.eftertabel.';
const SFGG_EFTERTABEL_BEREGNET_ID_PREFIX = 'sfgg.eftertabel.beregnet.';

/** Sand for SFGG-rækker der hører efter selve sygeferiegodtgørelses-tabellen. */
export const isSfggPostTableRowId = (id: string): boolean => id.startsWith(SFGG_EFTERTABEL_ID_PREFIX);

/** Sand for den beregnede SFGG-totalrække (vises med fed skrift). */
export const isSfggComputedTotalRowId = (id: string): boolean => id.startsWith(SFGG_EFTERTABEL_BEREGNET_ID_PREFIX);

export type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];
export type ErstatningsopgoerelseFieldName = Extract<keyof ErstatningsopgoerelseValues, string>;
export type ErstatningsopgoerelseFieldIssues = FieldIssueSet;
export type StamdataValues = PersistedSectionMap['stamdata'];

/**
 * Rækken med den seneste til-dato i en periodetabel. Advarslen om, at der ikke er rejst krav for hele EO-perioden,
 * rettes ved at forlænge NETOP den række; tabellens første række kunne være en tidligere, afsluttet periode.
 */
export const resolveSenestSluttendePeriodeId = (
  perioder: readonly Readonly<{ id: string; til?: string | null | undefined }>[]
): string | undefined => {
  let senest: Readonly<{ id: string; til: ISODateString }> | undefined;
  for (const periode of perioder) {
    const til = coerceToISODateString(periode.til ?? undefined);
    if (til !== undefined && (senest === undefined || til > senest.til)) senest = { id: periode.id, til };
  }
  return senest?.id;
};

/** Fokusmålet på til-cellen i den senest sluttende periode; tomt, når tabellen ingen til-dato har. */
export const focusOnSenesteTil = (
  rowId: string | undefined,
  tilField: Readonly<{ bind: (rowId: string) => Readonly<{ address: FieldAddress }> }>
): Readonly<{ focusTarget?: AttentionTarget }> =>
  rowId === undefined ? {} : { focusTarget: { kind: 'fieldAddress', address: tilField.bind(rowId).address } };

/**
 * Dækningen af et krav kan ikke vurderes, fordi et input, vurderingen hviler på, er afvist (rød råtekst). Fælles
 * for «Ikke rejst svie/smerte-krav for hele perioden» og «Der er ikke rejst TAF-krav for hele EO-perioden».
 *
 * En afvist dato læses som tom: en tastefejl i en periodes dato eller i en afskæringsdato (ménafgørelse,
 * EET-afgørelse, differencekrav) fik derfor programmet til at bede om at forlænge kravet – en forlængelse, der
 * efter rettelsen kunne ramme afskæringen (NY-12b-4, BB-426). Kalenderfejlen står allerede med link til feltet;
 * dækningen vurderes først, når den er rettet. Kalderen sender kun de felter, der faktisk kan flytte kravets
 * slutning: forklares ophøret af en gyldig, uafhængig afskæring, nås advarslen slet ikke.
 */
export const kanDaekningIkkeVurderesPgaAfvistInput = (
  issues: FieldIssueSet,
  felter: readonly Readonly<{ address: FieldAddress }>[],
): boolean =>
  felter.some((felt) => activeFieldIssue(issues, serializeFieldAddress(felt.address))?.reason === 'format');

export const formatRowCount = (value: number): string => formatAsAmountTrimmed(value, 0);
// Programmets ene månedsformat: fem decimaler, efterstillede nuller trimmet (udviklerens afgørelse 2026-11-19).
export const formatRowMonths = (value: number): string => formatDocumentMaanederTrimmed(value);

export const formatStatusMessage = (status: EoRowStatus, message: string): string => {
  if (status === 'ok') return '-';
  const trimmed = message.trim();
  if (trimmed === '' || trimmed === '-') {
    return status === 'error' ? 'Fejl (Indtastning mangler)' : 'Advarsel (Indtastning mangler)';
  }
  return `${status === 'error' ? 'Fejl' : 'Advarsel'} (${trimmed})`;
};

export type ReguleringsRange = Readonly<{
  min?: ISODateString;
  max?: ISODateString;
}>;

export const parseDanishToIso = (value: string | undefined): ISODateString | undefined => {
  if (!value || value.trim() === '') return undefined;
  return coerceToISODateString(value.trim());
};

export const getRangeForManualRegulering = (
  baseIso: ISODateString | undefined,
  rows: ReadonlyArray<{ dato?: string | undefined }>
): ReguleringsRange => {
  const dates: ISODateString[] = [];
  if (baseIso) dates.push(baseIso);

  rows.forEach((row) => {
    const iso = parseDanishToIso(row.dato);
    if (iso && (!baseIso || iso > baseIso)) dates.push(iso);
  });

  if (dates.length === 0) return {};

  // Rækker på eller før basisdatoen er allerede feltfejl og afvises af motorerne. Coverage-visningen
  // filtrerer dem også defensivt, så ugyldigt input ikke kan udvide det viste reguleringsinterval.
  let min = dates[0];
  let max = dates[0];
  for (const iso of dates) {
    if (iso < min) min = iso;
    if (iso > max) max = iso;
  }

  const maxDate = parseISODate(max);
  if (!maxDate) return { min };

  // Manuel reguleringsintervals øvre grænse = seneste rækkedato + 12 mdr − 1 dag (kanonisk
  // "+N mdr − 1 dag"-aritmetik, delt med de øvrige reguleringsdato-intervaller; her i ISO-domænet).
  const adjustedMax = dateToISO(getInclusivePeriodEndByMonths(maxDate, 12));
  return { min, max: adjustedMax };
};

export const calculateElapsedWholeMonths = (fromIso: ISODateString, toIso: ISODateString): number => {
  if (toIso <= fromIso) return 0;
  const fromDate = parseISODate(fromIso);
  const toDate = parseISODate(toIso);
  if (!fromDate || !toDate) return 0;

  let months =
    (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 +
    (toDate.getUTCMonth() - fromDate.getUTCMonth());
  if (toDate.getUTCDate() < fromDate.getUTCDate()) {
    months -= 1;
  }

  return Math.max(0, months);
};

export const buildReguleringsMangelMessage = (
  status: EoRowStatus,
  displayValue: string
): string | undefined => {
  if (status === 'ok') return undefined;
  const trimmed = displayValue.trim();
  if (trimmed === '' || trimmed === '-' || trimmed === 'Nej') return 'er ikke angivet';
  if (trimmed.startsWith('Nej')) return `er ikke angivet${trimmed.slice(3)}`;
  return trimmed;
};
