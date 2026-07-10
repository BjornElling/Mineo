import { sumMaanedsbroekForInterval } from '../../../domain/dates/maanedsbroek';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const d = (value: ISODateString): Date => new Date(`${value}T00:00:00.000Z`);

describe('sumMaanedsbroekForInterval', () => {
  it('låser månedsgrænser og skudår til de eksisterende golden-værdier', () => {
    expect(sumMaanedsbroekForInterval(iso('2024-03-01'), iso('2024-03-31'))).toBeCloseTo(1, 10);
    expect(sumMaanedsbroekForInterval(iso('2024-01-01'), iso('2024-01-15'))).toBeCloseTo(15 / 31, 10);
    expect(sumMaanedsbroekForInterval(iso('2024-02-15'), iso('2024-02-15'))).toBeCloseTo(1 / 29, 10);
    expect(sumMaanedsbroekForInterval(iso('2023-02-15'), iso('2023-02-15'))).toBeCloseTo(1 / 28, 10);
    expect(sumMaanedsbroekForInterval(iso('2024-02-01'), iso('2024-02-29'))).toBeCloseTo(1, 10);
  });

  it('giver 0 for et omvendt interval', () => {
    expect(sumMaanedsbroekForInterval(iso('2024-03-31'), iso('2024-03-01'))).toBe(0);
  });

  // Ækvivalens-lås: den kanoniske helper grupperer pr. måned og dividerer én gang (Σ count/x),
  // mens den tidligere indkomst-mellemregning summerede 1/x pr. dag (Σ 1/x). De to summer kan
  // afvige i sidste ULP pga. floating point, men skal være identiske efter den 2-decimal-afrunding
  // begge kaldere anvender.
  it('matcher den tidligere Σ 1/dage-i-måned-formel efter 2-decimal-afrunding', () => {
    const daysInMonth = (year: number, month: number): number =>
      new Date(Date.UTC(year, month, 0)).getUTCDate();
    const prefixStart = d(iso('2018-01-01'));
    const prefixEnd = d(iso('2023-04-08'));
    const dayWeights: number[] = [0];
    for (let cur = new Date(prefixStart.getTime()); cur <= prefixEnd; cur.setUTCDate(cur.getUTCDate() + 1)) {
      dayWeights.push(dayWeights[dayWeights.length - 1]! + 1 / daysInMonth(cur.getUTCFullYear(), cur.getUTCMonth() + 1));
    }
    const inlineSum = (fra: ISODateString, til: ISODateString): number => {
      const fraIndex = Math.round((d(fra).getTime() - prefixStart.getTime()) / 86_400_000);
      const tilIndexInclusive = Math.round((d(til).getTime() - prefixStart.getTime()) / 86_400_000);
      return dayWeights[tilIndexInclusive + 1]! - dayWeights[fraIndex]!;
    };
    const round2 = (x: number): number => {
      const v = x * 100;
      return (Math.sign(v) * Math.round(Math.abs(v))) / 100;
    };
    const start = d(iso('2018-01-01'));
    const mismatches: Array<{ fra: ISODateString; til: ISODateString; actual: number; expected: number }> = [];
    // Skridtene er indbyrdes primiske med 30, så startdag og intervallængde varierer bredt
    // over månedsgrænser uden unødigt mange kombinationer i den fulde suite.
    for (let offset = 0; offset < 800; offset += 29) {
      for (let len = 0; len < 1100; len += 71) {
        const fraDate = new Date(start.getTime());
        fraDate.setUTCDate(fraDate.getUTCDate() + offset);
        const tilDate = new Date(fraDate.getTime());
        tilDate.setUTCDate(tilDate.getUTCDate() + len);
        const fra = toISODateString(fraDate.toISOString().slice(0, 10));
        const til = toISODateString(tilDate.toISOString().slice(0, 10));
        const actual = round2(sumMaanedsbroekForInterval(fra, til));
        const expected = round2(inlineSum(fra, til));
        if (actual !== expected) mismatches.push({ fra, til, actual, expected });
      }
    }
    expect(mismatches).toEqual([]);
  });
});
