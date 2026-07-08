import type { ISODateString } from '../../../types/branded';
import { isoToDanish } from '../../../types/branded';
import {
  getEffektiveSatserForDato,
  getGrundloenAngivetPerForOverenskomst,
  getReguleringsDatoIntervalForOverenskomst,
  type OverenskomstId,
  type OverenskomstPeriodeSats,
} from '../../../data/overenskomstRates';
import { STORE_BEDEDAG_PCT, STORE_BEDEDAG_START } from '../../../config/indskudteLoentillaeg';
import { differsFromZero } from '../../../utils/numberComparison';
import { round2 } from '../../../utils/roundingShortcuts';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { convertAnciennitetSats, parseDanishToIso, resolvePctPointFromSatsOrInput } from '../helpers/eoSharedUtils';
import type { FormulaComponents } from './reguleringFormulaUtils';

// =============================================================================
// Anciennitetstillæg i reguleringsforløb — ét fælles opslag delt af motor, præsentation og kontrol.
//
// Tillægget (og dets gate-datoer) blev tidligere udledt tre gange uafhængigt: motorens
// `overenskomstSegmentContext`, præsentationens reguleringsindeks-tabel og — implicit ved
// FRAVÆR — kontrol-laget (`eoInspektionRegulationCore`), som slet ikke medtog tillægget og
// derfor kunne vise et forkert kontrol-indeks (falsk `control:sammentaelling_mismatch`).
// Resolveren nedenfor er den ENESTE kilde til tillæggets kroneværdi og aktiveringsdato.
// Selve indeks-/pakkeberegningen forbliver pr. lag (motorens pct-point-formel vs.
// kontrol-lagets decimal-konvention, jf. B9) — kun resolutionen af user-input deles.
// =============================================================================

/**
 * Anciennitetstillæg der er aktivt fra en given dato, delt af begge overenskomst-grene + kontrol.
 * Datoen må efter den nuværende domæneregel kun ligge efter anvendt reguleringsdato, så
 * tillægget er aldrig en del af referenceniveauet (indeks 100). `activeFromIso` bruges til
 * segment-splitting og per-segment-gate; ligger datoen før den viste periode, clampes den op til
 * periodens første dag.
 */
export type AnciennitetForIndex = Readonly<{
  activeFromIso: ISODateString;
  supplementValue: number;
}>;

export type AnciennitetForIndexInput = Readonly<{
  harAnciennitetstillaeg: boolean | undefined;
  anciennitetstillaegDatoIso: ISODateString | undefined;
  satsValue: number | undefined;
  satsAngivesPer: 'Time' | 'Måned' | undefined;
  overenskomstId: string | undefined;
  tafBeregningsenhed: TafBeregningsenhed;
  anvendtReguleringsdatoIso: ISODateString | undefined;
  // Periodens grænser (motor: tafRanges min/max; kontrol/præsentation: den viste periodes ISO-span).
  periodeStartIso: ISODateString;
  periodeEndIso: ISODateString;
}>;

/**
 * Udleder anciennitetstillæggets kroneværdi (i grundlønnens enhed) + aktiveringsdato, eller `null`
 * hvis der intet aktivt tillæg er. `anciennitetstillaegSatsAngivesPer` er schema-defaultet til
 * 'Måned', så `?? 'Måned'` er blot defensivt (aldrig nået for schema-gyldigt input).
 */
