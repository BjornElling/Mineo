import { resolveStandardLoenColumnLabel, STANDARD_LOEN_SAMLET_LABEL } from '../../aarsloen/standardLoenTableColumns';
import type { StandardLoenProjectedAmounts } from '../../aarsloen/standardLoenRowCalculations';
import { isoDateToDate } from '../../dates/isoDate';
import { fromKroner, roundKroner, toKroner } from '../../money/money';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { roundByMethod } from '../../../utils/rounding';
import { validateIsoRange } from '../../../utils/isoDateHelpers';
import { buildDatoSetInclusive, buildFerieDageSet, buildShDageSetFromIsoRange, isWeekdayUtc } from '../engines/tafDaySets';
import type { TafCalculationValues } from '../engines/tafCalculationInput';
import type { TafNettoBeregningResult } from '../engines/tafNettoBeregning';
import type { SvieSmerteConstrainedPeriod } from '../engines/svieSmerteEngine';
import { buildTafArbejdsdageSet } from '../engines/loenudviklingBeregning';
import { ansaettelsesforholdNavne, resolveAnsaettelsesforholdNavn } from '../helpers/indtaegtPerioder';
import { resolveIndkomstFerieperioder } from '../helpers/indkomstFerieperioder';
import { TAF_BEREGNES_SOM } from '../helpers/tafBeregningsenhed';
import { resolveTafCutoffDates, vaelgTafOphoersgrund, type IsoRange, type TafCutoffKilde } from '../validation/tafPeriodConstraints';

const WAGE_COLUMNS = [
  ['grundloen', resolveStandardLoenColumnLabel('col2')],
  ['tillaeg', resolveStandardLoenColumnLabel('col3')],
  ['ikkePensionsgivende', resolveStandardLoenColumnLabel('col4')],
  ['atp', resolveStandardLoenColumnLabel('col5')],
  ['fpFvShSo', resolveStandardLoenColumnLabel('fpFvShSoBeloeb')],
  ['pension', resolveStandardLoenColumnLabel('pensionBeloeb')],
  ['samlet', STANDARD_LOEN_SAMLET_LABEL],
] as const satisfies readonly (readonly [keyof StandardLoenProjectedAmounts, string])[];

const WEEKDAYS = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
const CUTOFF_LABELS: Readonly<Record<TafCutoffKilde, string>> = {
  differencekrav: 'Differencekrav',
  endeligEet: 'Endeligt EET',
  midlertidigEet: 'Midlertidigt EET',
};

type CsvDayColumn = Readonly<{
  header: string;
  values: ReadonlyMap<ISODateString, string>;
  adjustment?: number;
}>;

const addMoneyColumn = (
  header: string,
  days: Iterable<readonly [ISODateString, number]>,
  authoritativeKroner?: number,
): CsvDayColumn => {
  const raw = new Map<ISODateString, number>();
  for (const [date, amount] of days) raw.set(date, (raw.get(date) ?? 0) + amount);
  const values = new Map<ISODateString, string>();
  let displayedOre = 0;
  let total = 0;
  for (const [date, value] of raw) {
    const ore = fromKroner(roundByMethod(value, 2, 'halfAwayFromZero'));
    displayedOre += ore;
    total += value;
    if (ore !== 0) values.set(date, formatCurrency(toKroner(ore)));
  }
  return { header, values, adjustment: fromKroner(roundByMethod(authoritativeKroner ?? total, 2, 'halfAwayFromZero')) - displayedOre };
};

export type EoDagsgrundlag = Readonly<{
  dates: readonly ISODateString[];
  ferie: ReadonlySet<ISODateString>;
  sh: ReadonlySet<ISODateString>;
  workdays: ReadonlySet<ISODateString>;
  svieSmertePeriods: readonly SvieSmerteConstrainedPeriod[] | undefined;
  hasTaf: boolean;
  tafDates: ReadonlySet<ISODateString>;
  cutoff?: Readonly<{ referenceDato: ISODateString; kilde: TafCutoffKilde }>;
  columns: readonly CsvDayColumn[];
  coverage: string;
}>;

const inRange = (date: ISODateString, range: IsoRange) => range.fra <= date && date <= range.til;

