import type { ErstatningsopgoerelseValues, FerieperiodeRow, TafPeriodeRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import type { DeepReadonly } from '../../../types/deepReadonly';
import { isISODateString } from '../../../types/branded';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { calculateTafArbejdsdageBreakdown } from './tafCalculations';
import { mergeIsoDateRanges } from './isoRangeAlgebra';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds, type TafConstraintBounds } from '../validation/tafPeriodConstraints';
import { buildTafArbejdsdageSetFromRows } from './tafDaySets';

export type TafArbejdsdageAggregationInput = DeepReadonly<{
  erstatningsopgoerelse: ErstatningsopgoerelseValues;
  tafPerioder: ReadonlyArray<TafPeriodeRow>;
  ferieperioder: ReadonlyArray<FerieperiodeRow>;
  beregningsenhed: TafBeregningsenhed;
  tafRanges?: ReadonlyArray<Readonly<{ fra: ISODateString; til: ISODateString }>>;
  skadedatoISO?: ISODateString;
}>;

export type MergedTafGroup = Readonly<{
  id: string;
  fra: TafPeriodeRow['fra'];
  til: TafPeriodeRow['til'];
  loseFeriedage: number;
}>;

const rangesOverlap = (
  left: Readonly<{ fra: ISODateString; til: ISODateString }>,
  right: Readonly<{ fra: ISODateString; til: ISODateString }>
): boolean => left.fra <= right.til && left.til >= right.fra;

export const buildMergedTafGroups = (
  rows: ReadonlyArray<TafPeriodeRow>,
  bounds?: TafConstraintBounds,
  options: Readonly<{ authoritativeRanges?: readonly Readonly<{ fra: ISODateString; til: ISODateString }>[] }> = {}
): ReadonlyArray<MergedTafGroup> => {
  // Invalide rækker kan ikke påvirke TAF-dage; vi nulstiller derfor loseFeriedage eksplicit.
  const invalidRows = rows
    .filter((row) => {
      if (!row.fra || !row.til) return true;
      if (!isISODateString(row.fra) || !isISODateString(row.til)) return true;
      return row.fra > row.til;
    })
    .map((row) => ({ id: row.id, fra: row.fra, til: row.til, loseFeriedage: 0 }));

  const rawValidRows = rows
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

  let validRows = rawValidRows;

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

  // undefined = ikke leveret (brug rå TAF-rækker som basis).
  // [] = leveret men tom (ingen TAF-dage i perioden — returner straks kun invalidRows).
  const authoritativeRanges = options.authoritativeRanges;
  if (authoritativeRanges !== undefined) {
    // Når snapshot allerede har beregnet clampede TAF-ranges, er de autoritative.
    // Vi genbruger derfor disse ranges som beregningsgrundlag og henter kun rækkevis
    // loseFeriedage fra de overlappende inputrækker.
    // Tom liste betyder: ingen TAF-dage i perioden — returner kun invalide rækker (nul-bidrag).
    const authoritativeGroups: MergedTafGroup[] = [];
    for (const range of authoritativeRanges) {
      const sourceRows = rawValidRows.filter((row) => rangesOverlap(row, range));
      if (sourceRows.length === 0) continue;
      authoritativeGroups.push({
        id: sourceRows[0]?.id ?? `${range.fra}-${range.til}`,
        fra: range.fra,
        til: range.til,
        loseFeriedage: sourceRows.reduce((sum, row) => sum + row.loseFeriedage, 0),
      });
    }
    return [...invalidRows, ...authoritativeGroups];
  }

  const ranges = mergeIsoDateRanges(validRows.map((row) => ({ fra: row.fra, til: row.til })), { mergeAdjacent: true });
  const merged: MergedTafGroup[] = ranges.map((range) => {
    const sourceRows = validRows.filter((row) => row.fra <= range.til && row.til >= range.fra);
    const firstSource = sourceRows[0];
    const loseFeriedage = sourceRows.reduce((sum, row) => sum + row.loseFeriedage, 0);
    return {
      // Merged grupper er aggregerede perioder; vi bærer ét stabilt repræsentativt ID videre.
      id: firstSource?.id ?? `${range.fra}-${range.til}`,
      fra: range.fra,
      til: range.til,
      loseFeriedage,
    };
  });

  return [...invalidRows, ...merged];
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
  const { erstatningsopgoerelse, tafPerioder, ferieperioder, beregningsenhed, tafRanges, skadedatoISO } = input;
  if (beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE) {
    const arbejdsdageSet = buildTafArbejdsdageSetFromRows(tafPerioder, ferieperioder, { authoritativeRanges: tafRanges });
    return arbejdsdageSet.size === 0 ? null : arbejdsdageSet.size;
  }
  const tafBounds = resolveTafConstraintBounds(erstatningsopgoerelse, { skadedatoISO });
  const mergedGroups = buildMergedTafGroups(tafPerioder, tafBounds, { authoritativeRanges: tafRanges });

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

    // I måneders-sporet summerer vi kun hverdage. Den aggregerede loseFeriedage-værdi
    // på merged groups er derfor irrelevant her og påvirker ikke korrektheden.
    sum += beregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? breakdown.arbejdsdage : breakdown.tafDage;
    countedGroups += 1;
  }

  if (countedGroups === 0) return null;
  return Math.max(0, Math.trunc(sum));
};
