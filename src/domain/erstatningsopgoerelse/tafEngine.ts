import type { ErstatningsopgoerelseValues, FerieperiodeRow, TafPeriodeRow } from '../../schemas/formSchemas';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import { calculateTafAntalArbejdsdage, calculateTafAntalMaaneder } from './tafCalculations';
import { computeTafOverlapWithBeregningsperiode } from './beregningsperiodeTafOverlap';

export type TafDerivedResult = Readonly<{
  derivedById: Record<string, number | null>;
  kolonneOverskrift: string;
  beregningsenhed: TafBeregningsenhed;
}>;

export const buildTafDerived = (args: {
  values: ErstatningsopgoerelseValues;
  tafPerioder: readonly TafPeriodeRow[];
  ferieperioder: readonly FerieperiodeRow[];
}): TafDerivedResult => {
  const beregningsenhed = computeTafBeregningsenhed(args.values);
  const visAntalMaaneder = beregningsenhed === TAF_BEREGNES_SOM.MAANEDER;
  const kolonneOverskrift = visAntalMaaneder ? 'Antal måneder' : 'Antal arbejdsdage';

  const derivedById: Record<string, number | null> = {};
  for (const row of args.tafPerioder) {
    const loseFeriedage = typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
    derivedById[row.id] = visAntalMaaneder
      ? calculateTafAntalMaaneder(
        row.fra,
        row.til,
        args.ferieperioder,
        loseFeriedage,
        0
      )
      : calculateTafAntalArbejdsdage(row.fra, row.til, args.ferieperioder, loseFeriedage, { kind: 'taf' });
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
