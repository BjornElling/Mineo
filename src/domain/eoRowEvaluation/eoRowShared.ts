import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { ISODateString } from '../../types/branded';
import { coerceToISODateString, dateToISO, parseISODate } from '../../types/branded';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';
import { getInclusivePeriodEndByMonths } from '../../utils/dateUtils';
import type { EoRowStatus } from './eoRowTypes';
import type { FieldIssueSet } from '../../inputCore/inputIssue';

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

export const formatRowCount = (value: number): string => formatAsAmountTrimmed(value, 0);
export const formatRowMonths = (value: number): string => formatAsAmountTrimmed(value, 4);

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