const escapeCsvCell = (value: string): string => /[;"\r\n]/u.test(value)
  ? `"${value.replaceAll('"', '""')}"`
  : value;

export const buildEoDagsgrundlag = (args: Readonly<{
  values: TafCalculationValues;
  skadedato?: ISODateString;
  tafRanges: readonly IsoRange[];
  tafNetto?: TafNettoBeregningResult;
  svieSmertePeriods?: readonly SvieSmerteConstrainedPeriod[];
  partial?: boolean;
}>): EoDagsgrundlag | undefined => {
  const { values, tafRanges, tafNetto, svieSmertePeriods } = args;
  const income = tafNetto?.indkomstDagsgrundlag;
  const reference = income?.beregningsperiode;
  const erstatningsperiode = !args.partial
    ? validateIsoRange(values.vedroererPeriodeFra, values.vedroererPeriodeTil)
    : undefined;
  const ranges = [
    ...tafRanges, ...(svieSmertePeriods ?? []),
    ...(reference ? [reference.range] : []), ...(erstatningsperiode ? [erstatningsperiode] : []),
  ];
  if (ranges.length === 0) return undefined;

  const tafDates = new Set(tafRanges.flatMap(({ fra, til }) => [...buildDatoSetInclusive(fra, til)]));
  const hasTaf = tafNetto?.harTafPerioder === true;
  const cutoffs = hasTaf ? resolveTafCutoffDates({ ...values, skadedatoISO: args.skadedato }) : undefined;
  const candidates: { referenceDato: ISODateString; kilde: TafCutoffKilde }[] = [];
  if (cutoffs?.differencekravDato) candidates.push({ referenceDato: cutoffs.differencekravDato, kilde: 'differencekrav' });
  if (cutoffs?.endeligEETDato) candidates.push({ referenceDato: cutoffs.endeligEETDato, kilde: 'endeligEet' });
  if (cutoffs?.midlertidigEETDato) candidates.push({ referenceDato: cutoffs.midlertidigEETDato, kilde: 'midlertidigEet' });
  const cutoff = vaelgTafOphoersgrund(candidates);

  const dates = [...new Set(ranges.flatMap(({ fra, til }) => [...buildDatoSetInclusive(fra, til)]))].sort();
  if (cutoff && tafRanges.some(({ fra, til }) => fra <= cutoff.referenceDato && til < cutoff.referenceDato)
    && !dates.includes(cutoff.referenceDato)) {
    dates.push(cutoff.referenceDato);
    dates.sort();
  }
  const sh = buildShDageSetFromIsoRange(dates[0], dates[dates.length - 1]);
  const ferie = buildFerieDageSet(resolveIndkomstFerieperioder(values), new Set(dates));
  const tafWorkdays = buildTafArbejdsdageSet(values, tafRanges);
  const monthly = tafNetto?.tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER;
  const workdays = new Set(dates.filter((date) => monthly
    ? isWeekdayUtc(isoDateToDate(date))
    : tafDates.has(date)
      ? tafWorkdays.has(date)
      : isWeekdayUtc(isoDateToDate(date)) && !sh.has(date) && !ferie.has(date)));

  const names = ansaettelsesforholdNavne(values.loenindkomstAnsaettelsesforhold);
  const columns: CsvDayColumn[] = [];
  if (hasTaf) {
    for (const [index, employment] of values.loenindkomstAnsaettelsesforhold.entries()) {
      const id = employment.id;
      const name = resolveAnsaettelsesforholdNavn(employment.navnPaaArbejdssted, index, names);
      const perAnsaettelse = tafNetto.loenudvikling?.perAnsaettelse ?? [];
      const segments = (perAnsaettelse.length > 0
        ? perAnsaettelse.find((entry) => entry.ansaettelsesforholdId === id)?.beregnedeSegmenter
        : tafNetto.loenudvikling?.beregnedeSegmenter) ?? [];
      const regulation = new Map<ISODateString, string>();
      for (const segment of segments) {
        for (const date of buildDatoSetInclusive(segment.fra, segment.til)) {
          regulation.set(date, formatPercent(segment.deltaPct));
        }
      }
      columns.push({ header: `${name} – TAF-regulering`, values: regulation });
      const refWage = reference?.income.employers.find((entry) => entry.id === id);
      const refBreakdown = tafNetto.indkomstSkadestidspunkt?.arbejdssteder.find((entry) => entry.navn === name)?.breakdown;
      const refTargets: Partial<Record<keyof StandardLoenProjectedAmounts, number>> | undefined = refBreakdown ? {
        atp: toKroner(refBreakdown.atpOre),
        fpFvShSo: toKroner(refBreakdown.fpFvShSoOre),
        pension: toKroner(refBreakdown.pensionOre),
        samlet: toKroner(refBreakdown.samletOre),
      } : undefined;
      const tafWage = income?.taf?.entries.find((entry) => entry.kind === 'loen' && entry.employmentId === id);
      for (const [key, label] of WAGE_COLUMNS) {
        const referenceDays = refWage ? reference?.days.loen.get(id) ?? [] : [];
        const tafDays = tafWage ? income?.taf?.days.loen.get(id) ?? [] : [];
        if (reference) {
          columns.push(addMoneyColumn(`${name} – ${label} (beregningsperiode)`,
            referenceDays.map(({ date, amounts }) => [date, amounts[key]]),
            refTargets?.[key]));
        }
        columns.push(addMoneyColumn(`${name} – ${label}`, tafDays.map(({ date, amounts }) => [date, amounts[key]]),
          key === 'samlet' && tafWage ? toKroner(tafWage.amountOre) : undefined));
      }
    }
    for (const benefit of reference?.income.benefits ?? []) {
      const days = reference?.days.ydelse.get(benefit.typeKey) ?? [];
      columns.push(addMoneyColumn(`${benefit.label} (beregningsperiode)`,
        days.map(({ date, amount }) => [date, amount]), roundKroner(benefit.amount)));
    }
    for (const benefit of income?.taf?.entries ?? []) {
      if (benefit.kind !== 'ydelse') continue;
      const days = income?.taf?.days.ydelse.get(benefit.typeKey) ?? [];
      columns.push(addMoneyColumn(benefit.label, days.map(({ date, amount }) => [date, amount]), toKroner(benefit.amountOre)));
    }
  }

  const coverage = [
    ...(reference ? ['beregningsperioden'] : []),
    ...(hasTaf ? ['tabt arbejdsfortjeneste'] : []),
    ...(svieSmertePeriods?.length ? ['svie/smerte'] : []),
  ].join(' og ');

  return { dates, columns, ferie, sh, workdays, tafDates, hasTaf, cutoff, svieSmertePeriods, coverage };
};

export const renderEoDagsgrundlagCsv = (basis: EoDagsgrundlag): string => {
  const line = (cells: readonly string[]) => cells.map(escapeCsvCell).join(';');
  const baseHeaders = ['Ugedag', 'Dato', 'Hverdag', 'SH-dag', 'Feriedag', 'Arbejdsdag', 'Svie/smerte-dag'];
  if (basis.hasTaf) baseHeaders.push('TAF-dag');
  const lines = [line([...baseHeaders, ...basis.columns.map(({ header }) =>
    /^[\s\uFEFF]*[=+\-@]/u.test(header) ? `'${header}` : header,
  )])];
  const yes = (value: boolean) => value ? 'Ja' : '-';
  for (const date of basis.dates) {
    const utc = isoDateToDate(date);
    const sick = basis.svieSmertePeriods?.find((period) => inRange(date, period));
    const cells = [
      WEEKDAYS[utc.getUTCDay()], isoToDanish(date) ?? '', yes(isWeekdayUtc(utc)),
      yes(basis.sh.has(date)), yes(basis.ferie.has(date)), yes(basis.workdays.has(date)),
      sick ? (sick.isDelvist ? 'Delvis' : 'Ja') : basis.svieSmertePeriods ? '-' : '',
    ];
    if (basis.hasTaf) {
      cells.push(basis.cutoff?.referenceDato === date
        ? CUTOFF_LABELS[basis.cutoff.kilde]
        : yes(basis.tafDates.has(date) && basis.workdays.has(date)));
    }
    lines.push(line([...cells, ...basis.columns.map((column) => column.values.get(date) ?? '')]));
  }
  if (basis.columns.some((column) => column.adjustment)) {
    lines.push(line([
      'Afrunding', ...baseHeaders.slice(1).map(() => ''),
      ...basis.columns.map(({ adjustment }) => adjustment ? formatCurrency(adjustment / 100) : ''),
    ]));
  }
  // Dansk Excel læser semikolon, CRLF og UTF-8 med BOM.
  return `\uFEFF${lines.join('\r\n')}`;
};
