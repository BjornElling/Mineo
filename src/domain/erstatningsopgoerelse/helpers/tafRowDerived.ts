import type { ErstatningsopgoerelseValues, FerieperiodeRow, TafPeriodeRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import { calculateTafAntalArbejdsdage, calculateTafAntalMaaneder } from '../engines/tafCalculations';
import { computeTafOverlapWithBeregningsperiode } from '../engines/beregningsperiodeTafOverlap';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds } from '../validation/tafPeriodConstraints';
import { harTafPeriodeIngenArbejdsdage } from '../validation/tafRowRules';
import { countFeriedageInRanges } from '../engines/tafDaySets';
import { buildTafRanges } from './indtaegtPerioder';
import type { IsoRange } from '../../../utils/isoDateHelpers';

export type TafDerivedResult = Readonly<{
  derivedById: Record<string, number | null>;
  /** Rækker, hvis periode inden for opgørelsen ikke har én arbejdsdag (kun i arbejdsdage, BB-257). */
  ingenArbejdsdageById: Record<string, boolean>;
  kolonneOverskrift: string;
  beregningsenhed: TafBeregningsenhed;
}>;

// UI/kontrol per-row afledninger:
// Bevarer én værdi per indtastet række og merger IKKE overlappende perioder.
// Samlede/aggregerede TAF-beregninger håndteres i `tafBeregningsEngine.ts`.
export const buildTafDerived = (args: {
  values: ErstatningsopgoerelseValues;
  tafPerioder: readonly TafPeriodeRow[];
  ferieperioder: readonly FerieperiodeRow[];
  skadedatoISO?: ISODateString | undefined;
}): TafDerivedResult => {
  const beregningsenhed = computeTafBeregningsenhed(args.values);
  const visAntalMaaneder = beregningsenhed === TAF_BEREGNES_SOM.MAANEDER;
  // Kolonnen tæller rækkens del inden for EO-perioden, og overskriften siger det, så en række på tolv
  // måneder, der står med 6, ikke fremstår som en tavs reduktion (BB-250, BB-217's form).
  const kolonneOverskrift = visAntalMaaneder ? 'TAF-måneder (i EO-perioden)' : 'TAF-arbejdsdage (i EO-perioden)';
  const tafBounds = resolveTafConstraintBounds(args.values, { skadedatoISO: args.skadedatoISO });

  const derivedById: Record<string, number | null> = {};
  const ingenArbejdsdageById: Record<string, boolean> = {};
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
    if (!visAntalMaaneder && harTafPeriodeIngenArbejdsdage(clamped)) ingenArbejdsdageById[row.id] = true;
    derivedById[row.id] = visAntalMaaneder
      ? calculateTafAntalMaaneder(
        clamped.fra,
        clamped.til,
        0
      )
      : calculateTafAntalArbejdsdage(clamped.fra, clamped.til, args.ferieperioder, loseFeriedage, { kind: 'taf' });
  }

  return { derivedById, ingenArbejdsdageById, kolonneOverskrift, beregningsenhed };
};

/**
 * Ferietabellernes kolonne: de feriedage i hver række, beregningen faktisk fradrager – rækkens fællesmængde
 * med TAF-perioderne (TAF-afsnittets ferie) eller med beregningsperioden (beregningsgrundlagets ferie).
 * Overskriften siger rammen, så et tal lavere end rækkens længde ikke fremstår som en tavs reduktion (BB-249,
 * BB-217's form).
 *
 * Findes rammen slet ikke endnu – ingen gyldig TAF-række, eller beregningsperioden er ikke udfyldt – tælles
 * rækken for sig, som svie/smerte-tabellen gør uden en EO-periode. Findes rammen, men ligger ferien uden for
 * den, er tallet 0.
 */
export const buildFerieFeriedageById = (
  ferieperioder: readonly FerieperiodeRow[],
  ramme: readonly IsoRange[] | undefined,
): Record<string, number | null> =>
  Object.fromEntries(ferieperioder.map((row) => {
    const egenRamme = row.fra !== undefined && row.til !== undefined && row.fra <= row.til
      ? [{ fra: row.fra, til: row.til }]
      : [];
    return [row.id, countFeriedageInRanges(row, ramme ?? egenRamme)];
  }));

/** TAF-afsnittets ramme: de clampede TAF-perioder, eller `undefined` når der endnu ingen gyldig TAF-række er. */
export const resolveTafFerieRamme = (
  values: ErstatningsopgoerelseValues,
  skadedatoISO: ISODateString | undefined,
): readonly IsoRange[] | undefined =>
  values.tafPerioder.some((row) => getValidTafRange(row) !== null)
    ? buildTafRanges(values, skadedatoISO === undefined ? undefined : { skadedatoISO })
    : undefined;

/** Beregningsgrundlagets ramme: beregningsperioden, eller `undefined` når den ikke er gyldigt udfyldt. */
export const resolveBeregningsperiodeFerieRamme = (
  values: Pick<ErstatningsopgoerelseValues, 'tafBeregningsperiodeFra' | 'tafBeregningsperiodeTil'>,
): readonly IsoRange[] | undefined => {
  const fra = values.tafBeregningsperiodeFra;
  const til = values.tafBeregningsperiodeTil;
  return fra !== undefined && til !== undefined && fra <= til ? [{ fra, til }] : undefined;
};

export const buildBeregningsperiodeTafOverlap = (args: {
  values: ErstatningsopgoerelseValues;
  tafPerioder: readonly TafPeriodeRow[];
}) => {
  return computeTafOverlapWithBeregningsperiode({
    beregningsperiode: {
      fra: args.values.tafBeregningsperiodeFra,
      til: args.values.tafBeregningsperiodeTil,
    },
    tafPerioder: args.tafPerioder.map((row) => ({ id: row.id, fra: row.fra, til: row.til })),
  });
};
