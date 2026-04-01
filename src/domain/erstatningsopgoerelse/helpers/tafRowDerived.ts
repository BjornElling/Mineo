import type { ErstatningsopgoerelseValues, FerieperiodeRow, TafPeriodeRow } from '../../../schemas/formSchemas';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import { calculateTafAntalArbejdsdage, calculateTafAntalMaaneder } from '../engines/tafCalculations';
import { computeTafOverlapWithBeregningsperiode } from '../engines/beregningsperiodeTafOverlap';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds } from '../validation/tafPeriodConstraints';

export type TafDerivedResult = Readonly<{
  derivedById: Record<string, number | null>;
  kolonneOverskrift: string;
  beregningsenhed: TafBeregningsenhed;
}>;

// UI/debug per-row afledninger:
// Bevarer én værdi per indtastet række og merger IKKE overlappende perioder.
// Samlede/aggregerede TAF-beregninger håndteres i `tafBeregningsEngine.ts`.
export const buildTafDerived = (args: {
  values: ErstatningsopgoerelseValues;
  tafPerioder: readonly TafPeriodeRow[];
  ferieperioder: readonly FerieperiodeRow[];
}): TafDerivedResult => {
  const beregningsenhed = computeTafBeregningsenhed(args.values);
  const visAntalMaaneder = beregningsenhed === TAF_BEREGNES_SOM.MAANEDER;
  const kolonneOverskrift = visAntalMaaneder ? 'TAF-måneder' : 'TAF-arbejdsdage';
  const tafBounds = resolveTafConstraintBounds(args.values);

  const derivedById: Record<string, number | null> = {};
  for (const row of args.tafPerioder) {
    const loseFeriedage = typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
    const validRange = getValidTafRange(row);
    if (!validRange) {
      derivedById[row.id] = null;
      continue;
    }
    const clamped = clampTafRange(validRange, tafBounds);
    if (!clamped) {
      derivedById[row.id] = 0;
      continue;
    }
    derivedById[row.id] = visAntalMaaneder
      ? calculateTafAntalMaaneder(
        clamped.fra,
        clamped.til,
        0
      )
      : calculateTafAntalArbejdsdage(clamped.fra, clamped.til, args.ferieperioder, loseFeriedage, { kind: 'taf' });
  }

  return { derivedById, kolonneOverskrift, beregningsenhed };
};

export const buildBeregningsperiodeTafOverlap = (args: {
  values: ErstatningsopgoerelseValues;
  tafPerioder: readonly TafPeriodeRow[];
}) => {
  return computeTafOverlapWithBeregningsperiode({
    beregningsperiode: {
      fra: args.values.periodeTilBeregningFra,
      til: args.values.periodeTilBeregningTil,
    },
    tafPerioder: args.tafPerioder.map((row) => ({ id: row.id, fra: row.fra, til: row.til })),
  });
};
