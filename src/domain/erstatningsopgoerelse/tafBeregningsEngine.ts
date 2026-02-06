import type { ErstatningsopgoerelseValues, FerieperiodeRow, TafPeriodeRow } from '../../schemas/formSchemas';
import type { DeepReadonly } from '../../types/deepReadonly';
import { isISODateString } from '../../types/branded';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import { calculateTafAntalArbejdsdage, calculateTafAntalMaaneder } from './tafCalculations';
import { mergeIsoDateRanges } from './periodMerging';

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

const roundTafValue = (value: number): number => {
  return Math.round(value * 100) / 100;
};

export type MergedTafGroup = Readonly<{
  id: string;
  fra: TafPeriodeRow['fra'];
  til: TafPeriodeRow['til'];
  loseFeriedage: number;
}>;

export const buildMergedTafGroups = (rows: ReadonlyArray<TafPeriodeRow>): ReadonlyArray<MergedTafGroup> => {
  const invalidRows = rows
    .filter((row) => {
      if (!row.fra || !row.til) return true;
      if (!isISODateString(row.fra) || !isISODateString(row.til)) return true;
      return row.fra > row.til;
    })
    .map((row) => ({ id: row.id, fra: row.fra, til: row.til, loseFeriedage: 0 }));

  const validRows = rows
    .filter((row): row is TafPeriodeRow & { fra: NonNullable<TafPeriodeRow['fra']>; til: NonNullable<TafPeriodeRow['til']> } => {
      if (!row.fra || !row.til) return false;
      if (!isISODateString(row.fra) || !isISODateString(row.til)) return false;
      return row.fra <= row.til;
    })
    .map((row, index) => ({
      index,
      id: row.id,
      fra: row.fra,
      til: row.til,
      loseFeriedage: typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0,
    }));

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
  const mergedGroups = buildMergedTafGroups(tafPerioder);

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
