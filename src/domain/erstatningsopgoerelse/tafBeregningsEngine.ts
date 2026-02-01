import type { ErstatningsopgoerelseValues, FerieperiodeRow, TafPeriodeRow } from '../../schemas/formSchemas';
import type { DeepReadonly } from '../../types/deepReadonly';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import { calculateTafAntalArbejdsdage, calculateTafAntalMaaneder } from './tafCalculations';

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

export const computeTafEngine = (input: TafEngineInputSnapshot): TafEngineOutput => {
  const { erstatningsopgoerelse, tafPerioder, ferieperioder } = input;
  const beregningsenhed = computeTafBeregningsenhed(erstatningsopgoerelse);
  const visAntalMaaneder = beregningsenhed === TAF_BEREGNES_SOM.MAANEDER;

  // Row order does not affect calculations; output preserves input order for stable rendering.
  const rows = tafPerioder.map((row) => {
    const loseFeriedage = typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
    const value = visAntalMaaneder
      ? calculateTafAntalMaaneder(
        row.fra,
        row.til,
        ferieperioder,
        loseFeriedage,
        erstatningsopgoerelse.oevrigtFravaerUdenLoen === 'Ja' && typeof erstatningsopgoerelse.oevrigeFravaersdage === 'number'
          ? erstatningsopgoerelse.oevrigeFravaersdage
          : 0
      )
      : calculateTafAntalArbejdsdage(row.fra, row.til, ferieperioder, loseFeriedage);
    if (value === null) {
      // Missing dates yield null for TAF; this is a deliberate domain decision, not an error state.
      return { id: row.id, value: null };
    }
    return { id: row.id, value: roundTafValue(value) };
  });

  return { beregningsenhed, rows };
};