export const resolveAnciennitetForIndex = (
  input: AnciennitetForIndexInput
): AnciennitetForIndex | null => {
  if (!input.harAnciennitetstillaeg) return null;
  const anciennitetDato = input.anciennitetstillaegDatoIso;
  const satsValue = input.satsValue;
  if (!anciennitetDato || typeof satsValue !== 'number' || !Number.isFinite(satsValue) || satsValue <= 0) {
    return null;
  }
  if (input.anvendtReguleringsdatoIso && anciennitetDato <= input.anvendtReguleringsdatoIso) return null;
  if (anciennitetDato > input.periodeEndIso) return null;
  if (!input.overenskomstId) return null;
  const tafBeregnesSom = input.tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'Måneder' : 'Arbejdsdage';
  const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(input.overenskomstId, tafBeregnesSom);
  if (!grundloenAngivetPer) return null;
  const supplementValue = convertAnciennitetSats(satsValue, input.satsAngivesPer ?? 'Måned', grundloenAngivetPer);
  const roundedSupplement = round2(supplementValue);
  if (!Number.isFinite(roundedSupplement) || roundedSupplement <= 0) return null;
  return {
    activeFromIso: anciennitetDato < input.periodeStartIso ? input.periodeStartIso : anciennitetDato,
    supplementValue: roundedSupplement,
  };
};

type PrivateOverenskomstBaseArgs = Readonly<{
  overenskomstId: OverenskomstId;
  anvendtReguleringsdato: ISODateString;
  effectiveReguleringsdato: ISODateString;
  applyAlmindeligLoenPaaShDageRegel: boolean;
  shSoPctInput: number | undefined;
  fritvalgPctInput: number | undefined;
  pensionPctInput: number | undefined;
}>;

export type PrivateOverenskomstBaseContext = Readonly<{
  effectiveBase: Readonly<{
    startIso: ISODateString;
    sats: OverenskomstPeriodeSats;
  }>;
  referenceSats: OverenskomstPeriodeSats | undefined;
  useInputPctBasisForMissingBase: boolean;
}>;

const hasNonZeroDefinedPct = (value: number | undefined): boolean =>
  typeof value === 'number' && Number.isFinite(value) && differsFromZero(value);

export const resolvePrivateOverenskomstBaseContext = (
  args: PrivateOverenskomstBaseArgs
): PrivateOverenskomstBaseContext | null => {
  const anvendtDatoDa = isoToDanish(args.anvendtReguleringsdato);
  const effectiveDatoDa = isoToDanish(args.effectiveReguleringsdato);
  if (!effectiveDatoDa) return null;

  const referenceSats = anvendtDatoDa
    ? getEffektiveSatserForDato({
        overenskomstId: args.overenskomstId,
        dato: anvendtDatoDa,
        applyAlmindeligLoenPaaShDageRegel: args.applyAlmindeligLoenPaaShDageRegel,
      })
    : undefined;

  const effectiveSats = getEffektiveSatserForDato({
    overenskomstId: args.overenskomstId,
    dato: effectiveDatoDa,
    applyAlmindeligLoenPaaShDageRegel: args.applyAlmindeligLoenPaaShDageRegel,
  });

  const effectiveBase = (() => {
    if (effectiveSats) {
      return {
        startIso: args.effectiveReguleringsdato,
        sats: effectiveSats,
      };
    }
    const interval = getReguleringsDatoIntervalForOverenskomst(args.overenskomstId);
    if (!interval) return null;
    const firstStartIso = parseDanishToIso(interval.fraDato);
    if (!firstStartIso) return null;
    const firstSats = getEffektiveSatserForDato({
      overenskomstId: args.overenskomstId,
      dato: interval.fraDato,
      applyAlmindeligLoenPaaShDageRegel: args.applyAlmindeligLoenPaaShDageRegel,
    });
    if (!firstSats) return null;
    return {
      startIso: firstStartIso,
      sats: firstSats,
    };
  })();

  if (!effectiveBase) return null;

  return {
    effectiveBase,
    referenceSats,
    useInputPctBasisForMissingBase: (
      args.anvendtReguleringsdato < args.effectiveReguleringsdato
      || !referenceSats
    ) && (
      hasNonZeroDefinedPct(args.shSoPctInput)
      || hasNonZeroDefinedPct(args.fritvalgPctInput)
      || hasNonZeroDefinedPct(args.pensionPctInput)
    ),
  };
};

