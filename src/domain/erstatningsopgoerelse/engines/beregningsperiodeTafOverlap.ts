import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
// Intervalalgebraen er IKKE EO-specifik og bor derfor ét kanonisk sted (`utils/closedDateRange`, GM-F15).
// Modulet her ejer kun den EO-specifikke overlapsREGEL og dens brugerbesked. Der re-eksporteres bevidst
// INTET: to importstier til samme primitiv ville være netop den parallelitet, fundet handler om.
import {
  isValidClosedDateRange,
  rangesOverlap,
  type ClosedDateRange,
  type OptionalClosedDateRange,
} from '../../../utils/closedDateRange';

export type PeriodRow = Readonly<{
  id: string;
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
}>;

const formatISOForMessage = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

const formatRange = (range: ClosedDateRange): string =>
  `${formatISOForMessage(range.fra)} - ${formatISOForMessage(range.til)}`;

export const buildBeregningsperiodeTafOverlapErrorMessage = (args: {
  beregningsperiode: ClosedDateRange;
  tafPeriode: ClosedDateRange;
}): string => {
  const { beregningsperiode, tafPeriode } = args;
  return `Der er overlap mellem beregningsperioden (${formatRange(beregningsperiode)}) og en TAF-periode (${formatRange(tafPeriode)})`;
};

const compareRanges = (a: ClosedDateRange, b: ClosedDateRange): number => {
  if (a.fra !== b.fra) return a.fra < b.fra ? -1 : 1;
  if (a.til !== b.til) return a.til < b.til ? -1 : 1;
  return 0;
};

export const computeTafOverlapWithBeregningsperiode = (args: {
  beregningsperiode: OptionalClosedDateRange;
  tafPerioder: readonly PeriodRow[];
}): Readonly<{
  overlapMessageByRowId: Record<string, string>;
  firstOverlapMessage: string | undefined;
}> => {
  const { beregningsperiode, tafPerioder } = args;

  if (!isValidClosedDateRange(beregningsperiode)) {
    return { overlapMessageByRowId: {}, firstOverlapMessage: undefined };
  }

  const overlapRows: Array<{ id: string; range: ClosedDateRange }> = [];
  for (const row of tafPerioder) {
    const rowRange: OptionalClosedDateRange = { fra: row.fra, til: row.til };
    if (!isValidClosedDateRange(rowRange)) continue;
    if (!rangesOverlap(beregningsperiode, rowRange)) continue;
    overlapRows.push({ id: row.id, range: rowRange });
  }

  overlapRows.sort((a, b) => compareRanges(a.range, b.range));

  const overlapMessageByRowId: Record<string, string> = {};
  for (const row of overlapRows) {
    overlapMessageByRowId[row.id] = buildBeregningsperiodeTafOverlapErrorMessage({
      beregningsperiode,
      tafPeriode: row.range,
    });
  }

  const firstOverlapMessage =
    overlapRows.length === 0
      ? undefined
      : buildBeregningsperiodeTafOverlapErrorMessage({
          beregningsperiode,
          tafPeriode: overlapRows[0].range,
        });

  return { overlapMessageByRowId, firstOverlapMessage };
};

