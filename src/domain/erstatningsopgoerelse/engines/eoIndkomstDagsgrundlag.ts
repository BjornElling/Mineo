import type { ISODateString } from '../../../types/branded';
import type { StandardLoenProjectedAmounts } from '../../aarsloen/standardLoenRowCalculations';
import type { IncomeDayReceiver, IncomePeriodResult, IsoRange } from '../helpers/indtaegtPerioder';
import type { TafIndtaegtEntry } from './tafIndtaegterBeregning';

export type EoIndkomstDagsgrundlag = Readonly<{
  beregningsperiode?: Readonly<{ range: IsoRange; income: IncomePeriodResult; days: IncomeDays }>;
  taf?: Readonly<{ entries: readonly TafIndtaegtEntry[]; days: IncomeDays }>;
}>;

export type IncomeDays = Readonly<{
  loen: ReadonlyMap<string, readonly Readonly<{ date: ISODateString; amounts: StandardLoenProjectedAmounts }>[]>;
  ydelse: ReadonlyMap<string, readonly Readonly<{ date: ISODateString; amount: number }>[]>;
}>;

export const collectIncomeDays = () => {
  const loen = new Map<string, { date: ISODateString; amounts: StandardLoenProjectedAmounts }[]>();
  const ydelse = new Map<string, { date: ISODateString; amount: number }[]>();
  const receiver: IncomeDayReceiver = {
    loen: (id, date, amounts) => {
      const days = loen.get(id);
      if (days) days.push({ date, amounts });
      else loen.set(id, [{ date, amounts }]);
    },
    ydelse: (key, date, amount) => {
      const days = ydelse.get(key);
      if (days) days.push({ date, amount });
      else ydelse.set(key, [{ date, amount }]);
    },
  };
  const projectLoen = (id: string, project: (amounts: StandardLoenProjectedAmounts) => StandardLoenProjectedAmounts) => {
    const days = loen.get(id);
    if (days) loen.set(id, days.map(({ date, amounts }) => ({ date, amounts: project(amounts) })));
  };
  return { receiver, days: { loen, ydelse } satisfies IncomeDays, projectLoen };
};