/**
 * Bygger `FormulaComponents` for den OFFENTLIGE overenskomst-gren (løntrin). Samler den samling
 * motoren (`overenskomstOffentligSegmenter`) og præsentationens reguleringsindeks-tabel før byggede
 * hver for sig — begge i pct-point-konvention med `resolvePctPointFromSatsOrInput` — så vist indeks
 * = den motoren afleder deltaPct fra (én formel-samling, ingen drift). Spejler den private
 * `buildPrivateOverenskomstFormulaComponents`.
 *
 * BEVIDST afgrænsning: kun selve samlingen deles. Base-/sats-UDVÆLGELSEN forbliver pr. lag
 * (motorens U4-clamp + interval-fallback vs. præsentationens effective-base + deltaPct-fallback) —
 * de er to forskellige, bevidst adskilte mekanismer (jf. U4). `grundloen` er allerede summeret af
 * kaldstedet (løn + ekstra grundløn + evt. anciennitetstillæg). Inspektionslaget deles IKKE herfra:
 * det bruger decimal-konvention (`computePackageValueDecimal`) og er B9-isoleret kontrol.
 */
export const buildOffentligOverenskomstFormulaComponents = (args: Readonly<{
  grundloen: number;
  feriePct: number;
  tillaegsSatser: OverenskomstPeriodeSats | undefined;
  shSoPctInput: number | undefined;
  fritvalgPctInput: number | undefined;
  pensionPctInput: number | undefined;
  applyAlmindeligLoenPaaShDageRegel: boolean;
  dateIso: ISODateString;
}>): FormulaComponents => ({
  baseValue: args.grundloen,
  feriePct: args.feriePct,
  fritvalgPct: resolvePctPointFromSatsOrInput(args.tillaegsSatser?.fritvalg, args.fritvalgPctInput),
  shSoPct: resolvePctPointFromSatsOrInput(args.tillaegsSatser?.shSoSats, args.shSoPctInput),
  pensionPct: resolvePctPointFromSatsOrInput(args.tillaegsSatser?.agPension, args.pensionPctInput),
  storeBededagPct: args.applyAlmindeligLoenPaaShDageRegel && args.dateIso >= STORE_BEDEDAG_START
    ? STORE_BEDEDAG_PCT
    : 0,
});

export const buildPrivateOverenskomstFormulaComponents = (args: Readonly<{
  sats: OverenskomstPeriodeSats;
  context: PrivateOverenskomstBaseContext;
  feriePct: number;
  shSoPctInput: number | undefined;
  fritvalgPctInput: number | undefined;
  pensionPctInput: number | undefined;
  pctBasisRole: 'reference' | 'segment';
  dateIso: ISODateString;
  baseValueSupplement?: number;
  applyAlmindeligLoenPaaShDageRegel: boolean;
}>): FormulaComponents => ({
  baseValue: (args.sats.grundloen ?? 0) + (args.baseValueSupplement ?? 0),
  feriePct: args.feriePct,
  fritvalgPct: args.context.useInputPctBasisForMissingBase && args.pctBasisRole === 'reference'
    ? resolvePctPointFromSatsOrInput(args.context.referenceSats?.fritvalg, args.fritvalgPctInput)
    : resolvePctPointFromSatsOrInput(args.sats.fritvalg, args.fritvalgPctInput),
  shSoPct: args.context.useInputPctBasisForMissingBase && args.pctBasisRole === 'reference'
    ? resolvePctPointFromSatsOrInput(args.context.referenceSats?.shSoSats, args.shSoPctInput)
    : resolvePctPointFromSatsOrInput(args.sats.shSoSats, args.shSoPctInput),
  pensionPct: args.context.useInputPctBasisForMissingBase && args.pctBasisRole === 'reference'
    ? resolvePctPointFromSatsOrInput(args.context.referenceSats?.agPension, args.pensionPctInput)
    : resolvePctPointFromSatsOrInput(args.sats.agPension, args.pensionPctInput),
  storeBededagPct: args.applyAlmindeligLoenPaaShDageRegel && args.dateIso >= STORE_BEDEDAG_START
    ? STORE_BEDEDAG_PCT
    : 0,
});
