import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { addMonths } from '../../../utils/dateUtils';
import { dateToISO, parseISODate, type ISODateString } from '../../../types/branded';
import { parseAarsloenRowInterval } from '../helpers/indtaegtPerioder';
import type { SygeferiegodtgoerelseResult } from './sfggResult';
import { hasPositiveSfggIncome } from './sfggPeriodisering';

const getLastIncomeDate = (
  employment: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): ISODateString | null => {
  let latest: ISODateString | null = null;
  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    if (!hasPositiveSfggIncome(row)) continue;
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;
    const iso = dateToISO(interval.end);
    if (iso && (latest === null || iso > latest)) latest = iso;
  }
  return latest;
};

export const findSfggSixMonthWarningEmploymentIds = (args: Readonly<{
  values: ErstatningsopgoerelseValues;
  result: SygeferiegodtgoerelseResult;
}>): readonly string[] => {
  const warningIds: string[] = [];
  for (const employment of args.values.loenindkomstAnsaettelsesforhold ?? []) {
    const calculation = args.result.perAnsaettelsesforhold.find((entry) => entry.ansaettelsesforholdId === employment.id);
    if (!calculation || calculation.segments.length === 0) continue;
    const lastIncomeDate = getLastIncomeDate(employment);
    if (!lastIncomeDate) continue;
    const date = parseISODate(lastIncomeDate);
    if (!date) continue;
    const thresholdIso = dateToISO(addMonths(date, 6));
    const latestSegmentDate = calculation.segments[calculation.segments.length - 1]?.til;
    if (thresholdIso && latestSegmentDate && latestSegmentDate > thresholdIso) warningIds.push(employment.id);
  }
  return warningIds;
};
