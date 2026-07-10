import type { OevrigeKravRow } from '../../../schemas/formSchemas';
import { amountValueToNumber } from '../../../utils/expressionAmount';
import { isOevrigeKravRowEmpty } from './rowEmpty';
import { clampMoneyOreToZero, fromKroner, sumMoneyOre } from '../../money/money';
import type { MoneyOre } from '../../money/money';

export type ParsedOevrigeKravRow = Readonly<{
  original: OevrigeKravRow;
  amountOre: MoneyOre;
}>;

export type ParsedOevrigeKravAmounts = Readonly<{
  rows: ReadonlyArray<ParsedOevrigeKravRow>;
  totalOre: MoneyOre;
}>;

export const parseOevrigeKravBeloeb = (
  rows: ReadonlyArray<OevrigeKravRow>
): ParsedOevrigeKravAmounts | null => {
  const parsedRows: ParsedOevrigeKravRow[] = [];

  for (const row of rows) {
    if (isOevrigeKravRowEmpty(row)) continue;
    const amount = amountValueToNumber(row.beloeb);
    if (amount === undefined || amount < 0) return null;

    let amountOre: MoneyOre;
    try {
      amountOre = fromKroner(amount);
    } catch {
      return null;
    }

    parsedRows.push({
      original: row,
      amountOre,
    });
  }

  try {
    const totalOre = clampMoneyOreToZero(
      sumMoneyOre(parsedRows.map((row) => row.amountOre))
    );
    return {
      rows: parsedRows,
      totalOre,
    };
  } catch {
    return null;
  }
};
