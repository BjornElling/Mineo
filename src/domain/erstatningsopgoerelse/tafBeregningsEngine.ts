import type { ErstatningsopgoerelseValues, FerieperiodeRow, TafPeriodeRow } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { DeepReadonly } from '../../types/deepReadonly';
import { isISODateString } from '../../types/branded';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import { calculateTafAntalArbejdsdage, calculateTafAntalMaaneder, calculateTafArbejdsdageBreakdown } from './tafCalculations';
import { mergeIsoDateRanges } from './periodMerging';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds, type TafConstraintBounds } from './tafPeriodConstraints';

export type TafEngineInputSnapshot = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  tafPerioder: ReadonlyArray<TafPeriodeRow>;
  ferieperioder: ReadonlyArray<FerieperiodeRow>;
}>;

export type TafEngineRowResult = Readonly<{
  id: string;
  value: number | null;
}>;

export type TafEngineOutput = Readonly<{
  beregningsenhed: TafBeregningsenhed;
  rows: ReadonlyArray<TafEngineRowResult>;
}>;

export type TafArbejdsdageAggregationInput = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  tafPerioder: ReadonlyArray<TafPeriodeRow>;
  ferieperioder: ReadonlyArray<FerieperiodeRow>;
  beregningsenhed: TafBeregningsenhed;
}>;

const roundTafValue = (value: number): number => {
  return Math.round(value * 100) / 100;
};

export type MergedTafGroup = Readonly<{
  id: string;
  fra: TafPeriodeRow['fra'];
  til: TafPeriodeRow['til'];
  loseFeriedage: number;
}>;

export const buildMergedTafGroups = (
  rows: ReadonlyArray<TafPeriodeRow>,
  bounds?: TafConstraintBounds
): ReadonlyArray<MergedTafGroup> => {
  const invalidRows = rows
    .filter((row) => {
      if (!row.fra || !row.til) return true;
      if (!isISODateString(row.fra) || !isISODateString(row.til)) return true;
      return row.fra > row.til;
    })
    .map((row) => ({ id: row.id, fra: row.fra, til: row.til, loseFeriedage: 0 }));

  let validRows = rows
    .map((row, index) => {
      const validRange = getValidTafRange(row);
      if (!validRange) return null;
      return {
        index,
        id: row.id,
        fra: validRange.fra,
        til: validRange.til,
        loseFeriedage: typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0,
      };
    })
    .filter(
      (row): row is { index: number; id: string; fra: ISODateString; til: ISODateString; loseFeriedage: number } => Boolean(row)
    );

  if (bounds) {
    validRows = validRows
      .map((row) => {
        const clamped = clampTafRange({ fra: row.fra, til: row.til }, bounds);
        if (!clamped) return null;
        return { ...row, fra: clamped.fra, til: clamped.til };
      })
      .filter(
        (row): row is { index: number; id: string; fra: ISODateString; til: ISODateString; loseFeriedage: number } => Boolean(row)
      );
  }

  if (validRows.length === 0) return invalidRows;

  const ranges = mergeIsoDateRanges(validRows.map((row) => ({ fra: row.fra, til: row.til })), { mergeAdjacent: true });
  const merged: MergedTafGroup[] = ranges.map((range) => {
    const sourceRows = validRows.filter((row) => row.fra <= range.til && row.til >= range.fra);
    const firstSource = sourceRows[0];
    const loseFeriedage = sourceRows.reduce((sum, row) => sum + row.loseFeriedage, 0);
    return {
      id: firstSource?.id ?? `${range.fra}-${range.til}`,
      fra: range.fra,
      til: range.til,
      loseFeriedage,
    };
  });

  return [...invalidRows, ...merged];
};

export const computeTafEngine = (input: TafEngineInputSnapshot): TafEngineOutput => {
  const { erstatningsopgoerelse, tafPerioder, ferieperioder } = input;
  const beregningsenhed = computeTafBeregningsenhed(erstatningsopgoerelse);
  const visAntalMaaneder = beregningsenhed === TAF_BEREGNES_SOM.MAANEDER;
  const tafBounds = resolveTafConstraintBounds(erstatningsopgoerelse);
  const mergedGroups = buildMergedTafGroups(tafPerioder, tafBounds);

  // TAF aggregation is computed on merged, canonical periods to avoid overlap double counting.
  const rows = mergedGroups.map((group) => {
    const value = visAntalMaaneder
      ? calculateTafAntalMaaneder(
        group.fra,
        group.til,
        ferieperioder,
        group.loseFeriedage,
        0
      )
      : calculateTafAntalArbejdsdage(group.fra, group.til, ferieperioder, group.loseFeriedage, { kind: 'taf' });
    if (value === null) {
      // Missing dates yield null for TAF; this is a deliberate domain decision, not an error state.
      return { id: group.id, value: null };
    }
    return { id: group.id, value: roundTafValue(value) };
  });

  return { beregningsenhed, rows };
};

/**
 * Beregner aggregerede TAF-arbejdsdage til kontrol/sammentælling.
 *
 * Vigtigt:
 * - `Måneder`: returnerer antal hverdage (ingen fradrag for SH/ferie/løse dage).
 * - `Arbejdsdage`: returnerer TAF-dage (med fradrag for SH/ferie/løse dage).
 * - Returnerer `null`, når der ikke findes mindst én gyldig, clampet TAF-periode.
 */
export const computeTafArbejdsdageAggregation = (input: TafArbejdsdageAggregationInput): number | null => {
  const { erstatningsopgoerelse, tafPerioder, ferieperioder, beregningsenhed } = input;
  const tafBounds = resolveTafConstraintBounds(erstatningsopgoerelse);
  const mergedGroups = buildMergedTafGroups(tafPerioder, tafBounds);

  let sum = 0;
  let countedGroups = 0;

  for (const group of mergedGroups) {
    if (!group.fra || !group.til) continue;
    if (!isISODateString(group.fra) || !isISODateString(group.til)) continue;
    if (group.fra > group.til) continue;

    const breakdown = calculateTafArbejdsdageBreakdown(
      group.fra,
      group.til,
      ferieperioder,
      group.loseFeriedage,
      { kind: 'taf' }
    );
    if (!breakdown) continue;

    sum += beregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? breakdown.arbejdsdage : breakdown.tafDage;
    countedGroups += 1;
  }

  if (countedGroups === 0) return null;
  return Math.max(0, Math.trunc(sum));
};
